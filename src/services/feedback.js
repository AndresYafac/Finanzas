let notifyHandler = null;
let confirmHandler = null;
let busyHandler = null;
let busyCount = 0;

export function notify(message, type = 'error') {
  if (notifyHandler) notifyHandler({ message, type });
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
