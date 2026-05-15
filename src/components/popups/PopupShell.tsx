import React from 'react';

// Generic modal wrapper. Backdrop click closes; body click absorbed.
//
// `hero` is rendered as a dark gradient hero band at the top of the popup,
// styled like the F1 header bars elsewhere. Use it to display name + key
// identity info. `accentColor` is the strip color along the bottom of the
// hero band — typically the driver's team color or the team's own color.
//
// `children` is the popup body.
export function PopupShell({ hero, onClose, children, accentColor }: {
  hero: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup" onClick={e => e.stopPropagation()}>
        <button className="popup-close-floating" onClick={onClose} aria-label="Close">✕</button>
        <div
          className="popup-hero"
          style={{ borderBottom: `3px solid ${accentColor ?? 'var(--f1-red)'}` }}
        >
          {hero}
        </div>
        <div className="popup-body">
          {children}
        </div>
      </div>
    </div>
  );
}
