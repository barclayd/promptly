import { cn } from '~/lib/utils';

type DemoWindowFrameProps = {
  title: string;
  tabs?: { name: string; active?: boolean }[];
  children: React.ReactNode;
  className?: string;
  bottomBar?: React.ReactNode;
};

export const DemoWindowFrame = ({
  title,
  tabs,
  children,
  className,
  bottomBar,
}: DemoWindowFrameProps) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden',
        className,
      )}
    >
      {/* Window chrome with traffic lights */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400 dark:bg-red-500" />
          <div className="size-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
          <div className="size-2.5 rounded-full bg-green-400 dark:bg-green-500" />
        </div>

        {tabs ? (
          <div className="flex-1 flex items-center gap-1 ml-3">
            {tabs.map((tab) => (
              <div
                key={tab.name}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  tab.active
                    ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-0.5 rounded text-xs text-muted-foreground font-medium">
              {title}
            </div>
          </div>
        )}

        {!tabs && <div className="w-[52px]" />}
      </div>

      {/* Main content area */}
      <div className="relative">{children}</div>

      {/* Optional bottom bar */}
      {bottomBar && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          {bottomBar}
        </div>
      )}
    </div>
  );
};
