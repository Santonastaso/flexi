import React from 'react';

function StickyHeader({ title, subtitle, children }) {
  return (
    <div className="sticky-header">
      <div className="sticky-header-content">
        <div className="sticky-header-text">
          <h2 className="sticky-header-title">{title}</h2>
          {subtitle && <p className="sticky-header-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default StickyHeader;
