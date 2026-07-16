import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Replaces window.confirm() for destructive actions — native browser confirms
// render as a thin banner at the top of the viewport on many setups, not a
// centered dialog, and can't spell out the actual consequence in the copy.
const ConfirmModal = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-secondary-900/40" onClick={onCancel} />
      <div className="relative card max-w-sm w-full">
        <div className="flex items-start space-x-3 mb-4">
          <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-danger-600" />
          </div>
          <div>
            <h3 className="font-semibold text-secondary-900">{title}</h3>
            <p className="text-sm text-secondary-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="bg-danger-600 hover:bg-danger-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
