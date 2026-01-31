/**
 * Safe DOM utilities for preventing XSS attacks
 * 
 * Use these functions instead of string interpolation with setHTML()
 * to ensure user-provided data is safely rendered as text.
 */

/**
 * Creates a safe DOM element for a place popup
 * All user-provided text is set via textContent (not innerHTML)
 * 
 * @param place - Place data to display
 * @param onAddToList - Optional callback for "Add to List" button
 * @returns HTMLElement ready for use with popup.setDOMContent()
 */
export function buildPlacePopupNode(
  place: {
    id: string;
    name: string;
    display_address?: string | null;
    category_name?: string | null;
  },
  onAddToList?: () => void
): HTMLElement {
  // Create container
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "4px";

  // Place name
  const nameEl = document.createElement("div");
  nameEl.style.fontSize = "14px";
  nameEl.style.fontWeight = "600";
  nameEl.style.color = "#e9fff2";
  nameEl.textContent = place.name; // Safe: textContent escapes HTML
  container.appendChild(nameEl);

  // Display address (if available)
  if (place.display_address) {
    const addressEl = document.createElement("div");
    addressEl.style.fontSize = "12px";
    addressEl.style.color = "rgba(233, 255, 242, 0.7)";
    addressEl.textContent = place.display_address; // Safe: textContent escapes HTML
    container.appendChild(addressEl);
  }

  // Category name (if available)
  if (place.category_name) {
    const categoryEl = document.createElement("div");
    categoryEl.style.fontSize = "12px";
    categoryEl.style.color = "rgba(57, 255, 136, 0.8)";
    categoryEl.textContent = place.category_name; // Safe: textContent escapes HTML
    container.appendChild(categoryEl);
  }

  // "Add to List" button (if callback provided)
  if (onAddToList) {
    const button = document.createElement("button");
    button.id = `add-to-list-${place.id}`;
    button.style.marginTop = "8px";
    button.style.padding = "6px 12px";
    button.style.background = "rgba(57, 255, 136, 0.15)";
    button.style.border = "1px solid rgba(57, 255, 136, 0.6)";
    button.style.borderRadius = "6px";
    button.style.color = "#39FF88";
    button.style.fontSize = "12px";
    button.style.fontWeight = "500";
    button.style.cursor = "pointer";
    button.style.transition = "all 0.2s";
    button.style.width = "100%";
    button.textContent = "Add to List"; // Safe: textContent

    // Hover effects
    button.addEventListener("mouseenter", () => {
      button.style.background = "rgba(57, 255, 136, 0.2)";
      button.style.borderColor = "#39FF88";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "rgba(57, 255, 136, 0.15)";
      button.style.borderColor = "rgba(57, 255, 136, 0.6)";
    });

    // Click handler
    button.addEventListener("click", () => {
      onAddToList();
    });

    container.appendChild(button);
  }

  return container;
}

/**
 * Creates a simple popup node for a location name
 * Used for demo/preview maps
 * 
 * @param locationName - Name of the location
 * @returns HTMLElement ready for use with popup.setDOMContent()
 */
export function buildSimplePopupNode(locationName: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "text-sm font-semibold text-text";
  container.textContent = locationName; // Safe: textContent escapes HTML
  return container;
}
