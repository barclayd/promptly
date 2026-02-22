'use client';

import { IconAlertCircle, IconCopy, IconSparkles } from '@tabler/icons-react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from '~/components/ui/item';
import { cn } from '~/lib/utils';

type DocumentSegment = {
  index: number;
  type: 'static' | 'prompt_ref';
  content: string;
  promptId?: string;
  promptName?: string;
  status: 'pending' | 'streaming' | 'done' | 'error';
  error?: string;
};

type ComposerStreamingResponseProps = {
  segments: DocumentSegment[];
  isStreaming: boolean;
  isComplete: boolean;
  errors: Array<{ promptId: string; error: string }>;
};

export type { DocumentSegment };

export const ComposerStreamingResponse = ({
  segments,
  isStreaming,
  isComplete,
  errors,
}: ComposerStreamingResponseProps) => {
  const [copied, setCopied] = useState(false);

  const assembledText = segments.map((s) => s.content).join('');
  const hasText = assembledText.length > 0;
  const isThinking = isStreaming && !hasText;
  const hasActiveStream = segments.some((s) => s.status === 'streaming');
  const isIdle = !isStreaming && !isComplete && segments.length === 0;

  const handleCopy = async () => {
    if (!assembledText) return;
    await navigator.clipboard.writeText(assembledText);
    setCopied(true);
    setTimeout(() => setCopied(false), 5000);
  };

  if (errors.length > 0 && !hasText) {
    return (
      <div className="flex flex-col gap-2">
        {errors.map((err) => (
          <Item
            key={`${err.promptId}-${err.error}`}
            variant="outline"
            size="sm"
            className="border-destructive/40 bg-destructive/5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            <ItemMedia
              variant="icon"
              className="border-destructive/30 bg-destructive/10"
            >
              <IconAlertCircle className="size-4 text-destructive" />
            </ItemMedia>
            <ItemContent>
              <ItemDescription className="text-destructive/90 font-medium">
                {err.error}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </div>
    );
  }

  if (isIdle) {
    return (
      <Item
        variant="muted"
        size="sm"
        className="opacity-60 animate-in fade-in-0 duration-300"
      >
        <ItemMedia
          variant="icon"
          className="border-muted-foreground/20 bg-muted"
        >
          <IconSparkles className="size-4 text-muted-foreground/50" />
        </ItemMedia>
        <ItemContent>
          <ItemDescription className="italic text-muted-foreground/70">
            Click Test to execute your composer...
          </ItemDescription>
        </ItemContent>
      </Item>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-lg transition-all duration-500',
        isStreaming && 'streaming-glow',
      )}
    >
      {isStreaming && (
        <div
          className="absolute -inset-[1px] rounded-lg opacity-60 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, oklch(0.6 0.15 250), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s ease-in-out infinite',
          }}
        />
      )}

      <Item
        variant="outline"
        size="sm"
        className={cn(
          'relative z-10 bg-background/95 backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
          isStreaming && 'border-primary/30',
          isComplete && !errors.length && 'border-emerald-500/30',
          isComplete && errors.length > 0 && 'border-amber-500/30',
        )}
      >
        {hasText && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'absolute top-2 right-2 p-1.5 rounded-md z-20',
              'text-muted-foreground/60 hover:text-foreground',
              'hover:bg-muted/80 active:bg-muted',
              'transition-all duration-200',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              hasText && 'opacity-60 hover:opacity-100',
            )}
            aria-label="Copy response"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500 animate-in zoom-in duration-200" />
            ) : (
              <IconCopy className="size-3.5" />
            )}
          </button>
        )}

        <ItemMedia
          variant="icon"
          className={cn(
            'transition-all duration-500',
            isThinking && 'border-primary/40 bg-primary/10 animate-pulse',
            hasActiveStream && 'border-primary/30 bg-primary/5',
            isComplete &&
              !errors.length &&
              'border-emerald-500/30 bg-emerald-500/10',
            isComplete &&
              errors.length > 0 &&
              'border-amber-500/30 bg-amber-500/10',
          )}
        >
          <IconSparkles
            className={cn(
              'size-4 transition-colors duration-300',
              isStreaming && 'text-primary',
              isComplete && !errors.length && 'text-emerald-500',
              isComplete && errors.length > 0 && 'text-amber-500',
            )}
          />
        </ItemMedia>

        <ItemContent className="min-h-6">
          {isThinking ? (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Thinking</span>
              <span className="flex gap-0.5">
                <span
                  className="size-1 rounded-full bg-primary/60"
                  style={{
                    animation: 'bounce-dot 1.4s ease-in-out infinite',
                  }}
                />
                <span
                  className="size-1 rounded-full bg-primary/60"
                  style={{
                    animation: 'bounce-dot 1.4s ease-in-out 0.2s infinite',
                  }}
                />
                <span
                  className="size-1 rounded-full bg-primary/60"
                  style={{
                    animation: 'bounce-dot 1.4s ease-in-out 0.4s infinite',
                  }}
                />
              </span>
            </div>
          ) : (
            <ItemDescription
              className={cn(
                'whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90 line-clamp-none',
                'selection:bg-primary/20',
              )}
            >
              {segments.map((segment) => {
                if (segment.status === 'error') {
                  return (
                    <span
                      key={segment.index}
                      className="text-destructive/90 font-medium"
                    >
                      [Error:{' '}
                      {segment.error ??
                        `Failed to execute ${segment.promptName ?? 'prompt'}`}
                      ]
                    </span>
                  );
                }

                if (
                  segment.type === 'prompt_ref' &&
                  segment.status === 'pending'
                ) {
                  return null;
                }

                return <span key={segment.index}>{segment.content}</span>;
              })}
              {hasActiveStream && (
                <span
                  className="inline-block w-0.5 h-[1em] bg-primary ml-0.5 align-middle"
                  style={{
                    animation: 'cursor-blink 1s step-end infinite',
                  }}
                />
              )}
            </ItemDescription>
          )}

          {isComplete && errors.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {errors.map((err) => (
                <div
                  key={`${err.promptId}-${err.error}`}
                  className="flex items-center gap-1.5 text-xs text-destructive/80"
                >
                  <IconAlertCircle className="size-3 shrink-0" />
                  <span>{err.error}</span>
                </div>
              ))}
            </div>
          )}
        </ItemContent>
      </Item>

      <style>{`
        @keyframes shimmer {
          0%, 100% {
            background-position: -200% 0;
          }
          50% {
            background-position: 200% 0;
          }
        }

        @keyframes cursor-blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }

        @keyframes bounce-dot {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          40% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }

        .streaming-glow {
          box-shadow: 0 0 20px -5px oklch(0.6 0.15 250 / 0.3);
        }
      `}</style>
    </div>
  );
};
