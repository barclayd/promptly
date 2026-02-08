import { IconLock } from '@tabler/icons-react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';

interface ReadOnlyPlanBannerProps {
  onReactivate?: () => void;
}

export const ReadOnlyPlanBanner = ({
  onReactivate,
}: ReadOnlyPlanBannerProps) => {
  const { canManageBilling } = useCanManageBilling();

  return (
    <div
      data-slot="read-only-plan-banner"
      className="flex items-center gap-3 border-b border-amber-200/60 bg-amber-50 px-4 py-2.5 pl-6 dark:border-amber-800/40 dark:bg-amber-950/30"
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
        <IconLock className="size-3.5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-x-2 gap-y-1 flex-wrap">
        <p className="text-sm text-amber-900 dark:text-amber-100">
          <span className="sm:hidden">View-only — Free plan limit.</span>
          <span className="hidden sm:inline">
            This prompt is view-only on the Free plan.
          </span>
        </p>
        {canManageBilling ? (
          <button
            type="button"
            onClick={onReactivate}
            className="text-sm font-medium text-indigo-600 underline underline-offset-2 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <span className="sm:hidden">Reactivate</span>
            <span className="hidden sm:inline">
              Reactivate Pro to edit all your prompts
            </span>
          </button>
        ) : (
          <span className="text-sm text-amber-700/80 dark:text-amber-300/70">
            Ask your workspace admin to reactivate Pro.
          </span>
        )}
      </div>
    </div>
  );
};
