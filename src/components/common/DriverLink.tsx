import { Driver } from '../../sim/types';

// Renders a driver's name as a clickable link, looking up the driver by ID from
// a supplied list. Used in calendar result cells, standings rows, etc.
// Renders an em-dash if the driver isn't found.
export function DriverLink({ id, drivers, onClick }: {
  id: string;
  drivers: Driver[];
  onClick: (d: Driver) => void;
}) {
  const d = drivers.find(x => x.id === id);
  if (!d) return <span>—</span>;
  return <button className="link-btn" onClick={() => onClick(d)}>{d.name}</button>;
}
