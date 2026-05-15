// Sortable table column header. Clicking calls onClick with the key.
// The arrow indicator (▲/▼) appears only when this column is the active sort.
export function SortHeader<T extends string>({ label, k, curr, asc, onClick }: {
  label: string;
  k: T;
  curr: T;
  asc: boolean;
  onClick: (k: T) => void;
}) {
  return (
    <th onClick={() => onClick(k)} className="sortable">
      {label} {k === curr ? (asc ? '▲' : '▼') : ''}
    </th>
  );
}
