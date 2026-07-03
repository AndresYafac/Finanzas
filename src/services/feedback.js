let notifyHandler = null;
let confirmHandler = null;

export function notify(message, type = 'error') {
  if (notifyHandler) notifyHandler({ message, type });
}

export function confirmAction(message) {
  if (confirmHandler) return confirmHandler(message);
  return Promise.resolve(false);
}

export function setFeedbackHandlers({ onNotify, onConfirm }) {
  notifyHandler = onNotify;
  confirmHandler = onConfirm;
}

export function clearFeedbackHandlers() {
  notifyHandler = null;
  confirmHandler = null;
}
