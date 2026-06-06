import {
  IconArrowLeft,
  IconCheck,
  IconFileCode,
  IconGitCompare,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CompareInputBar } from '~/components/compare/compare-input-bar';
import { type RunState, VersionCard } from '~/components/compare/version-card';
import { NoLlmApiKeysModal } from '~/components/no-llm-api-keys-modal';
import { Button } from '~/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useEnabledModels } from '~/hooks/use-enabled-models';
import { useEqualBlockHeights } from '~/hooks/use-equal-block-heights';
import { cn } from '~/lib/utils';
import type { CompareVersion } from '~/routes/prompts.promptId.compare';

const STREAM_FLUSH_INTERVAL_MS = 150;
const STREAM_ERROR_RE = /\[Error:(?:(\w+):)?(.+)\]$/;

type ViewMode = 'diff' | 'full';

type DropInfo = { key: string; side: 'left' | 'right' };

type CompareScreenProps = {
  promptId: string;
  promptName: string;
  versions: CompareVersion[];
  baselineKey: string;
  initialModel: string | null;
  initialTemperature: number;
  initialInputData: unknown;
  inputDataRootName: string | null;
};

export const CompareScreen = ({
  promptId,
  promptName,
  versions,
  baselineKey,
  initialModel,
  initialTemperature,
  initialInputData,
  inputDataRootName,
}: CompareScreenProps) => {
  const enabledModels = useEnabledModels();

  const baseline =
    versions.find((v) => v.key === baselineKey) ?? versions[0] ?? null;

  // Default-enable the 4 most recent versions; the baseline is always pinned
  // in, even if it falls outside that window.
  const [included, setIncluded] = useState<string[]>(() => {
    const recent = versions.slice(0, 4).map((v) => v.key);
    if (!recent.includes(baselineKey)) recent.push(baselineKey);
    return recent;
  });
  const [order, setOrder] = useState<string[]>(() =>
    versions.map((v) => v.key),
  );
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [inputOpen, setInputOpen] = useState(true);
  const [model, setModel] = useState<string | null>(initialModel);
  const [temperature, setTemperature] = useState(initialTemperature);
  const [inputData, setInputData] = useState<unknown>(initialInputData);
  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [showNoApiKeysModal, setShowNoApiKeysModal] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const dragKeyRef = useRef<string | null>(null);

  // Abort any in-flight runs when the screen unmounts (ref callback cleanup)
  const screenRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, []);

  const toggle = (key: string) => {
    if (key === baselineKey) return; // baseline always in
    setIncluded((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const cards = order
    .filter((key) => included.includes(key))
    .map((key) => versions.find((v) => v.key === key))
    .filter((v): v is CompareVersion => Boolean(v));

  // Align System/User prompt block heights across cards so outputs line up.
  // Re-measures when the view mode or visible card set changes.
  const equalHeightsRef = useEqualBlockHeights(
    `${viewMode}:${cards.map((c) => c.key).join(',')}`,
  );

  const moveCard = (draggedKey: string, targetKey: string, after: boolean) => {
    if (draggedKey === targetKey) return;
    setOrder((prev) => {
      const arr = prev.filter((k) => k !== draggedKey);
      const idx = arr.indexOf(targetKey);
      if (idx === -1) return prev;
      arr.splice(after ? idx + 1 : idx, 0, draggedKey);
      return arr;
    });
  };

  const dnd = {
    onStart: (key: string) => {
      dragKeyRef.current = key;
      setDragKey(key);
    },
    onOver: (key: string, e: React.DragEvent) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const side: DropInfo['side'] =
        e.clientX - rect.left > rect.width / 2 ? 'right' : 'left';
      setDropInfo((cur) =>
        cur && cur.key === key && cur.side === side ? cur : { key, side },
      );
    },
    onDrop: (key: string, e: React.DragEvent) => {
      e.preventDefault();
      const draggedKey = dragKeyRef.current;
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientX - rect.left > rect.width / 2;
      if (draggedKey && draggedKey !== key) moveCard(draggedKey, key, after);
      dragKeyRef.current = null;
      setDragKey(null);
      setDropInfo(null);
    },
    onEnd: () => {
      dragKeyRef.current = null;
      setDragKey(null);
      setDropInfo(null);
    },
  };

  const runVersion = useCallback(
    async (versionKey: string, signal: AbortSignal) => {
      const setVersionRun = (state: RunState) => {
        setRunState((prev) => ({ ...prev, [versionKey]: state }));
      };

      try {
        const formData = new FormData();
        formData.append('promptId', promptId);
        formData.append('model', model || 'anthropic/claude-haiku-4.5');
        formData.append('temperature', temperature.toString());
        formData.append('inputData', JSON.stringify(inputData));
        formData.append('inputDataRootName', inputDataRootName || '');
        formData.append('version', versionKey);

        const response = await fetch('/api/prompts/run', {
          method: 'POST',
          body: formData,
          signal,
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
            errorType?: string;
          };
          setVersionRun({
            status: 'error',
            text: '',
            error:
              errorData.errorType === 'AUTH_ERROR'
                ? 'Invalid API key for this model. Check Settings > LLM API Keys.'
                : (errorData.error ?? `HTTP ${response.status}`),
          });
          return;
        }

        if (!response.body) {
          setVersionRun({ status: 'error', text: '', error: 'No response' });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let lastFlush = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          const now = performance.now();
          if (now - lastFlush >= STREAM_FLUSH_INTERVAL_MS) {
            lastFlush = now;
            setVersionRun({ status: 'running', text: fullText });
          }
        }

        // The run endpoint encodes failures inline at the end of the stream
        const errorMatch = fullText.match(STREAM_ERROR_RE);
        if (errorMatch) {
          const errorType = errorMatch[1] || 'STREAM_ERROR';
          setVersionRun({
            status: 'error',
            text: '',
            error:
              errorType === 'AUTH_ERROR'
                ? 'Invalid API key for this model. Check Settings > LLM API Keys.'
                : errorMatch[2],
          });
          return;
        }

        setVersionRun({ status: 'done', text: fullText });
      } catch (err) {
        if (signal.aborted) return;
        setVersionRun({
          status: 'error',
          text: '',
          error: err instanceof Error ? err.message : 'An error occurred',
        });
      }
    },
    [promptId, model, temperature, inputData, inputDataRootName],
  );

  const generate = useCallback(() => {
    if (enabledModels.length === 0) {
      setShowNoApiKeysModal(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const keys = order.filter((key) => included.includes(key));
    const init: Record<string, RunState> = {};
    for (const key of keys) {
      init[key] = { status: 'running', text: '' };
    }
    setRunState(init);

    for (const key of keys) {
      void runVersion(key, controller.signal);
    }
  }, [enabledModels, order, included, runVersion]);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunState({});
  };

  const hasRun = Object.keys(runState).length > 0;
  const anyRunning = Object.values(runState).some(
    (s) => s.status === 'running',
  );
  const baselineOutput =
    runState[baselineKey]?.status === 'error'
      ? ''
      : (runState[baselineKey]?.text ?? '');

  if (!baseline) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        This prompt has no versions to compare yet.
      </div>
    );
  }

  return (
    <div ref={screenRef} className="cv-screen flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-start gap-4 border-b px-5 pb-3.5 pt-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="mt-0.5 size-8 flex-none"
          >
            <Link to={`/prompts/${promptId}`} title="Back to editor">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <IconGitCompare className="size-4 text-muted-foreground" />
              <h1 className="text-lg font-bold tracking-tight">
                Compare versions
              </h1>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconFileCode className="size-3" />
              <span className="font-mono text-[11.5px] font-semibold text-foreground">
                {promptName}
              </span>
              <span>
                · diffed against{' '}
                <em className="not-italic font-semibold text-indigo-600 dark:text-indigo-400">
                  {baseline.label}
                </em>{' '}
                {baseline.status === 'live' && '(live)'}
              </span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-none items-center">
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
          >
            <TabsList>
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="full">Full text</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Shared test input + config + Generate CTA */}
      <CompareInputBar
        open={inputOpen}
        onOpenChange={setInputOpen}
        inputData={inputData}
        onInputDataChange={setInputData}
        inputDataRootName={inputDataRootName}
        model={model}
        onModelChange={setModel}
        temperature={temperature}
        onTemperatureChange={setTemperature}
        enabledModels={enabledModels}
        hasRun={hasRun}
        anyRunning={anyRunning}
        onGenerate={generate}
        onReset={reset}
      />

      {/* Version selector */}
      <div className="flex items-center gap-3 border-b px-5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Versions
        </span>
        <div className="flex flex-wrap gap-2">
          {versions.map((v) => {
            const on = included.includes(v.key);
            const isBase = v.key === baselineKey;
            return (
              <button
                key={v.key}
                type="button"
                data-testid={`compare-chip-${v.key}`}
                className={cn(
                  'inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-background py-0 pl-2 pr-3 font-mono text-[13px] font-medium text-muted-foreground transition-colors',
                  isBase
                    ? 'cursor-default'
                    : 'hover:border-muted-foreground/50',
                  on && 'border-indigo-500/60 bg-indigo-500/5 text-foreground',
                )}
                onClick={() => toggle(v.key)}
                title={
                  isBase
                    ? 'Baseline — always included'
                    : on
                      ? 'Remove from comparison'
                      : 'Add to comparison'
                }
              >
                <span
                  className={cn(
                    'flex size-4 flex-none items-center justify-center rounded border text-white',
                    on && 'border-indigo-500 bg-indigo-500',
                  )}
                >
                  {on && <IconCheck className="size-3" />}
                </span>
                {v.label}
                {isBase && (
                  <IconGitCompare className="size-3 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
        <span className="ml-auto hidden whitespace-nowrap text-xs text-muted-foreground sm:block">
          {cards.length} of {versions.length} shown · drag cards to rearrange
        </span>
      </div>

      {/* Carousel */}
      <div className="min-h-0 flex-1 overflow-hidden bg-sidebar">
        <ul
          ref={equalHeightsRef}
          aria-label="Version comparison cards"
          className="flex h-full list-none items-stretch gap-4 overflow-x-auto overflow-y-hidden px-5 py-4"
        >
          {cards.map((v) => (
            <VersionCard
              key={v.key}
              version={v}
              baseline={baseline}
              isBaseline={v.key === baselineKey}
              viewMode={viewMode}
              run={runState[v.key]}
              baselineOutput={baselineOutput}
              onRemove={toggle}
              dnd={dnd}
              dragging={dragKey === v.key}
              dropSide={
                dropInfo && dropInfo.key === v.key ? dropInfo.side : null
              }
            />
          ))}
        </ul>
      </div>

      <NoLlmApiKeysModal
        open={showNoApiKeysModal}
        onOpenChange={setShowNoApiKeysModal}
      />
    </div>
  );
};
