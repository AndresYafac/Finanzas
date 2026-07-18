import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

let notifyHandler = null;
let confirmHandler = null;
let busyHandler = null;
let busyCount = 0;

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3600,
  timerProgressBar: true,
  customClass: {
    popup: 'fintrack-swal-toast',
    title: 'fintrack-swal-title',
    timerProgressBar: 'fintrack-swal-progress',
  },
  didOpen: (popup) => {
    popup.addEventListener('mouseenter', Swal.stopTimer);
    popup.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

function mapIcon(type) {
  if (type === 'success' || type === 'warning' || type === 'info' || type === 'question') return type;
  return 'error';
}

export function notify(message, type = 'error') {
  const text = String(message || '').trim();
  if (!text) return;
  if (typeof window !== 'undefined') {
    toast.fire({ icon: mapIcon(type), title: text });
    return;
  }
  if (notifyHandler) notifyHandler({ message: text, type });
}

export function confirmAction(message) {
  if (confirmHandler) return confirmHandler(message);
  return Promise.resolve(false);
}

export function showBusy(message = 'Procesando...') {
  busyCount += 1;
  if (busyHandler) busyHandler({ active: true, message });
}

export function hideBusy() {
  busyCount = Math.max(0, busyCount - 1);
  if (busyCount === 0 && busyHandler) busyHandler({ active: false, message: '' });
}

export async function runWithBusy(message, action) {
  showBusy(message);
  try {
    return await action();
  } finally {
    hideBusy();
  }
}

export function setFeedbackHandlers({ onNotify, onConfirm, onBusy }) {
  notifyHandler = onNotify;
  confirmHandler = onConfirm;
  busyHandler = onBusy;
}

export function clearFeedbackHandlers() {
  notifyHandler = null;
  confirmHandler = null;
  busyHandler = null;
  busyCount = 0;
}
