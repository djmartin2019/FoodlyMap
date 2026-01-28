import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import EditLocationModal from "./EditLocationModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category_id?: string | null;
  category_name?: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

interface LocationsTableProps {
  locations: Location[];
  categories: Category[];
  loading?: boolean;
  onUpdate?: (locationId: string, name: string, categoryId: string | null) => Promise<void>;
  onDelete?: (locationId: string) => Promise<void>;
  onCategoryCreated?: (category: Category) => void;
  onViewOnMap?: () => void;
}

// Custom global filter function that searches name and category
const globalFilterFn = (row: any, _columnId: string, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const name = (row.original.name || "").toLowerCase();
  const categoryName = (row.original.category_name || "").toLowerCase();
  return name.includes(search) || categoryName.includes(search);
};

// Table Toolbar Component
function TableToolbar({
  globalFilter,
  setGlobalFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  resultCount,
  hasActiveFilters,
  onClearFilters,
}: {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  categoryFilter: string | null;
  setCategoryFilter: (value: string | null) => void;
  categories: Category[];
  resultCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  const [searchValue, setSearchValue] = useState(globalFilter);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      setGlobalFilter(value);
    }, 200);
    setDebounceTimer(timer);
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search locations..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-2 text-sm text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter || ""}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="rounded-lg border border-surface/60 bg-bg/40 px-3 py-2 text-sm text-text focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="rounded-lg border border-surface/60 bg-surface/30 px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-text/50">
        {resultCount} {resultCount === 1 ? "location" : "locations"}
      </div>
    </div>
  );
}

// Mobile Location Card Component
function MobileLocationCard({
  location,
  onView,
  onEdit,
  onDelete,
}: {
  location: Location;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-lg border border-surface/60 bg-bg/40 p-3">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-text">{location.name}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {location.category_name ? (
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {location.category_name}
            </span>
          ) : null}
          <span className="text-xs text-text/50">{formatDate(location.created_at)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 rounded-lg border border-accent/60 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors active:bg-accent/20"
        >
          View
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-lg border border-surface/60 bg-surface/30 px-3 py-1.5 text-xs font-medium text-text transition-colors active:bg-surface/50"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors active:bg-red-500/20"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function LocationsTable({
  locations,
  categories,
  loading,
  onUpdate,
  onDelete,
  onCategoryCreated,
  onViewOnMap,
}: LocationsTableProps) {
  const navigate = useNavigate();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Format date helper
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  // Handle "View on Map" click
  const handleViewOnMap = useCallback(
    (location: Location) => {
      if (onViewOnMap) {
        onViewOnMap();
      }
      navigate({
        to: "/dashboard",
        search: {
          locationId: location.id,
          lat: location.latitude,
          lng: location.longitude,
        },
      });
    },
    [navigate, onViewOnMap]
  );

  // Handle edit
  const handleEdit = useCallback((location: Location) => {
    setEditingLocation(location);
    setActionError(null);
  }, []);

  // Handle save update
  const handleSaveUpdate = useCallback(
    async (locationId: string, name: string, categoryId: string | null) => {
      if (!onUpdate) return;

      setActionLoading(true);
      setActionError(null);

      try {
        await onUpdate(locationId, name, categoryId);
        setEditingLocation(null);
        setActionError(null);
      } catch (err) {
        console.error("Error updating location:", err);
        setActionError("Failed to update location. Please try again.");
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [onUpdate]
  );

  // Handle delete
  const handleDelete = useCallback((location: Location) => {
    setDeletingLocation(location);
    setActionError(null);
  }, []);

  // Handle confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!onDelete || !deletingLocation) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await onDelete(deletingLocation.id);
      setDeletingLocation(null);
    } catch (err) {
      setActionError("Failed to delete location. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }, [onDelete, deletingLocation]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setGlobalFilter("");
    setCategoryFilter(null);
  }, []);

  // Filter locations by category before passing to table
  const filteredLocations = useMemo(() => {
    if (!categoryFilter) return locations;
    return locations.filter((loc) => loc.category_id === categoryFilter);
  }, [locations, categoryFilter]);

  // Define columns
  const columns = useMemo<ColumnDef<Location>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: (info) => (
          <span className="text-sm text-text">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "category_name",
        header: "Category",
        cell: (info) => {
          const categoryName = info.getValue() as string | null;
          return categoryName ? (
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {categoryName}
            </span>
          ) : (
            <span className="text-xs text-text/40">—</span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: (info) => (
          <span className="text-xs text-text/70">{formatDate(info.getValue() as string)}</span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => {
          const location = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => handleViewOnMap(location)}
                className="rounded border border-accent/60 bg-accent/15 px-2 py-1 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
                title="View on Map"
              >
                View
              </button>
              {onUpdate && (
                <button
                  onClick={() => handleEdit(location)}
                  className="rounded border border-surface/60 bg-surface/30 px-2 py-1 text-xs font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
                  title="Edit"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => handleDelete(location)}
                  className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20"
                  title="Delete"
                >
                  Delete
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [formatDate, handleViewOnMap, handleEdit, handleDelete, onUpdate, onDelete]
  );

  // Initialize table
  const table = useReactTable({
    data: filteredLocations,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasActiveFilters = globalFilter !== "" || categoryFilter !== null;
  const resultCount = table.getFilteredRowModel().rows.length;

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
  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8 text-center">
        <p className="text-text/60">No locations yet. Add your first place on the map!</p>
      </div>
    );
  }

  // No results after filtering
  if (resultCount === 0 && hasActiveFilters) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8">
        <TableToolbar
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          resultCount={0}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
        <div className="text-center py-8">
          <p className="text-text/60 mb-4">No locations found</p>
          <button
            onClick={handleClearFilters}
            className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
          >
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface/60 bg-surface/30">
      <div className="p-4">
        <TableToolbar
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          resultCount={resultCount}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />

        {/* Desktop: Table layout */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-surface/60">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-3 py-2 text-left text-xs font-semibold text-text/60 ${
                        header.id === "actions" ? "text-right" : ""
                      }`}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort() ? "cursor-pointer select-none" : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-text/40">
                              {{
                                asc: " ↑",
                                desc: " ↓",
                              }[header.column.getIsSorted() as string] ?? " ⇅"}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-surface/40 transition-colors hover:bg-surface/20"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card layout */}
        <div className="space-y-2 md:hidden">
          {table.getRowModel().rows.map((row) => {
            const location = row.original;
            return (
              <MobileLocationCard
                key={location.id}
                location={location}
                onView={() => handleViewOnMap(location)}
                onEdit={onUpdate ? () => handleEdit(location) : undefined}
                onDelete={onDelete ? () => handleDelete(location) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editingLocation && onUpdate && (
        <EditLocationModal
          location={editingLocation}
          categories={categories}
          onSave={handleSaveUpdate}
          onCancel={() => {
            setEditingLocation(null);
            setActionError(null);
          }}
          loading={actionLoading}
          onCategoryCreated={onCategoryCreated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingLocation && onDelete && (
        <DeleteConfirmationDialog
          locationName={deletingLocation.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeletingLocation(null);
            setActionError(null);
          }}
          loading={actionLoading}
        />
      )}

      {/* Action Error Message */}
      {actionError && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 shadow-neon-sm">
          {actionError}
        </div>
      )}
    </div>
  );
}
