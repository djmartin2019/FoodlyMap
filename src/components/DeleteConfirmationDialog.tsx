interface DeleteConfirmationDialogProps {
  locationName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * DeleteConfirmationDialog Component
 * 
 * Confirmation dialog for deleting a location.
 * Uses subdued red styling for destructive action.
 */
export default function DeleteConfirmationDialog({
  locationName,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmationDialogProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      // Error handling is done in parent component
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-surface/30 p-6 shadow-neon-md sm:p-8">
        <h3 className="mb-4 text-xl font-semibold text-red-400 sm:text-2xl">Delete Location</h3>
        <p className="mb-6 text-sm text-text/80 sm:text-base">
          Are you sure you want to remove <span className="font-medium text-text">{locationName}</span> from your map?
        </p>
        <p className="mb-6 text-xs text-text/60">
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-surface/60 bg-surface/30 px-4 py-3 text-base font-medium text-text transition-colors active:bg-surface/50 disabled:opacity-50 sm:py-2 sm:text-sm hover:border-accent/60 hover:bg-surface/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-base font-medium text-red-400 transition-colors active:bg-red-500/20 disabled:opacity-50 sm:py-2 sm:text-sm hover:border-red-500 hover:bg-red-500/20"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
