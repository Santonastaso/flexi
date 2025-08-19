import React, { useEffect } from 'react';

const Alert = ({ message, type = 'info', isVisible, onClose, autoClose = true, duration = 5000 }) => {
  useEffect(() => {
    if (autoClose && isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, duration, onClose]);

  if (!isVisible) return null;

  const baseClasses = 'alert';
  const typeClasses = {
    success: 'alert--success',
    error: 'alert--error',
    warning: 'alert--warning',
    info: 'alert--info'
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type] || typeClasses.info}`}>
      <div className="alert__content">
        <span className="alert__message">{message}</span>
        <button onClick={onClose} className="alert__close" aria-label="Close">×</button>
      </div>
    </div>
  );
};

export default Alert;
