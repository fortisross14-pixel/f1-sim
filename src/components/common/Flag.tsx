// Flag — renders a country flag SVG via the flag-icons CSS library
// (loaded from CDN in index.html). `code` is ISO alpha-2 (e.g. "GB", "IT").
// The flag-icons class is lowercase by convention.
export function Flag({ code, title, small }: { code: string; title?: string; small?: boolean }) {
  return (
    <span
      className={`fi fi-${code.toLowerCase()}${small ? ' fi-small' : ''}`}
      title={title}
      aria-label={title}
    />
  );
}
