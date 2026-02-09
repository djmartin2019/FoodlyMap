import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo,useState } from "react";

export interface ListPlaceRow {
  list_place_id: string;
  place_id: string;
  name: string;
  address: string;
  note: string | null;
  added_at: string;
  sort_order: number | null;
  verified: boolean;
}

interface ListPlacesTableProps {
  rows: ListPlaceRow[];
  loading?: boolean;
  isOwner?: boolean;
  onRemove?: (listPlaceId: string) => void;
  removingId?: string | null;
}

// Custom global filter function that searches name and address
const globalFilterFn = (row: any, _columnId: string, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const name = (row.original.name || "").toLowerCase();
  const address = (row.original.address || "").toLowerCase();
  return name.includes(search) || address.includes(search);
};

export default function ListPlacesTable({
  rows,
  loading = false,
  isOwner = false,
  onRemove,
  removingId = null,
}: ListPlacesTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Format date helper
  const formatDate = useMemo(
    () => (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return dateString;
      }
    },
    []
  );

  // Define columns
  const columns = useMemo<ColumnDef<ListPlaceRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              Place
              {column.getIsSorted() && (
                <span className="text-accent/60 text-xs">
                  {column.getIsSorted() === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          );
        },
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-text">{info.getValue() as string}</span>
              {row.verified ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent flex-shrink-0"
                  title="Verified location"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Verified
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-500 flex-shrink-0"
                  title="Unverified location"
                >
                  Unverified
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "address",
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              Address
              {column.getIsSorted() && (
                <span className="text-accent/60 text-xs">
                  {column.getIsSorted() === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          );
        },
        cell: (info) => (
          <div className="text-sm text-text/70">{info.getValue() as string || "Address not available"}</div>
        ),
      },
      {
        accessorKey: "added_at",
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              Added
              {column.getIsSorted() && (
                <span className="text-accent/60 text-xs">
                  {column.getIsSorted() === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          );
        },
        cell: (info) => (
          <div className="text-sm text-text/60">{formatDate(info.getValue() as string)}</div>
        ),
      },
      ...(isOwner && onRemove
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Actions</div>,
              cell: (info: any) => {
                const row = info.row.original;
                return (
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => onRemove(row.list_place_id)}
                      disabled={removingId === row.list_place_id}
                      className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {removingId === row.list_place_id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [isOwner, onRemove, removingId, formatDate]
  );

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!globalFilter) return rows;
    const search = globalFilter.toLowerCase();
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.address.toLowerCase().includes(search)
    );
  }, [rows, globalFilter]);

  // Apply default sort if no manual sorting
  const dataWithDefaultSort = useMemo(() => {
    if (sorting.length > 0) {
      // Manual sorting - let TanStack Table handle it
      return filteredData;
    }
    // Default sort: sort_order ASC (nulls last), then added_at ASC
    return [...filteredData].sort((a, b) => {
      // First by sort_order (nulls last)
      if (a.sort_order !== null && b.sort_order !== null) {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
      } else if (a.sort_order !== null) {
        return -1;
      } else if (b.sort_order !== null) {
        return 1;
      }
      // Then by added_at ASC
      return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
    });
  }, [filteredData, sorting]);

  // Initialize table
  const table = useReactTable({
    data: dataWithDefaultSort,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn,
    enableGlobalFilter: false, // We handle filtering manually
  });

  const resultCount = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = globalFilter !== "";

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface/20" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8 text-center">
        <p className="text-text/60">This list is empty.</p>
      </div>
    );
  }

  // No results after filtering
  if (resultCount === 0 && hasActiveFilters) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search places..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-2 text-sm text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="text-center py-8">
          <p className="text-text/60 mb-4">No places found</p>
          <button
            onClick={() => setGlobalFilter("")}
            className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
          >
            Clear search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface/60 bg-surface/30">
      {/* Search input */}
      <div className="border-b border-surface/60 p-4">
          <input
            type="text"
            placeholder="Search places or addresses..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-2 text-sm text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        {hasActiveFilters && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-text/60">
              {resultCount} {resultCount === 1 ? "place" : "places"}
            </span>
            <button
              onClick={() => setGlobalFilter("")}
              className="text-xs text-accent/70 hover:text-accent transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-surface/60">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-semibold text-text"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-surface/60 last:border-b-0 transition-colors hover:bg-surface/20"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="space-y-3 p-4 md:hidden">
        {table.getRowModel().rows.map((row) => {
          const place = row.original;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-surface/60 bg-bg/40 p-4 transition-colors hover:border-surface/80"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-text flex-1">{place.name}</h3>
                {place.verified ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent flex-shrink-0"
                    title="Verified location"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-500 flex-shrink-0"
                    title="Unverified location"
                  >
                    Unverified
                  </span>
                )}
                {isOwner && onRemove && (
                  <button
                    onClick={() => onRemove(place.list_place_id)}
                    disabled={removingId === place.list_place_id}
                    className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {removingId === place.list_place_id ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
              {place.address && (
                <p className="mb-1 text-sm text-text/70">{place.address}</p>
              )}
              <p className="text-xs text-text/50">
                Added {formatDate(place.added_at)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
