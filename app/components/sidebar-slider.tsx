'use client';

import { useState } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '~/components/ui/hover-card';
import { Slider } from '~/components/ui/slider';

interface SidebarSliderProps {
  defaultValue?: number[];
}

export const SidebarSlider = ({ defaultValue = [0.5] }: SidebarSliderProps) => {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-3">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <span className="tabular-nums text-xs font-medium text-sidebar-foreground/70 bg-sidebar-accent/50 rounded px-2 py-0.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
                {value}
              </span>
            </div>
            <Slider
              id="temperature"
              max={1}
              defaultValue={value}
              step={0.1}
              onValueChange={setValue}
              aria-label="Temperature"
              className="cursor-pointer"
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="end"
          className="w-[240px] text-xs leading-relaxed"
          side="bottom"
          sideOffset={8}
        >
          Controls randomness: lowering results in less random completions. As
          the temperature approaches zero, the model will become deterministic
          and repetitive.
        </HoverCardContent>
      </HoverCard>
    </div>
  );
};
