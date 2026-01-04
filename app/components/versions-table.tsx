'use client';

import { IconDotsVertical, IconEye } from '@tabler/icons-react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useSearchParams } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { cn } from '~/lib/utils';

export type Version = {
  major: number | null;
  minor: number | null;
  patch: number | null;
  published_by: string | null;
  published_at: number | null;
};

const formatVersion = (v: Version): string | null => {
  if (v.major === null || v.minor === null || v.patch === null) {
    return null;
  }
  return `${v.major}.${v.minor}.${v.patch}`;
};

const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const ViewVersionAction = ({ version }: { version: Version }) => {
  const [, setSearchParams] = useSearchParams();
  const versionString = formatVersion(version);

  const handleViewVersion = () => {
    if (versionString !== null) {
      setSearchParams({ version: versionString });
    }
  };

  // Don't show action menu for drafts (version is null)
  if (versionString === null) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted text-muted-foreground size-6 p-0"
          size="icon"
        >
          <IconDotsVertical className="size-3.5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={handleViewVersion}>
          <IconEye className="size-3.5" />
          View version
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const columns: ColumnDef<Version>[] = [
  {
    id: 'version',
    header: () => <span className="text-xs">Version</span>,
    cell: ({ row }) => {
      const versionString = formatVersion(row.original);
      return (
        <span className="text-xs font-mono whitespace-nowrap">
          {versionString ?? 'Latest'}
        </span>
      );
    },
    meta: { className: 'w-[70px]' },
  },
  {
    id: 'status',
    header: () => <span className="text-xs">Status</span>,
    cell: ({ row }) => (
      <Badge
        variant={row.original.published_at ? 'default' : 'outline'}
        className="text-[10px] px-1.5 py-0 font-normal whitespace-nowrap"
      >
        {row.original.published_at ? 'Published' : 'Draft'}
      </Badge>
    ),
    meta: { className: 'w-[72px]' },
  },
  {
    accessorKey: 'published_at',
    header: () => <span className="text-xs">Published</span>,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {row.original.published_at
          ? formatDateTime(row.original.published_at)
          : '-'}
      </span>
    ),
    meta: { className: 'w-[105px]' },
  },
  {
    accessorKey: 'published_by',
    header: () => <span className="text-xs">Created By</span>,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
        {row.original.published_by ?? '-'}
      </span>
    ),
    meta: { className: 'w-auto' },
  },
  {
    id: 'actions',
    cell: ({ row }) => <ViewVersionAction version={row.original} />,
    meta: { className: 'w-[40px]' },
  },
];

export const VersionsTable = ({ versions }: { versions: Version[] }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentVersion = searchParams.get('version');

  const table = useReactTable({
    data: versions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => formatVersion(row) ?? 'draft',
  });

  const handleRowClick = (version: Version) => {
    const versionString = formatVersion(version);
    if (versionString !== null) {
      // Navigate to published version
      setSearchParams({ version: versionString });
    } else {
      // Navigate to latest (draft) by clearing version param
      setSearchParams({});
    }
  };

  if (versions.length === 0) {
    return (
      <div className="px-2 py-4 text-sm text-muted-foreground">
        No versions yet.
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | { className?: string }
                    | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-8 px-2 first:pl-3 last:pr-2',
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const versionString = formatVersion(row.original);
              const isCurrentVersion =
                versionString === currentVersion ||
                (versionString === null && currentVersion === null);

              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isCurrentVersion
                      ? 'bg-muted hover:bg-muted'
                      : 'hover:bg-muted/50',
                  )}
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | { className?: string }
                      | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'h-9 px-2 py-1.5 first:pl-3 last:pr-2 overflow-hidden',
                          meta?.className,
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
