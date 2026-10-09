import { useContext } from 'react';
import { ToastContext } from './toastContextDef';

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
};

export default useToast;
