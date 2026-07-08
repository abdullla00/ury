import { toast, ToastContainer } from 'react-toastify';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';

import './toast.css';

const toastIcons = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
};

const baseOptions = {
  position: 'top-right' as const,
  autoClose: 2000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'colored' as const,
};

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      ...baseOptions,
      icon: toastIcons.success,
      className: 'toast-success',
    });
  },
  successWithAction: (
    message: string,
    action: { label: string; onClick: () => void },
  ) => {
    toast.success(
      () => (
        <div className="flex flex-col gap-2">
          <span>{message}</span>
          <button
            type="button"
            className="self-start rounded bg-white/20 px-2 py-1 text-sm font-medium hover:bg-white/30"
            onClick={() => {
              action.onClick();
              toast.dismiss();
            }}
          >
            {action.label}
          </button>
        </div>
      ),
      {
        ...baseOptions,
        autoClose: 5000,
        icon: toastIcons.success,
        className: 'toast-success',
      },
    );
  },
  error: (message: string) => {
    toast.error(message, {
      ...baseOptions,
      icon: toastIcons.error,
      className: 'toast-error',
    });
  },
  info: (message: string) => {
    toast.info(message, {
      ...baseOptions,
      icon: toastIcons.info,
      className: 'toast-info',
    });
  },
};

export const ToastProvider = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={2000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
    />
  );
};
