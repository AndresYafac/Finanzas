import React from 'react';
import { confirmAction, notify } from '../services/feedback';

export function useConfirmAction() {
  return React.useCallback(async ({ question, action, successMessage, errorMessage }) => {
    const ok = await confirmAction(question);
    if (!ok) return false;
    try {
      await action();
      if (successMessage) notify(successMessage, 'success');
      return true;
    } catch (error) {
      notify(error?.message || errorMessage || 'No se pudo completar la accion.', 'error');
      return false;
    }
  }, []);
}

