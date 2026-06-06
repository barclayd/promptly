import {
  IconGitCompare,
  IconGripVertical,
  IconMessage,
  IconPlayerPlay,
  IconSettings,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useRef } from 'react';
import { DiffText } from '~/components/compare/diff-text';
import { HighlightedPromptText } from '~/components/highlighted-prompt-text';
import { Badge } from '~/components/ui/badge';
import { computeDiff } from '~/lib/prompt-diff';
import { cn } from '~/lib/utils';
import type {
  CompareVersion,
  CompareVersionStatus,
} from '~/routes/prompts.promptId.compare';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export type RunState = {
  status: RunStatus;
  text: string;
  error?: string | null;
};

export type CardDndHandlers = {
  onStart: (key: string) => void;
  onOver: (key: string, e: React.DragEvent) => void;
  onDrop: (key: string, e: React.DragEvent) => void;
  onEnd: () => void;
};

const StatusBadge = ({ status }: { status: CompareVersionStatus }) => {
  if (status === 'live') {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-200 bg-emerald-50 px-2 py-0 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Live
      </Badge>
    );
  }
  if (status === 'draft') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 px-2 py-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
      >
        Draft
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="px-2 py-0 text-[11px] font-semibold whitespace-nowrap"
    >
      Published
    </Badge>
  );
};

const PromptBlock = ({
  icon,
  title,
  blockType,
  baselineText,
  versionText,
  plain,
}: {
  icon: React.ReactNode;
  title: string;
  blockType: 'system' | 'user';
  baselineText: string;
  versionText: string;
  plain: boolean;
}) => {
  const ops = useMemo(
    () => (plain ? null : computeDiff(baselineText, versionText)),
    [plain, baselineText, versionText],
  );

  return (
    <div
      data-cv-block={blockType}
      className="overflow-hidden rounded-lg border"
    >
      <div className="flex items-center gap-1.5 border-b bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed">
        {ops ? (
          <DiffText ops={ops} />
        ) : (
          <HighlightedPromptText text={versionText} />
        )}
      </div>
    </div>
  );
};

type VersionCardProps = {
  version: CompareVersion;
  baseline: CompareVersion;
  isBaseline: boolean;
  viewMode: 'diff' | 'full';
  run: RunState | undefined;
  /** The baseline card's current output text — diff target for outputs. */
  baselineOutput: string;
  onRemove: (key: string) => void;
  dnd: CardDndHandlers;
  dragging: boolean;
  dropSide: 'left' | 'right' | null;
};

export const VersionCard = ({
  version,
  baseline,
  isBaseline,
  viewMode,
  run,
  baselineOutput,
  onRemove,
  dnd,
  dragging,
  dropSide,
}: VersionCardProps) => {
  const cardRef = useRef<HTMLLIElement>(null);
  const plain = viewMode === 'full' || isBaseline;

  const status = run?.status ?? 'idle';
  const outputText = run?.text ?? '';
  const diffOutput = !plain && (status === 'running' || status === 'done');

  const outputOps = useMemo(
    () => (diffOutput ? computeDiff(baselineOutput, outputText) : null),
    [diffOutput, baselineOutput, outputText],
  );

  return (
    <li
      ref={cardRef}
      aria-label={`${version.label} comparison card`}
      data-testid="compare-version-card"
      data-version={version.key}
      className={cn(
        'relative flex h-full min-h-0 flex-[0_0_clamp(330px,31%,460px)] flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-[opacity,box-shadow,border-color] duration-200',
        isBaseline &&
          'border-indigo-500/80 ring-1 ring-indigo-500/80 shadow-[0_8px_22px_-12px_rgba(99,102,241,0.45)]',
        dragging && 'opacity-35',
      )}
      onDragOver={(e) => dnd.onOver(version.key, e)}
      onDrop={(e) => dnd.onDrop(version.key, e)}
      onDragEnd={dnd.onEnd}
    >
      {dropSide && (
        <span
          className={cn(
            'pointer-events-none absolute top-2.5 bottom-2.5 z-10 w-[3px] rounded-full bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.25)]',
            dropSide === 'left' ? '-left-2' : '-right-2',
          )}
        />
      )}

      <div
        role="toolbar"
        aria-label={`${version.label} card header — drag to rearrange`}
        className="flex flex-none cursor-grab select-none items-center justify-between gap-2 border-b px-3 py-2.5 active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          if (cardRef.current) {
            e.dataTransfer.setDragImage(cardRef.current, 28, 24);
          }
          e.dataTransfer.effectAllowed = 'move';
          dnd.onStart(version.key);
        }}
      >
        <div className="flex items-center gap-1.5">
          <IconGripVertical
            className="-ml-1 size-4 text-muted-foreground opacity-50"
            title="Drag to rearrange"
          />
          <span className="font-mono text-sm font-bold tracking-tight">
            {version.label}
          </span>
          <StatusBadge status={version.status} />
        </div>
        <div className="flex items-center gap-2">
          {isBaseline ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <IconGitCompare className="size-3" />
              Baseline
            </span>
          ) : (
            <button
              type="button"
              title="Remove from comparison"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => onRemove(version.key)}
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <PromptBlock
          icon={<IconSettings className="size-3.5" />}
          title="System prompt"
          blockType="system"
          baselineText={baseline.systemMessage}
          versionText={version.systemMessage}
          plain={plain}
        />
        <PromptBlock
          icon={<IconMessage className="size-3.5" />}
          title="User prompt"
          blockType="user"
          baselineText={baseline.userMessage}
          versionText={version.userMessage}
          plain={plain}
        />

        <div className="mt-0.5 overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b bg-indigo-500/5 px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold">
              <IconSparkles className="size-3 text-indigo-500 dark:text-indigo-400" />
              Output
            </span>
            {isBaseline && (
              <span className="text-[10.5px] italic text-muted-foreground">
                reference
              </span>
            )}
          </div>
          <div className="min-h-[90px] bg-background p-3">
            {status === 'idle' && (
              <div className="flex min-h-[66px] flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground/80">
                <IconPlayerPlay className="size-4 opacity-60" />
                <span>Run to compare</span>
              </div>
            )}
            {status === 'error' && (
              <p className="text-[13px] leading-relaxed text-destructive">
                {run?.error ?? 'Something went wrong running this version.'}
              </p>
            )}
            {(status === 'running' || status === 'done') && (
              <div className="whitespace-pre-wrap text-[13px] leading-[1.75]">
                {outputOps ? (
                  <DiffText ops={outputOps} streaming={status === 'running'} />
                ) : (
                  <>
                    {outputText}
                    {status === 'running' && (
                      <span className="cv-stream-cursor" />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};
