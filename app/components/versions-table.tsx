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

export type Version = {
  version: number;
  published_by: string | null;
  published_at: number | null;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
    size: 70,
    minSize: 70,
    maxSize: 70,
  },
  {
    accessorKey: 'published_by',
    header: () => <span className="text-xs">Created By</span>,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground truncate block min-w-0">
        {row.original.published_by ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'published_at',
    header: () => <span className="text-xs">Status</span>,
    cell: ({ row }) =>
      row.original.published_at ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.original.published_at)}
        </span>
      ) : (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 font-normal whitespace-nowrap"
        >
          Draft
        </Badge>
      ),
    size: 90,
    minSize: 90,
  },
  {
    id: 'actions',
    cell: ({ row }) => <ViewVersionAction version={row.original.version} />,
    size: 32,
    minSize: 32,
    maxSize: 32,
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
        <Table className="table-fixed w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const size = header.column.columnDef.size;
                  const hasFixedSize = size !== undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className="h-8 px-2 first:pl-3 last:pr-2"
                      style={hasFixedSize ? { width: size } : undefined}
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
                  const size = cell.column.columnDef.size;
                  const hasFixedSize = size !== undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className="h-9 px-2 py-1.5 first:pl-3 last:pr-2 overflow-hidden"
                      style={hasFixedSize ? { width: size } : undefined}
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
