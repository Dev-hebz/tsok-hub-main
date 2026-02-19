'use client';

import { motion, AnimatePresence } from 'framer-motion';

// ─── Toast Notification ──────────────────────────────────────────
export const Toast = ({ message, type = 'success', visible }) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  const colors = {
    success: 'bg-green-500/90 border-green-400/50',
    error: 'bg-red-500/90 border-red-400/50',
    warning: 'bg-yellow-500/90 border-yellow-400/50',
    info: 'bg-blue-500/90 border-blue-400/50',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-lg shadow-2xl text-white font-semibold text-sm ${colors[type]}`}
        >
          <span className="text-lg">{icons[type]}</span>
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Alert Modal (replaces alert()) ──────────────────────────────
export const AlertModal = ({ visible, title, message, type = 'info', onClose }) => {
  const icons = {
    success: { emoji: '✅', color: 'text-green-400', bg: 'bg-green-500/20 border-green-400/30' },
    error: { emoji: '❌', color: 'text-red-400', bg: 'bg-red-500/20 border-red-400/30' },
    warning: { emoji: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-400/30' },
    info: { emoji: 'ℹ️', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-400/30' },
  };
  const style = icons[type];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-[160] px-4 pointer-events-none"
          >
            <div className={`bg-blue-900/95 backdrop-blur-xl border rounded-2xl p-6 w-full max-w-sm shadow-2xl pointer-events-auto ${style.bg}`}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${style.bg} border`}>
                  {style.emoji}
                </div>
              </div>
              {/* Content */}
              {title && <h3 className={`text-xl font-bold text-center mb-2 ${style.color}`}>{title}</h3>}
              <p className="text-blue-100 text-center text-sm leading-relaxed">{message}</p>
              {/* Button */}
              <button
                onClick={onClose}
                className="mt-6 w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm"
              >
                OK
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Confirm Modal (replaces confirm()) ──────────────────────────
export const ConfirmModal = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm,
  onCancel,
}) => {
  const styles = {
    warning: { emoji: '⚠️', confirmBtn: 'bg-yellow-400 hover:bg-yellow-300 text-blue-900', border: 'border-yellow-400/30' },
    danger: { emoji: '🗑️', confirmBtn: 'bg-red-500 hover:bg-red-400 text-white', border: 'border-red-400/30' },
    info: { emoji: 'ℹ️', confirmBtn: 'bg-blue-500 hover:bg-blue-400 text-white', border: 'border-blue-400/30' },
  };
  const style = styles[type] || styles.warning;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            onClick={onCancel}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-[160] px-4 pointer-events-none"
          >
            <div className={`bg-blue-900/95 backdrop-blur-xl border ${style.border} rounded-2xl p-6 w-full max-w-sm shadow-2xl pointer-events-auto`}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-white/10 border border-white/20`}>
                  {style.emoji}
                </div>
              </div>
              {/* Content */}
              {title && <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>}
              <p className="text-blue-200 text-center text-sm leading-relaxed">{message}</p>
              {/* Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all text-sm border border-white/20"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-3 font-bold rounded-xl transition-all text-sm ${style.confirmBtn}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
