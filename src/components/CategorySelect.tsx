import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { log } from "../lib/log";

interface Category {
  id: string;
  name: string;
}

interface CategorySelectProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categories: Category[];
  onCategoryCreated?: (category: Category) => void;
  disabled?: boolean;
}

/**
 * CategorySelect Component
 * 
 * Reusable category selector with inline creation.
 * Allows users to select existing categories or create new ones seamlessly.
 */
export default function CategorySelect({
  value,
  onChange,
  categories,
  onCategoryCreated,
  disabled = false,
}: CategorySelectProps) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating mode is activated
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Handle select change
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === "__create_new__") {
      // User wants to create a new category
      setIsCreating(true);
      setNewCategoryName("");
      setCreatingError(null);
    } else if (selectedValue === "") {
      // No category selected
      onChange(null);
    } else {
      // Existing category selected
      onChange(selectedValue);
    }
  };

  // Handle creating new category
  const handleCreateCategory = async () => {
    if (!user) {
      setCreatingError("You must be logged in to create categories");
      return;
    }

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCreatingError("Category name is required");
      return;
    }

    // Check for duplicates (case-insensitive)
    const duplicate = categories.find(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setCreatingError("A category with this name already exists");
      return;
    }

    setIsCreatingCategory(true);
    setCreatingError(null);

    try {
      // Insert new category
      const { data, error } = await supabase
        .from("categories")
        .insert([
          {
            name: trimmedName,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        log.error("Error creating category:", error);
        setCreatingError("Failed to create category. Please try again.");
        setIsCreatingCategory(false);
        return;
      }

      // Notify parent of new category
      if (onCategoryCreated) {
        onCategoryCreated(data);
      }

      // Select the new category
      onChange(data.id);

      // Reset creating state
      setIsCreating(false);
      setNewCategoryName("");
      setCreatingError(null);
    } catch (err) {
      log.error("Unexpected error creating category:", err);
      setCreatingError("An unexpected error occurred");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Handle cancel creating
  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewCategoryName("");
    setCreatingError(null);
    // Reset select to previous value or empty
    onChange(value);
  };

  // Handle input blur - save if name is valid
  const handleInputBlur = () => {
    if (newCategoryName.trim() && !creatingError) {
      handleCreateCategory();
    } else if (!newCategoryName.trim()) {
      // Cancel if empty
      handleCancelCreate();
    }
  };

  // Handle input keydown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateCategory();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelCreate();
    }
  };

  return (
    <div className="w-full">
      {!isCreating ? (
        <select
          value={value || ""}
          onChange={handleSelectChange}
          disabled={disabled}
          className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-base text-text focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value="__create_new__">+ Create new category</option>
        </select>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                setCreatingError(null);
              }}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter category name"
              disabled={isCreatingCategory}
              maxLength={50}
              className="flex-1 rounded-lg border border-accent/60 bg-bg/40 px-4 py-3 text-base text-text placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2 sm:text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={isCreatingCategory || !newCategoryName.trim()}
              className="rounded-lg border border-accent/60 bg-accent/15 px-4 py-3 text-sm font-medium text-accent transition-colors active:bg-accent/20 disabled:opacity-50 sm:py-2 hover:border-accent hover:bg-accent/20"
            >
              {isCreatingCategory ? "..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancelCreate}
              disabled={isCreatingCategory}
              className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-3 text-sm font-medium text-text transition-colors active:bg-surface/50 disabled:opacity-50 sm:py-2 hover:border-accent/60 hover:bg-surface/50"
            >
              Cancel
            </button>
          </div>
          {creatingError && (
            <p className="text-xs text-red-400">{creatingError}</p>
          )}
          <p className="text-xs text-text/50">
            Press Enter to save, Escape to cancel
          </p>
        </div>
      )}
    </div>
  );
}
