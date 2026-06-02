import { useCallback } from 'react';
import { useUIStore } from '../store';
import { showError, showSuccess } from '../utils';

export const useConfirmDelete = () => {
  const { showConfirmDialog } = useUIStore();

  return useCallback(({ title, message, onConfirm, successMessage, errorMessage }) => {
    showConfirmDialog(
      title,
      message,
      async () => {
        try {
          await onConfirm();
          showSuccess(successMessage);
        } catch (error) {
          showError(error.message || errorMessage);
        }
      },
      'danger'
    );
  }, [showConfirmDialog]);
};
