import { Slot } from '@radix-ui/react-slot';
import { ChevronDownIcon, ChevronRight, SlashIcon } from 'lucide-react';
import {
  type ComponentProps,
  Fragment,
  useCallback,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation, useRouteLoaderData } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { cn } from '~/lib/utils';
import type { loader as promptLoader } from '~/routes/prompts.promptId';
import type { loader as snippetLoader } from '~/routes/snippets.snippetId';

const SECTIONS = [
  { name: 'Analytics', path: '/analytics' },
  { name: 'Team', path: '/team' },
  { name: 'Prompts', path: '/prompts' },
  { name: 'Snippets', path: '/snippets' },
  { name: 'Settings', path: '/settings' },
];

const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const Breadcrumb = ({ className, ...props }: ComponentProps<'nav'>) => (
  <nav
    aria-label="breadcrumb"
    data-slot="breadcrumb"
    className={cn('min-w-0 flex-1', className)}
    {...props}
  />
);

export const BreadcrumbWithDropdown = () => {
  const location = useLocation();
  const promptData = useRouteLoaderData<typeof promptLoader>('prompt-detail');
  const snippetData =
    useRouteLoaderData<typeof snippetLoader>('snippet-detail');

  const segments = location.pathname.split('/').filter(Boolean);

  const currentSection = segments[0] || '';
  const activeSection = SECTIONS.find(
    (s) => s.path.slice(1).toLowerCase() === currentSection.toLowerCase(),
  );

  const folder = promptData?.folder ?? snippetData?.folder;

  const deepSegments = segments
    .slice(1)
    .reduce<Array<{ label: string; path: string }>>((acc, segment, idx) => {
      const path = `/${segments.slice(0, idx + 2).join('/')}`;

      if (folder && segment === folder.id) {
        if (folder.name === 'Untitled') {
          return acc;
        }
        acc.push({ label: folder.name, path });
      } else if (promptData?.prompt && segment === promptData.prompt.id) {
        acc.push({ label: promptData.prompt.name, path });
      } else if (snippetData?.snippet && segment === snippetData.snippet.id) {
        acc.push({ label: snippetData.snippet.name, path });
      } else {
        acc.push({ label: toTitleCase(segment), path });
      }

      return acc;
    }, []);

  // Overflow detection: hide the last deep segment (entity name) when
  // the breadcrumb would overflow, keeping it strictly single-line.
  const [hideLastSegment, setHideLastSegment] = useState(false);
  const hideRef = useRef(false);
  const lastSegmentWidthRef = useRef(0);
  const listElRef = useRef<HTMLOListElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Reset when route changes so the new entity name gets a fresh check
  const prevPathRef = useRef(location.pathname);
  if (prevPathRef.current !== location.pathname) {
    prevPathRef.current = location.pathname;
    hideRef.current = false;
    setHideLastSegment(false);
  }

  const checkOverflow = useCallback(() => {
    const el = listElRef.current;
    if (!el) return;

    // Batch all layout reads — avoid getComputedStyle inside the loop
    // to prevent forced synchronous reflow per child.
    const gap = parseFloat(getComputedStyle(el).columnGap || '0');
    const containerWidth = el.clientWidth;

    // Single pass: elements with display:none have offsetWidth === 0
    let contentWidth = 0;
    let visibleCount = 0;
    for (let i = 0; i < el.children.length; i++) {
      const w = (el.children[i] as HTMLElement).offsetWidth;
      if (w === 0) continue;
      contentWidth += w;
      visibleCount++;
    }
    if (visibleCount > 1) contentWidth += gap * (visibleCount - 1);

    // Write phase — state updates only
    if (!hideRef.current) {
      if (contentWidth > containerWidth) {
        hideRef.current = true;
        setHideLastSegment(true);
      }
    } else {
      const freeSpace = containerWidth - contentWidth;
      if (freeSpace >= lastSegmentWidthRef.current) {
        hideRef.current = false;
        setHideLastSegment(false);
      }
    }
  }, []);

  // Ref callback for the breadcrumb list — sets up ResizeObserver
  const listRef = useCallback(
    (el: HTMLOListElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      listElRef.current = el;
      if (!el) return;

      const observer = new ResizeObserver(checkOverflow);
      observer.observe(el);
      observerRef.current = observer;
    },
    [checkOverflow],
  );

  // Ref callback for the last segment — measures its width and triggers
  // an overflow check once it's in the layout
  const lastItemRef = useCallback(
    (el: HTMLLIElement | null) => {
      if (el) {
        const separator = el.previousElementSibling as HTMLElement | null;
        const sepWidth = separator ? separator.offsetWidth : 0;
        lastSegmentWidthRef.current = el.offsetWidth + sepWidth + 24;
        requestAnimationFrame(checkOverflow);
      }
    },
    [checkOverflow],
  );

  const lastSegmentIndex = deepSegments.length - 1;

  return (
    <Breadcrumb>
      <BreadcrumbList ref={listRef}>
        {/* Home link - hidden on mobile */}
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <NavLink to="/dashboard">Home</NavLink>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {activeSection && (
          <>
            {/* Separator after Home - hidden on mobile */}
            <BreadcrumbSeparator className="hidden sm:block">
              <SlashIcon />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 focus:outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5">
                  {activeSection.name}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {SECTIONS.filter((s) => s.path !== activeSection.path).map(
                    (section) => (
                      <DropdownMenuItem key={section.path} asChild>
                        <NavLink to={section.path}>{section.name}</NavLink>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>

            {/* Deep segments - hidden on mobile, show only last one on small screens */}
            {deepSegments.map(({ label, path }, index) => {
              const isLast = index === lastSegmentIndex;

              // Hide the last segment (entity name) when it would cause overflow
              if (isLast && hideLastSegment) return null;

              return (
                <Fragment key={path}>
                  <BreadcrumbSeparator
                    className={cn(
                      index < deepSegments.length - 1
                        ? 'hidden md:block'
                        : 'hidden sm:block',
                    )}
                  >
                    <SlashIcon />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem
                    ref={isLast ? lastItemRef : undefined}
                    className={cn(
                      index < deepSegments.length - 1
                        ? 'hidden md:inline-flex'
                        : 'hidden sm:inline-flex',
                    )}
                  >
                    <BreadcrumbLink asChild>
                      <NavLink
                        to={path}
                        className="max-w-32 truncate sm:max-w-48"
                      >
                        {label}
                      </NavLink>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const BreadcrumbList = ({ className, ...props }: ComponentProps<'ol'>) => (
  <ol
    data-slot="breadcrumb-list"
    className={cn(
      'text-muted-foreground flex flex-nowrap items-center gap-1.5 text-sm overflow-hidden sm:gap-2.5',
      className,
    )}
    {...props}
  />
);

const BreadcrumbItem = ({ className, ...props }: ComponentProps<'li'>) => (
  <li
    data-slot="breadcrumb-item"
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
);

const BreadcrumbLink = ({
  asChild,
  className,
  ...props
}: ComponentProps<'a'> & {
  asChild?: boolean;
}) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn('hover:text-foreground transition-colors', className)}
      {...props}
    />
  );
};

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: ComponentProps<'li'>) => (
  <li
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden="true"
    className={cn('[&>svg]:size-3.5', className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
