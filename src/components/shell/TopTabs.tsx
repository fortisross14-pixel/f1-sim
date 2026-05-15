export type TopTab = 'wc' | 'pilots' | 'teams' | 'history';

// Persistent top-level tab navigation across in-game menu screens.
export function TopTabs({ tab, onChange }: { tab: TopTab; onChange: (t: TopTab) => void }) {
  return (
    <nav className="top-tabs">
      <button onClick={() => onChange('wc')} className={tab === 'wc' ? 'active' : ''}>
        World Championship
      </button>
      <button onClick={() => onChange('pilots')} className={tab === 'pilots' ? 'active' : ''}>
        Pilots
      </button>
      <button onClick={() => onChange('teams')} className={tab === 'teams' ? 'active' : ''}>
        Teams
      </button>
      <button onClick={() => onChange('history')} className={tab === 'history' ? 'active' : ''}>
        History
      </button>
    </nav>
  );
}
