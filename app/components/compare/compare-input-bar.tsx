import {
  IconChevronRight,
  IconLoader2,
  IconRotate,
  IconSparkles,
} from '@tabler/icons-react';
import { JsonEditor } from 'json-edit-react';
import { SelectScrollable } from '~/components/select-scrollable';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { Slider } from '~/components/ui/slider';
import { useTheme } from '~/hooks/use-dark-mode';
import {
  jsonEditorDarkTheme,
  jsonEditorLightTheme,
} from '~/lib/json-editor-themes';
import { cn } from '~/lib/utils';

type CompareInputBarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputData: unknown;
  onInputDataChange: (value: unknown) => void;
  inputDataRootName: string | null;
  model: string | null;
  onModelChange: (value: string | null) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  enabledModels: string[];
  hasRun: boolean;
  anyRunning: boolean;
  onGenerate: () => void;
  onReset: () => void;
};

export const CompareInputBar = ({
  open,
  onOpenChange,
  inputData,
  onInputDataChange,
  inputDataRootName,
  model,
  onModelChange,
  temperature,
  onTemperatureChange,
  enabledModels,
  hasRun,
  anyRunning,
  onGenerate,
  onReset,
}: CompareInputBarProps) => {
  const { isDark } = useTheme();
  const jsonEditorTheme = isDark ? jsonEditorDarkTheme : jsonEditorLightTheme;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-b bg-sidebar"
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <CollapsibleTrigger
          className="-ml-1.5 inline-flex items-center gap-2 whitespace-nowrap rounded-md py-1.5 pl-1.5 pr-2.5 text-[13px] font-semibold hover:bg-accent"
          data-testid="compare-input-toggle"
        >
          <IconChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
          Test input
        </CollapsibleTrigger>
        <div className="ml-auto flex flex-none items-center gap-2.5">
          {hasRun && !anyRunning && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <IconRotate className="size-3.5" />
              Reset outputs
            </Button>
          )}
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={anyRunning}
            data-testid="compare-generate"
          >
            {anyRunning ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <IconSparkles className="size-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
      <CollapsibleContent>
        <div className="flex items-stretch gap-6 px-5 pb-4 pt-1">
          <div className="max-h-[210px] min-w-0 flex-1 overflow-auto rounded-md border bg-background/50 p-2">
            <JsonEditor
              data={inputData ?? {}}
              setData={onInputDataChange}
              theme={jsonEditorTheme}
              rootFontSize={11}
              collapse={1}
              showCollectionCount={true}
              indent={2}
              maxWidth="100%"
              rootName={inputDataRootName ?? undefined}
            />
          </div>
          <div className="flex w-[300px] flex-none flex-col gap-4 border-l pl-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold">Model</span>
              <SelectScrollable
                value={model ?? ''}
                onChange={onModelChange}
                enabledModels={
                  enabledModels.length > 0 ? enabledModels : undefined
                }
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Temperature</span>
                <span className="rounded-md border bg-muted px-2.5 py-0.5 text-[13px] font-medium tabular-nums">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                max={1}
                step={0.05}
                value={[temperature]}
                onValueChange={(v) => onTemperatureChange(v[0])}
                aria-label="Temperature"
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
