import React from 'react';
import { notify } from '../services/feedback';

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useExport() {
  const exportJson = React.useCallback((filename, data) => {
    downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    notify('Archivo JSON descargado.', 'success');
  }, []);

  const exportCsv = React.useCallback((filename, rows = []) => {
    if (!rows.length) {
      notify('No hay datos para exportar.', 'warning');
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
    downloadBlob(filename, csv, 'text/csv;charset=utf-8');
    notify('Archivo CSV descargado.', 'success');
  }, []);

  return { exportJson, exportCsv };
}

