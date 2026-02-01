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

  return (
    <DemoWindowFrame
      title="VS Code"
      tabs={[
        { name: 'send-welcome.ts', active: true },
        { name: 'package.json', active: false },
      ]}
    >
      <div className="p-3 h-[165px] sm:h-[195px] overflow-y-auto relative bg-zinc-950">
        {/* Code editor */}
        {isActive && (
          <CodeBlock
            code={CODE}
            delay={400}
            charDelay={24}
            onComplete={handleCodeComplete}
          />
        )}
      </div>
    </DemoWindowFrame>
  );
};
