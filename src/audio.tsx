// Audio system: all sounds synthesized at runtime via the Web Audio API.
// No audio files, no external assets. Sounds are simple, functional, and free.
//
// Usage from any component:
//   const audio = useAudio();
//   audio.play('overtake');
//   audio.startEngineLoop();
//   audio.stopEngineLoop();
//
// The system respects the global Settings.audioEnabled / audioVolume preferences,
// and exposes setters that persist to localStorage.

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { loadSettings, saveSettings, Settings } from './save';

export type SoundCue =
  | 'overtake'        // a position gain mid-race
  | 'crash'           // DNF / incident
  | 'tick'            // light position-change tick during reveal
  | 'pole'            // pole position awarded
  | 'lights_out'      // 5 beeps then "go" — race start
  | 'checkered'       // race finish celebration
  | 'click'           // UI click
  | 'season_end'      // end-of-year fanfare
  | 'champion';       // world champion crowned

interface AudioContextValue {
  enabled: boolean;
  volume: number;
  setEnabled: (b: boolean) => void;
  setVolume: (v: number) => void;
  play: (cue: SoundCue) => void;
  startEngineLoop: () => void;
  stopEngineLoop: () => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineNodesRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode } | null>(null);

  // Persist settings whenever they change
  useEffect(() => { saveSettings(settings); }, [settings]);

  const getCtx = (): AudioContext | null => {
    if (!settings.audioEnabled) return null;
    if (!audioCtxRef.current) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        audioCtxRef.current = new AC();
      } catch {
        return null;
      }
    }
    // resume if suspended (Chrome autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  const setEnabled = useCallback((b: boolean) => {
    setSettings(s => ({ ...s, audioEnabled: b }));
    if (!b) {
      // Stop engine if running
      try {
        engineNodesRef.current?.osc1.stop();
        engineNodesRef.current?.osc2.stop();
        engineNodesRef.current?.lfo.stop();
      } catch { /* may already be stopped */ }
      engineNodesRef.current = null;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setSettings(s => ({ ...s, audioVolume: clamped }));
    // Live-update engine gain if running
    if (engineNodesRef.current) {
      engineNodesRef.current.gain.gain.value = clamped * 0.08;
    }
  }, []);

  // Tone helper: brief sine/triangle/sawtooth tone with envelope
  const tone = (ctx: AudioContext, freq: number, dur: number, type: OscillatorType = 'sine', vol = 1.0): void => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const v = settings.audioVolume * vol;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  };

  // Sweep helper: pitch glide from f1 → f2 over dur
  const sweep = (ctx: AudioContext, f1: number, f2: number, dur: number, type: OscillatorType = 'sawtooth', vol = 1.0): void => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, f2), ctx.currentTime + dur);
    const v = settings.audioVolume * vol;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };

  // Noise helper: white noise burst (for crashes)
  const noise = (ctx: AudioContext, dur: number, lowpass = 2000, vol = 1.0): void => {
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    const v = settings.audioVolume * vol;
    gain.gain.setValueAtTime(v, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  };

  const play = useCallback((cue: SoundCue) => {
    const ctx = getCtx();
    if (!ctx) return;
    switch (cue) {
      case 'click':
        tone(ctx, 1200, 0.04, 'square', 0.15);
        break;
      case 'tick':
        tone(ctx, 800, 0.05, 'sine', 0.25);
        break;
      case 'overtake':
        // Quick rising sweep — "whoosh" of overtake
        sweep(ctx, 400, 900, 0.18, 'sawtooth', 0.3);
        break;
      case 'crash':
        // White noise burst + low rumble
        noise(ctx, 0.4, 1500, 0.4);
        tone(ctx, 80, 0.5, 'sawtooth', 0.3);
        break;
      case 'pole':
        // Two ascending tones
        tone(ctx, 660, 0.12, 'triangle', 0.4);
        setTimeout(() => tone(ctx, 990, 0.18, 'triangle', 0.5), 130);
        break;
      case 'lights_out': {
        // 5 beeps then a higher "go" tone
        for (let i = 0; i < 5; i++) {
          setTimeout(() => tone(ctx, 440, 0.08, 'square', 0.4), i * 250);
        }
        setTimeout(() => {
          tone(ctx, 880, 0.4, 'square', 0.6);
          tone(ctx, 1320, 0.4, 'triangle', 0.3);
        }, 5 * 250);
        break;
      }
      case 'checkered':
        // Classic up-arpeggio fanfare
        [523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => tone(ctx, f, 0.15, 'triangle', 0.45), i * 80);
        });
        break;
      case 'season_end':
        // Slower fanfare
        [392, 494, 587, 784].forEach((f, i) => {
          setTimeout(() => tone(ctx, f, 0.3, 'sine', 0.5), i * 200);
        });
        break;
      case 'champion':
        // Triumphant chord
        [523, 659, 784].forEach(f => tone(ctx, f, 0.6, 'triangle', 0.4));
        setTimeout(() => {
          [659, 831, 988].forEach(f => tone(ctx, f, 0.8, 'triangle', 0.4));
        }, 400);
        break;
    }
  }, [settings.audioVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEngineLoop = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || engineNodesRef.current) return;
    // Engine = two detuned sawtooths low-passed, with an LFO modulating frequency
    // slightly to give that vroom oscillation.
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.value = 80;
    osc2.frequency.value = 83; // detune for chorus
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.value = settings.audioVolume * 0.08;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(ctx.destination);
    osc1.start();
    osc2.start();
    lfo.start();
    engineNodesRef.current = { osc1, osc2, gain, lfo, lfoGain };
  }, [settings.audioVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopEngineLoop = useCallback(() => {
    if (!engineNodesRef.current) return;
    const { osc1, osc2, lfo, gain } = engineNodesRef.current;
    const ctx = audioCtxRef.current;
    if (ctx) {
      // Fade out smoothly
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      setTimeout(() => {
        try { osc1.stop(); osc2.stop(); lfo.stop(); } catch { /* already stopped */ }
      }, 450);
    } else {
      try { osc1.stop(); osc2.stop(); lfo.stop(); } catch { /* already stopped */ }
    }
    engineNodesRef.current = null;
  }, []);

  return (
    <AudioCtx.Provider value={{
      enabled: settings.audioEnabled,
      volume: settings.audioVolume,
      setEnabled, setVolume,
      play, startEngineLoop, stopEngineLoop,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be inside AudioProvider');
  return ctx;
}
