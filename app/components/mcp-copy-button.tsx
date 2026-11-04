import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';

export const McpCopyButton = ({
  value,
  label,
}: {
  value: string;
  label: string;
}) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
      setCopied(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <IconCheck className="size-4" aria-hidden="true" />
        ) : (
          <IconCopy className="size-4" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </Button>
      {error && (
        <span role="alert" className="max-w-48 text-xs text-destructive">
          Select and copy the text manually.
        </span>
      )}
    </div>
  );
};
