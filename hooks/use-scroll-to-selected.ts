import { useEffect } from "react";

export function useScrollToSelected(id: string | null | undefined) {
  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => {
      // Find the element by ID and scroll it into view.
      // We specifically look for elements that represent the list item.
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [id]);
}
