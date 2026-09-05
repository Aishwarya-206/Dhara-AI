import React from 'react';

export default function OnScreenPanel({ content, stage, subtopic }) {
  if (!content) {
    return (
      <div className="onscreen-panel empty">
        <p className="muted">On-screen content will appear here as the lesson progresses.</p>
      </div>
    );
  }

  return (
    <div className="onscreen-panel">
      <div className="onscreen-stage-tag">{stage}</div>
      <h3>{content.title || subtopic}</h3>
      {content.bullets && content.bullets.length > 0 && (
        <ul>
          {content.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {content.visual_description && (
        <div className="visual-placeholder">
          <span className="visual-icon">🖼️</span>
          <span>{content.visual_description}</span>
        </div>
      )}
    </div>
  );
}
