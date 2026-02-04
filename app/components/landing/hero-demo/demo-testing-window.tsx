import { IconPlayerPlay } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';
import { VariableBadge } from './animations';
import { DemoWindowFrame } from './demo-window-frame';

type DemoTestingWindowProps = {
  isActive: boolean;
  onAnimationComplete?: () => void;
};

type Variable = {
  name: string;
  variant: 'company' | 'user' | 'plan';
  options: string[];
  selectedValue: string | null;
};

const VARIABLES: Variable[] = [
  {
    name: 'company_name',
    variant: 'company',
    options: ['Acme Inc', 'TechCorp', 'StartupXYZ'],
    selectedValue: null,
  },
  {
    name: 'user_name',
    variant: 'user',
    options: ['Sarah', 'Alex', 'Jordan'],
    selectedValue: null,
  },
  {
    name: 'plan_type',
    variant: 'plan',
    options: ['Free', 'Pro', 'Enterprise'],
    selectedValue: null,
  },
];

type AnimationPhase =
  | 'idle'
  | 'select-company'
  | 'select-user'
  | 'select-plan'
  | 'click-run'
  | 'running'
  | 'done';

export const DemoTestingWindow = ({
  isActive,
  onAnimationComplete,
}: DemoTestingWindowProps) => {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {},
  );
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [showOutputPreview, setShowOutputPreview] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasAnimated = useRef(false);

  const clearAllTimeouts = useCallback(() => {
    for (const t of timeoutsRef.current) {
      clearTimeout(t);
    }
    timeoutsRef.current = [];
  }, []);

  const reset = useCallback(() => {
    clearAllTimeouts();
    setSelectedValues({});
    setActiveDropdown(null);
    setPhase('idle');
    setIsRunning(false);
    setShowOutputPreview(false);
    hasAnimated.current = false;
  }, [clearAllTimeouts]);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = setTimeout(reset, 600);
      return () => clearTimeout(resetTimer);
    }

    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Animation sequence - slowed by 0.75x (multiply delays by 1.33)
    const sequence = [
      { delay: 670, action: () => setPhase('select-company') },
      { delay: 400, action: () => setActiveDropdown('company_name') },
      {
        delay: 800,
        action: () => {
          setSelectedValues((prev) => ({ ...prev, company_name: 'Acme Inc' }));
          setActiveDropdown(null);
        },
      },
      { delay: 670, action: () => setPhase('select-user') },
      { delay: 400, action: () => setActiveDropdown('user_name') },
      {
        delay: 800,
        action: () => {
          setSelectedValues((prev) => ({ ...prev, user_name: 'Sarah' }));
          setActiveDropdown(null);
        },
      },
      { delay: 670, action: () => setPhase('select-plan') },
      { delay: 400, action: () => setActiveDropdown('plan_type') },
      {
        delay: 800,
        action: () => {
          setSelectedValues((prev) => ({ ...prev, plan_type: 'Pro' }));
          setActiveDropdown(null);
        },
      },
      { delay: 670, action: () => setPhase('click-run') },
      {
        delay: 530,
        action: () => {
          setPhase('running');
          setIsRunning(true);
        },
      },
      {
        delay: 500, // Show output preview 500ms after running starts
        action: () => setShowOutputPreview(true),
      },
      {
        delay: 3000, // Pause for 3 seconds so user can read the preview
        action: () => {
          setPhase('done');
          onAnimationComplete?.();
        },
      },
    ];

    let totalDelay = 400; // slowed from 300
    for (const step of sequence) {
      totalDelay += step.delay;
      const t = setTimeout(step.action, totalDelay);
      timeoutsRef.current.push(t);
    }

    return () => {
      clearAllTimeouts();
    };
  }, [isActive, onAnimationComplete, reset, clearAllTimeouts]);

  const getVariantColor = (variant: string) => {
    switch (variant) {
      case 'company':
        return 'border-amber-300 dark:border-amber-600';
      case 'user':
        return 'border-emerald-300 dark:border-emerald-600';
      case 'plan':
        return 'border-purple-300 dark:border-purple-600';
      default:
        return 'border-zinc-300';
    }
  };

  return (
    <DemoWindowFrame title="Promptly">
      <div className="p-4 h-[255px] sm:h-[235px] lg:h-[215px] overflow-y-auto scrollbar-hide relative">
        {/* Header */}
        <div className="text-[10px] text-muted-foreground mb-3">
          Fill in variables to test your prompt
        </div>

        {/* Variables list */}
        <div className="space-y-2.5">
          {VARIABLES.map((variable) => (
            <div key={variable.name} className="relative">
              <div className="flex items-center gap-2">
                <VariableBadge
                  name={variable.name}
                  variant={variable.variant}
                  visible
                />
                <div
                  className={cn(
                    'flex-1 relative',
                    phase === `select-${variable.variant}` && 'z-10',
                  )}
                >
                  <div
                    className={cn(
                      'px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 transition-all',
                      activeDropdown === variable.name
                        ? getVariantColor(variable.variant)
                        : 'border-zinc-200 dark:border-zinc-700',
                    )}
                  >
                    {selectedValues[variable.name] || (
                      <span className="text-muted-foreground">Select...</span>
                    )}
                  </div>

                  {/* Dropdown */}
                  {activeDropdown === variable.name && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg z-20 overflow-hidden"
                      style={{
                        animation: 'dropdown-slide 0.2s ease-out forwards',
                      }}
                    >
                      {variable.options.map((option, i) => (
                        <div
                          key={option}
                          className={cn(
                            'px-2 py-1 text-xs cursor-pointer transition-colors',
                            i === 0
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-700',
                          )}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Run button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all shadow-lg',
              phase === 'click-run'
                ? 'bg-indigo-600 scale-105 shadow-indigo-500/40'
                : 'bg-indigo-500 shadow-indigo-500/25',
              isRunning && 'opacity-80',
            )}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <IconPlayerPlay className="size-3" />
                Run Test
              </>
            )}
          </button>
        </div>

        {/* Output preview mini window */}
        {showOutputPreview && (
          <div
            className="absolute -bottom-2 right-0 w-[180px] rounded-lg border border-zinc-700 bg-zinc-800/95 shadow-xl shadow-black/30 p-2.5 transform rotate-1 z-30"
            style={{
              animation: 'output-preview-slide 0.3s ease-out forwards',
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1.5">
              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Output preview
            </div>
            <p className="text-[10px] text-zinc-300 leading-relaxed">
              Hi Sarah! Welcome to Acme Inc. We're thrilled to have you on the
              Pro plan...
            </p>
          </div>
        )}
      </div>
    </DemoWindowFrame>
  );
};
