'use client';

import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

const SUGGESTED_PHRASES = [
  'Write a short welcome message for a new customer',
  'Explain a delivery delay to a frustrated customer',
  'Write a pricing summary for a \u00a349.99 product',
  'Summarise three benefits of using our service',
  'Draft a short disclaimer about data usage',
];

type SnippetTestComboboxProps = {
  value: string;
  onChange: (value: string) => void;
};

export const SnippetTestCombobox = ({
  value,
  onChange,
}: SnippetTestComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between text-left h-auto min-h-9"
        >
          <span className="truncate text-xs">
            {value || 'Select or type a test phrase...'}
          </span>
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Type a custom phrase..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                onChange(inputValue.trim());
                setOpen(false);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(inputValue.trim());
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs"
                >
                  Use &quot;{inputValue.trim()}&quot;
                </button>
              ) : (
                'Type a test phrase...'
              )}
            </CommandEmpty>
            <CommandGroup heading="Suggested">
              {SUGGESTED_PHRASES.map((phrase) => (
                <CommandItem
                  key={phrase}
                  value={phrase}
                  onSelect={() => {
                    onChange(phrase);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <IconCheck
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === phrase ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {phrase}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
