import { IconFileTypeTs, IconJson } from '@tabler/icons-react';
import { useCallback, useEffect, useRef } from 'react';
import { CodeBlock } from './animations';
import { DemoWindowFrame } from './demo-window-frame';

type DemoIdeWindowProps = {
  isActive: boolean;
  onAnimationComplete?: () => void;
};

const CODE = `import { getPrompt } from '@promptly/sdk';

const { text } = await getPrompt('marketing/welcome-email', {
  company_name: 'Acme Inc',
  user_name: 'Sarah',
  plan_type: 'Pro'
});

await sendEmail({
  to: user.email,
  subject: 'Welcome to Acme!',
  body: text
});`;

export const DemoIdeWindow = ({
  isActive,
  onAnimationComplete,
}: DemoIdeWindowProps) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAnimated = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    hasAnimated.current = false;
  }, []);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = setTimeout(reset, 600);
      return () => clearTimeout(resetTimer);
    }

    if (hasAnimated.current) return;
    hasAnimated.current = true;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, reset]);

  const handleCodeComplete = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      onAnimationComplete?.();
    }, 800);
  }, [onAnimationComplete]);

  const handleCodeProgress = useCallback((chars: number) => {
    // Reset scroll to top at start, then auto-scroll as content grows
    if (scrollContainerRef.current) {
      if (chars <= 1) {
        // Reset to top when starting
        scrollContainerRef.current.scrollTop = 0;
      } else {
        // Auto-scroll to bottom as code is typed
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
    }
  }, []);

  return (
    <DemoWindowFrame
      title="VS Code"
      tabs={[
        {
          name: 'send-welcome.ts',
          active: true,
          icon: <IconFileTypeTs className="size-3.5 text-blue-400" />,
        },
        {
          name: 'package.json',
          active: false,
          icon: <IconJson className="size-3.5 text-yellow-400" />,
        },
      ]}
    >
      <div
        ref={scrollContainerRef}
        className="p-3 h-[255px] sm:h-[235px] lg:h-[215px] overflow-y-auto scrollbar-hide relative bg-zinc-950"
      >
        {/* Code editor with line numbers */}
        {isActive && (
          <CodeBlock
            code={CODE}
            delay={400}
            charDelay={24}
            showLineNumbers
            onComplete={handleCodeComplete}
            onProgress={handleCodeProgress}
          />
        )}
      </div>
    </DemoWindowFrame>
  );
};
