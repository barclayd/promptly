import type { ComponentProps } from 'react';
import { cn } from '~/lib/utils';

export const Paper = ({
  className,
  children,
  ...props
}: ComponentProps<'div'>) => (
  <div
    data-slot="paper"
    className={cn('group relative isolate min-h-[250px] w-[200px]', className)}
    {...props}
  >
    {/* Left shadow */}
    <span
      aria-hidden="true"
      className="absolute bottom-[10px] left-[15px] h-[10px] w-[40%] shadow-[0_5px_14px_rgba(0,0,0,0.7)] transition-all duration-300 ease-in-out [transform:skew(-5deg)_rotate(-5deg)] group-hover:left-[5px] group-hover:shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
    />
    {/* Right shadow */}
    <span
      aria-hidden="true"
      className="absolute bottom-[10px] right-[15px] h-[10px] w-[40%] shadow-[0_5px_14px_rgba(0,0,0,0.7)] transition-all duration-300 ease-in-out [transform:skew(5deg)_rotate(5deg)] group-hover:right-[5px] group-hover:shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
    />
    {/* Paper surface */}
    <div className="relative z-10 h-[250px] bg-white rounded-[2px] flex justify-center items-center">
      {children}
    </div>
  </div>
);
