import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

describe("DeleteConfirmationDialog", () => {
  it("renders the dialog with location name", () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        locationName="Test Location"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Delete Location")).toBeInTheDocument();
    expect(screen.getByText(/Test Location/)).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        locationName="Test Location"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm when delete button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn().mockResolvedValue(undefined);
    const mockOnCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        locationName="Test Location"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("shows loading state when loading is true", () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        locationName="Test Location"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        loading={true}
      />
    );

    expect(screen.getByRole("button", { name: /deleting/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
