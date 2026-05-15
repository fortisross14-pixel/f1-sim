import { useState, useEffect } from 'react';
import { useGame } from '../../GameContext';
import { useAudio } from '../../audio';

// Top-right gear dropdown: Save now, audio toggle + volume, Back to Home.
// Closes when clicking outside the menu container.
export function GearMenu() {
  const { saveNow, exitToHome } = useGame();
  const { enabled, volume, setEnabled, setVolume, play } = useAudio();
  const [open, setOpen] = useState<boolean>(false);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);

  // Auto-close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('.gear-menu-container')) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleSave = () => {
    saveNow();
    setSavedFlash(true);
    play('click');
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="gear-menu-container">
      <button className="gear-btn" onClick={() => setOpen(o => !o)} title="Menu">⚙</button>
      {open && (
        <div className="gear-menu">
          <button onClick={handleSave}>
            {savedFlash ? '✓ Saved!' : '💾 Save now'}
          </button>
          <div className="gear-audio">
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
              />
              {' '}🔊 Audio
            </label>
            {enabled && (
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
              />
            )}
          </div>
          <button onClick={exitToHome}>🏠 Back to Home</button>
        </div>
      )}
    </div>
  );
}
