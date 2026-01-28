'use client';

import { IconDotsVertical, IconEye } from '@tabler/icons-react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination';
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
  updated_at: number | null;
  updated_by: string | null;
  published_at: number | null;
  published_by: string | null;
  created_by: string | null;
};

const formatVersion = (v: Version): string | null => {
  if (v.major === null || v.minor === null || v.patch === null) {
    return null;
  }
  return `${v.major}.${v.minor}.${v.patch}`;
};

const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
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
    meta: { className: 'w-[60px]' },
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
    meta: { className: 'w-[70px]' },
  },
  {
    id: 'last_updated',
    header: () => <span className="text-xs">Last Updated</span>,
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.updated_at
            ? formatDateTime(row.original.updated_at)
            : '-'}
        </span>
        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[100px]">
          {row.original.updated_by ?? '-'}
        </span>
      </div>
    ),
    meta: { className: 'w-[130px]' },
  },
  {
    accessorKey: 'published_at',
    header: () => <span className="text-xs">Published</span>,
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.published_at
            ? formatDateTime(row.original.published_at)
            : '-'}
        </span>
        {row.original.published_at && (
          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[100px]">
            {row.original.published_by ?? '-'}
          </span>
        )}
      </div>
    ),
    meta: { className: 'w-[130px]' },
  },
  {
    accessorKey: 'created_by',
    header: () => <span className="text-xs">Created By</span>,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground truncate block max-w-[100px]">
        {row.original.created_by ?? '-'}
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
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => formatVersion(row) ?? 'draft',
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
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
        <div className="overflow-x-auto">
          <Table className="min-w-[520px]">
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
      {table.getPageCount() > 1 && (
        <Pagination className="pt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              />
            </PaginationItem>
            {(() => {
              const currentPage = table.getState().pagination.pageIndex;
              const totalPages = table.getPageCount();
              const pages: (number | 'ellipsis')[] = [];

              if (totalPages <= 5) {
                for (let i = 0; i < totalPages; i++) {
                  pages.push(i);
                }
              } else {
                pages.push(0);
                if (currentPage > 2) {
                  pages.push('ellipsis');
                }
                const start = Math.max(1, currentPage - 1);
                const end = Math.min(totalPages - 2, currentPage + 1);
                for (let i = start; i <= end; i++) {
                  pages.push(i);
                }
                if (currentPage < totalPages - 3) {
                  pages.push('ellipsis');
                }
                pages.push(totalPages - 1);
              }

              return pages.map((page, idx) =>
                page === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={currentPage === page}
                      onClick={() => table.setPageIndex(page)}
                    >
                      {page + 1}
                    </PaginationLink>
                  </PaginationItem>
                ),
              );
            })()}
            <PaginationItem>
              <PaginationNext
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
