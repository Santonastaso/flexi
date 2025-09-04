import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Elimina', 
  cancelText = 'Annulla',
  type = 'danger',
  customButtons = null
}) => {
  if (!isOpen) return null;

  const getConfirmVariant = () => {
    switch (type) {
      case 'danger':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'default';
      default:
        return 'destructive';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {customButtons ? (
            customButtons.map((button, index) => (
              <Button 
                key={index}
                onClick={button.onClick} 
                variant={button.variant || 'secondary'}
              >
                {button.text}
              </Button>
            ))
          ) : (
            <>
              <Button variant="outline" onClick={onCancel}>
                {cancelText}
              </Button>
              <Button variant={getConfirmVariant()} onClick={onConfirm}>
                {confirmText}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
