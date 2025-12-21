import type { ComponentProps } from 'react';
import { Slider } from '~/components/ui/slider';
import { cn } from '~/lib/utils';

type SliderProps = ComponentProps<typeof Slider>;

export const SidebarSlider = ({ className, ...props }: SliderProps) => (
  <Slider
    defaultValue={[50]}
    max={100}
    step={1}
    className={cn('w-[60%]', className)}
    {...props}
  />
);
