import { Slot } from '@radix-ui/react-slot';
import { ChevronDownIcon, ChevronRight, SlashIcon } from 'lucide-react';
import { type ComponentProps, Fragment } from 'react';
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

const Breadcrumb = ({ ...props }: ComponentProps<'nav'>) => (
  <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
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

  return (
    <Breadcrumb>
      <BreadcrumbList>
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
                  {SECTIONS.filter(
                    (s) => s.path !== activeSection.path,
                  ).map((section) => (
                    <DropdownMenuItem key={section.path} asChild>
                      <NavLink to={section.path}>{section.name}</NavLink>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>

            {/* Deep segments - hidden on mobile, show only last one on small screens */}
            {deepSegments.map(({ label, path }, index) => (
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
            ))}
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
      'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
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
