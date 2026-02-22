/**
 * Toast Notification System
 * Toastify.js のラッパー
 */

/**
 * Toast Notification Class
 */
export class Toast {
  /**
   * Show success toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  static success(message, duration = 3000) {
    if (typeof Toastify === 'undefined') {
      console.warn('Toastify not loaded');
      alert(message); // Fallback
      return;
    }

    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #10b981, #059669)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  }

  /**
   * Show error toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  static error(message, duration = 3000) {
    if (typeof Toastify === 'undefined') {
      console.warn('Toastify not loaded');
      alert(message); // Fallback
      return;
    }

    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #ef4444, #dc2626)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  }

  /**
   * Show warning toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  static warning(message, duration = 3000) {
    if (typeof Toastify === 'undefined') {
      console.warn('Toastify not loaded');
      alert(message); // Fallback
      return;
    }

    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #f59e0b, #d97706)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  }

  /**
   * Show info toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  static info(message, duration = 3000) {
    if (typeof Toastify === 'undefined') {
      console.warn('Toastify not loaded');
      alert(message); // Fallback
      return;
    }

    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #3b82f6, #2563eb)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  }
}

// Backward compatibility: グローバル変数として公開（非推奨）
if (typeof window !== 'undefined') {
  window.Toast = Toast;
  console.warn('Toast: グローバル変数は非推奨です。import { Toast } from "./shared/ui/toast.js" を使用してください');
}
