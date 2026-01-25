import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  onViewOnMap?: () => void; // Callback to switch to map view (for mobile)
}

/**
 * LocationsTable Component
 * 
 * Displays user locations in a table format with:
 * - Location Name
 * - Category (if assigned)
 * - Created Date (human-readable)
 * - Action: "View on Map"
 * 
 * Mobile: Stacks rows vertically for readability
 * Desktop: Traditional table layout
 */
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

  // Format date to human-readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Handle "View on Map" click
  const handleViewOnMap = (location: Location) => {
    // Switch to map view on mobile (on desktop, both views are visible)
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
  };

  // Handle edit
  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setActionError(null);
  };

  // Handle save update
  const handleSaveUpdate = async (locationId: string, name: string, categoryId: string | null) => {
    if (!onUpdate) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      await onUpdate(locationId, name, categoryId);
      // Close modal on success
      setEditingLocation(null);
      setActionError(null);
    } catch (err) {
      console.error("Error updating location:", err);
      setActionError("Failed to update location. Please try again.");
      // Don't close modal on error - let user try again
      throw err; // Re-throw so modal can handle it
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete
  const handleDelete = (location: Location) => {
    setDeletingLocation(location);
    setActionError(null);
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-surface/60 bg-surface/30 p-8 text-center">
        <p className="text-text/60">No locations yet. Add your first place on the map!</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-surface/60 bg-surface/30">
      {/* Desktop: Table layout */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-surface/60">
              <th className="px-4 py-3 text-left text-sm font-semibold text-text/60">Location Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text/60">Category</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text/60">Created</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-text/60">Action</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} className="border-b border-surface/40 transition-colors hover:bg-surface/20">
                <td className="px-4 py-4 text-text">{location.name}</td>
                <td className="px-4 py-4">
                  {location.category_name ? (
                    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      {location.category_name}
                    </span>
                  ) : (
                    <span className="text-text/40">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-text/70">{formatDate(location.created_at)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleViewOnMap(location)}
                      className="rounded-lg border border-accent/60 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
                    >
                      View
                    </button>
                    {onUpdate && (
                      <button
                        onClick={() => handleEdit(location)}
                        className="rounded-lg border border-surface/60 bg-surface/30 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => handleDelete(location)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Stacked card layout - no horizontal scrolling */}
      <div className="space-y-3 p-4 sm:hidden">
        {locations.map((location) => (
          <div
            key={location.id}
            className="rounded-lg border border-surface/60 bg-bg/40 p-4 shadow-neon-sm"
          >
            <div className="mb-3">
              <h3 className="text-base font-semibold text-text">{location.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {location.category_name ? (
                  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                    {location.category_name}
                  </span>
                ) : null}
                <span className="text-xs text-text/50">{formatDate(location.created_at)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleViewOnMap(location)}
                className="w-full rounded-lg border border-accent/60 bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition-colors active:bg-accent/20"
              >
                View on Map
              </button>
              {(onUpdate || onDelete) && (
                <div className="flex gap-2">
                  {onUpdate && (
                    <button
                      onClick={() => handleEdit(location)}
                      className="flex-1 rounded-lg border border-surface/60 bg-surface/30 px-4 py-2.5 text-sm font-medium text-text transition-colors active:bg-surface/50"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(location)}
                      className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors active:bg-red-500/20"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
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
