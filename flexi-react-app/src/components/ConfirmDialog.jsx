import React from 'react';

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Elimina', 
  cancelText = 'Annulla',
  type = 'danger',
  customButtons = null // New prop for custom button configurations
}) => {
  if (!isOpen) return null;

  const baseClasses = 'confirm-dialog';
  const typeClasses = {
    danger: 'confirm-dialog--danger',
    warning: 'confirm-dialog--warning',
    info: 'confirm-dialog--info'
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type] || typeClasses.danger}`}>
      <div className="confirm-dialog__overlay" onClick={onCancel}></div>
      <div className="confirm-dialog__content">
        <div className="confirm-dialog__header">
          <h3 className="confirm-dialog__title">{title}</h3>
        </div>
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
        </div>
        <div className="confirm-dialog__footer">
          {customButtons ? (
            // Render custom buttons if provided
            customButtons.map((button, index) => (
              <button 
                key={index}
                onClick={button.onClick} 
                className={`confirm-dialog__button confirm-dialog__button--${button.variant || 'secondary'}`}
              >
                {button.text}
              </button>
            ))
          ) : (
            // Default buttons
            <>
              <button 
                onClick={onCancel} 
                className="confirm-dialog__button confirm-dialog__button--secondary"
              >
                {cancelText}
              </button>
              <button 
                onClick={onConfirm} 
                className="confirm-dialog__button confirm-dialog__button--primary"
              >
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
