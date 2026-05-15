import React from 'react';

// Generic modal wrapper. Click backdrop to close; click body absorbs the event.
// `accentColor` adds a 3px colored border under the title (used for team color).
export function PopupShell({ title, onClose, children, accentColor }: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup" onClick={e => e.stopPropagation()}>
        <div
          className="popup-header"
          style={{ borderBottom: accentColor ? `3px solid ${accentColor}` : undefined }}
        >
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="popup-body">
          {children}
        </div>
      </div>
    </div>
  );
}
