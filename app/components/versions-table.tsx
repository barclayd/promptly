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
import { cn } from '~/lib/utils';
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

export type Version = {
  version: number;
  published_by: string | null;
  published_at: number | null;
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

const ViewVersionAction = ({ version }: { version: number }) => {
  const [, setSearchParams] = useSearchParams();

  const handleViewVersion = () => {
    setSearchParams({ version: version.toString() });
  };

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
    accessorKey: 'version',
    header: () => <span className="text-xs">Version</span>,
    cell: ({ row }) => (
      <span className="text-xs font-mono whitespace-nowrap">
        {row.original.version}.0.0
      </span>
    ),
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
    cell: ({ row }) => <ViewVersionAction version={row.original.version} />,
    meta: { className: 'w-[40px]' },
  },
];

export const VersionsTable = ({ versions }: { versions: Version[] }) => {
  const table = useReactTable({
    data: versions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.version.toString(),
  });

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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
