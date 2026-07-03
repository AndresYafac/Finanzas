export const today = () => new Date().toISOString().slice(0, 10);

export const month = () => new Date().toISOString().slice(0, 7);

export const money = (value) =>
  `S/ ${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const dateFmt = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE') : '-');

export function calcEstado(deuda) {
  if (Number(deuda.monto_pagado || 0) >= Number(deuda.monto_total || 0)) return 'pagado';
  const due = new Date(`${deuda.fecha_vencimiento}T00:00:00`);
  const diff = Math.ceil((due - new Date()) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff <= 7) return 'por_vencer';
  return 'al_dia';
}
