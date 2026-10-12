/**
 * Whether a single-character shortcut (j, x, 1–9, ?…) may act on this key press. They can be switched
 * off on Account (WCAG 2.1.4: speech input and screen-reader focus mode type letters); the root layout
 * prints the choice on <html data-shortcuts>. They also stay quiet while a dialog is open or you type.
 * Shortcuts with a modifier (⌘K) are not single-character and always work.
 */
export function singleKeysAllowed(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return false;
  if (document.documentElement.dataset.shortcuts === "off") return false;
  if (document.querySelector("[aria-modal='true']")) return false;
  const target = e.target instanceof Element ? e.target : null;
  return !target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']");
}
