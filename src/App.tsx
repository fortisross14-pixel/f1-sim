import { useState } from 'react';
import { GameProvider } from './GameContext';
import { AudioProvider } from './audio';
import { Home, LoadedUniverse } from './components/home/Home';
import { Shell } from './components/shell/Shell';

import './App.css';

// Top-level router. Either we're on the Home screen (no universe loaded)
// or we have a universe in play and render the in-game Shell wrapped in
// a GameProvider with that universe's state.
export default function App() {
  const [loaded, setLoaded] = useState<LoadedUniverse | null>(null);

  return (
    <AudioProvider>
      {loaded === null ? (
        <Home onLoad={setLoaded} />
      ) : (
        <GameProvider
          initialState={loaded.state}
          universeId={loaded.id}
          universeName={loaded.name}
          onExit={() => setLoaded(null)}
        >
          <Shell />
        </GameProvider>
      )}
    </AudioProvider>
  );
}
