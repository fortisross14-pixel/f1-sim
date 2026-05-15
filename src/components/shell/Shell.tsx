import { useState } from 'react';
import { useGame } from '../../GameContext';
import { Header } from './Header';
import { TopTabs, TopTab } from './TopTabs';
import { WorldChampionshipTab } from '../tabs/WorldChampionshipTab';
import { PilotsTab } from '../tabs/PilotsTab';
import { TeamsTab } from '../tabs/TeamsTab';
import { HistoryTab } from '../tabs/HistoryTab';
import { RaceWeekendOverlay } from '../race/RaceWeekendOverlay';

// Top-level in-game shell. Decides whether to render the persistent menu
// or hand off to the race weekend overlay based on the game phase.
export function Shell() {
  const { state } = useGame();
  if (
    state.phase === 'pre_race' ||
    state.phase === 'qualifying_q1' ||
    state.phase === 'qualifying_q2' ||
    state.phase === 'race_results'
  ) {
    return <RaceWeekendOverlay />;
  }
  return <Menu />;
}

function Menu() {
  const [tab, setTab] = useState<TopTab>('wc');
  return (
    <div className="app">
      <Header />
      <TopTabs tab={tab} onChange={setTab} />
      <main>
        {tab === 'wc' && <WorldChampionshipTab />}
        {tab === 'pilots' && <PilotsTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'history' && <HistoryTab />}
      </main>
    </div>
  );
}
