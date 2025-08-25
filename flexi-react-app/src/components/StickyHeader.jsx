import React from 'react';

function StickyHeader({ title, children }) {
  return (
    <div className="sticky-header">
      <div className="sticky-header-content">
        <div className="sticky-header-text">
          <h2 className="sticky-header-title">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export default StickyHeader;
