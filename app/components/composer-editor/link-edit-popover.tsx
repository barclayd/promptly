'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

type LinkEditPopoverProps = {
  url: string;
  onSetLink: (url: string) => void;
  onRemoveLink: () => void;
  hasLink: boolean;
};

export const LinkEditPopover = ({
  url,
  onSetLink,
  onRemoveLink,
  hasLink,
}: LinkEditPopoverProps) => {
  const [value, setValue] = useState(url);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSetLink(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor="link-url" className="text-xs">
        URL
      </Label>
      <Input
        id="link-url"
        type="url"
        placeholder="https://example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        {hasLink && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onRemoveLink}
          >
            Remove
          </Button>
        )}
        <Button type="submit" size="sm" className="h-7 text-xs">
          Apply
        </Button>
      </div>
    </form>
  );
};
