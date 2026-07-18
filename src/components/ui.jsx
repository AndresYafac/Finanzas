import React from 'react';
import { Columns3, Download, Eye, FileSpreadsheet, FileText, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { getCompanyConfig } from '../config/visualConfig';
import { notify } from '../services/feedback';
import { money } from '../utils/format';

function AppLogoIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M14 23.5h36a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6v-16a6 6 0 0 1 6-6Z" stroke="currentColor" strokeWidth="5" />
      <path d="M16 23.5 40 12h5a5 5 0 0 1 5 5v6.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 36h14v10H42a5 5 0 0 1 0-10Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M20 36h12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="45" cy="41" r="2.8" fill="currentColor" />
    </svg>
  );
}

export function AuthCard({ title, children }) {
  const [companyConfig, setCompanyConfig] = React.useState(getCompanyConfig);

  React.useEffect(() => {
    const syncCompanyConfig = () => setCompanyConfig(getCompanyConfig());
    window.addEventListener('fintrack_company_config', syncCompanyConfig);
    return () => window.removeEventListener('fintrack_company_config', syncCompanyConfig);
  }, []);

  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            {companyConfig.logo_url ? <img src={companyConfig.logo_url} alt="Logo de FinTrack" /> : <AppLogoIcon />}
          </div>
          <h1>{title}</h1>
          <p>Sistema de gestión financiera</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  iconOnly = false,
  className = '',
  type = 'button',
  loading = false,
  loadingLabel,
  disabled,
  ...props
}) {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'danger' ? 'btn-danger' : '',
    size === 'sm' ? 'btn-sm' : '',
    iconOnly ? 'btn-icon' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading ? 'true' : undefined} {...props}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
      {loading ? (loadingLabel || children) : children}
    </button>
  );
}

export function Badge({ children, tone = 'gray', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
}

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`card ${className}`.trim()}>
      {(title || action) && <div className="card-header"><h3>{title}</h3>{action}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ children = 'Sin datos' }) {
  return <div className="empty-state"><p>{children}</p></div>;
}

export function FormActions({ children, className = '' }) {
  return <div className={`form-actions ${className}`.trim()}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function AppDialogs({ toast, onCloseToast, confirmState, setConfirmState, busy }) {
  function answer(value) {
    confirmState?.resolve(value);
    setConfirmState(null);
  }
  return (
    <>
      {toast && (
        <div className={`toast toast-${toast.type || 'error'}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={onCloseToast}>X</button>
        </div>
      )}
      {confirmState && (
        <div className="dialog-overlay">
          <div className="dialog-card">
            <h3>Confirmar acción</h3>
            <p>{confirmState.question}</p>
            <div className="dialog-actions">
              <Button onClick={() => answer(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => answer(true)}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
      {busy?.active && (
        <div className="busy-overlay">
          <div className="busy-card">
            <span className="busy-spinner" />
            <strong>{busy.message || 'Procesando...'}</strong>
          </div>
        </div>
      )}
    </>
  );
}

export function Field({ label, type = 'text', value, onChange, required = false, minLength, placeholder, rightElement, ...inputProps }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className={rightElement ? 'input-wrap' : ''}>
        <input type={type} value={value} required={required} minLength={minLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} {...inputProps} />
        {rightElement}
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </div>
  );
}

export function Modal({ open, title, onClose, children, className = '', footer = null }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className={`modal ${className}`.trim()} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose} type="button">X</button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function RowActions({
  onView,
  onEdit,
  onDownload,
  onDelete,
  canView = true,
  canEdit = true,
  canDownload = true,
  canDelete = true,
}) {
  return (
    <div className="row-actions">
      {canView && onView && <Button size="sm" iconOnly onClick={onView} title="Ver detalle"><Eye size={14} /></Button>}
      {canEdit && <Button size="sm" iconOnly onClick={onEdit} title="Editar"><Pencil size={14} /></Button>}
      {canDownload && onDownload && <Button size="sm" iconOnly onClick={onDownload} title="Descargar"><Download size={14} /></Button>}
      {canDelete && <Button size="sm" iconOnly variant="danger" onClick={onDelete} title="Eliminar"><Trash2 size={14} /></Button>}
    </div>
  );
}

function cellToText(cell) {
  if (cell === null || cell === undefined || typeof cell === 'boolean') return '';
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  if (Array.isArray(cell)) return cell.map(cellToText).filter(Boolean).join(' ');
  if (React.isValidElement(cell)) return cellToText(cell.props?.children);
  return String(cell);
}

function exportRowsToPdf(title, columns, rows) {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const safeTitle = escape(title);
  const html = `<!doctype html>
    <html>
      <head>
        <title>${safeTitle}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#122033;margin:28px}
          h1{font-size:22px;margin:0 0 4px}
          .meta{color:#64748b;font-size:12px;margin-bottom:18px}
          table{width:100%;border-collapse:collapse;font-size:12px}
          th,td{border-bottom:1px solid #dbe5ee;padding:9px;text-align:left;vertical-align:top}
          th{background:#f1f5f9;color:#475569;text-transform:uppercase;font-size:10px}
          tr:nth-child(even) td{background:#fafafa}
          @media print{body{margin:18px}}
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <div class="meta">Generado: ${escape(new Date().toLocaleString('es-PE'))}</div>
        <table>
          <thead><tr>${columns.map((column) => `<th>${escape(column)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length ? rows.map((row) => `<tr>${columns.map((_, index) => `<td>${escape(cellToText(row[index]))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}">Sin datos</td></tr>`}
          </tbody>
        </table>
        <script>window.onload=()=>window.print();</script>
      </body>
    </html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function isCurrencyColumn(column = '') {
  return /monto|saldo|total|importe|cobrado|cobrar|pagado|pagar|balance|ingreso|egreso|precio|costo/i.test(String(column));
}

function parseCurrencyValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/S\/|\$|USD|PEN|EUR/gi, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseSortableValue(value) {
  const text = cellToText(value).trim();
  const currency = parseCurrencyValue(text);
  if (currency !== null) return { type: 'number', value: currency };

  const dateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dateMatch) {
    const [, day, monthValue, year] = dateMatch;
    return { type: 'number', value: new Date(Number(year), Number(monthValue) - 1, Number(day)).getTime() };
  }

  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return { type: 'number', value: new Date(`${text}-01T00:00:00`).getTime() };

  const number = Number(text.replace(/,/g, ''));
  if (Number.isFinite(number) && text !== '') return { type: 'number', value: number };

  return { type: 'text', value: text.toLocaleLowerCase('es-PE') };
}

function compareCells(left, right, direction) {
  const a = parseSortableValue(left);
  const b = parseSortableValue(right);
  const multiplier = direction === 'desc' ? -1 : 1;
  if (a.type === 'number' && b.type === 'number') return (a.value - b.value) * multiplier;
  return String(a.value).localeCompare(String(b.value), 'es-PE', { numeric: true, sensitivity: 'base' }) * multiplier;
}

function isDateColumn(column = '') {
  return /fecha|vencimiento|registro|created/i.test(String(column));
}

function toInputMonth(value) {
  const text = cellToText(value).trim();
  if (!text) return '';
  const monthMatch = text.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;
  const peMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (peMatch) {
    const [, , monthValue, year] = peMatch;
    return `${year}-${String(monthValue).padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 7);
}

const EMPTY_TABLE_FILTERS = {
  search: '',
  from: '',
  to: '',
};

async function exportRowsToExcel(title, columns, rows) {
  notify('Descargando reporte...', 'success');
  const XLSX = await import('xlsx-js-style');
  const safeTitle = String(title || 'Reporte').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
  const exportDate = new Date().toLocaleString('es-PE');
  const dataRows = rows.map((row) => columns.map((_, index) => cellToText(row[index])));
  const totalableIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => isCurrencyColumn(column) && dataRows.some((row) => parseCurrencyValue(row[index]) !== null))
    .map(({ index }) => index);
  const totalsRow = columns.map((_, index) => {
    if (index === 0) return 'TOTAL';
    if (!totalableIndexes.includes(index)) return '';
    return dataRows.reduce((sum, row) => sum + (parseCurrencyValue(row[index]) || 0), 0);
  });
  const rowsForSheet = dataRows.length ? [...dataRows, totalsRow] : [columns.map((_, index) => (index === 0 ? 'Sin datos' : ''))];
  const sheetRows = [
    [safeTitle],
    [`Generado: ${exportDate}`],
    [`Registros exportados: ${dataRows.length}`],
    [],
    columns,
    ...rowsForSheet,
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const lastColumnIndex = Math.max(columns.length - 1, 0);
  const lastRowIndex = Math.max(sheetRows.length - 1, 5);
  const headerRowIndex = 4;
  const dataStartRowIndex = 5;
  const totalsRowIndex = dataRows.length ? lastRowIndex : null;
  const border = {
    top: { style: 'thin', color: { rgb: 'DDE5EE' } },
    right: { style: 'thin', color: { rgb: 'DDE5EE' } },
    bottom: { style: 'thin', color: { rgb: 'DDE5EE' } },
    left: { style: 'thin', color: { rgb: 'DDE5EE' } },
  };

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColumnIndex } },
  ];
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: headerRowIndex, c: 0 }, e: { r: lastRowIndex, c: lastColumnIndex } }),
  };
  worksheet['!cols'] = columns.map((column, index) => {
    const values = [column, ...dataRows.map((row) => row[index] || '')];
    const maxLength = Math.max(...values.map((value) => String(value).length), 10);
    return { wch: Math.min(Math.max(maxLength + 4, 14), 48) };
  });
  worksheet['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }];

  ['A1', 'A2', 'A3'].forEach((ref, index) => {
    if (!worksheet[ref]) return;
    worksheet[ref].s = {
      font: index === 0
        ? { bold: true, sz: 18, color: { rgb: 'FFFFFF' } }
        : { bold: index === 2, sz: 11, color: { rgb: index === 1 ? '36546D' : '0F766E' } },
      fill: { fgColor: { rgb: index === 0 ? '0F766E' : 'E9FBF6' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  });

  columns.forEach((_, index) => {
    const ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: index });
    if (!worksheet[ref]) return;
    worksheet[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '1D9E75' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border,
    };
  });

  for (let rowIndex = dataStartRowIndex; rowIndex <= lastRowIndex; rowIndex += 1) {
    for (let colIndex = 0; colIndex <= lastColumnIndex; colIndex += 1) {
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!worksheet[ref]) continue;
      const currencyValue = isCurrencyColumn(columns[colIndex]) ? parseCurrencyValue(worksheet[ref].v) : null;
      if (currencyValue !== null) {
        worksheet[ref].v = currencyValue;
        worksheet[ref].t = 'n';
        worksheet[ref].z = '"S/ "#,##0.00';
      } else {
        worksheet[ref].t = 's';
      }
      const isTotalsRow = rowIndex === totalsRowIndex;
      worksheet[ref].s = {
        font: { color: { rgb: isTotalsRow ? 'FFFFFF' : '122033' }, sz: isTotalsRow ? 11 : 10, bold: isTotalsRow },
        fill: { fgColor: { rgb: isTotalsRow ? '0F766E' : (rowIndex % 2 === 0 ? 'F8FBFD' : 'FFFFFF') } },
        alignment: { vertical: 'top', wrapText: true, horizontal: currencyValue !== null ? 'right' : 'left' },
        border,
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, safeTitle.slice(0, 31) || 'Reporte');
  XLSX.writeFile(workbook, `${safeTitle}-${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
}

function findAmountIndex(columns, row) {
  const amountIndex = columns.findIndex((column) => isCurrencyColumn(column));
  if (amountIndex >= 0) return amountIndex;
  return row.findIndex((cell) => parseCurrencyValue(cellToText(cell)) !== null);
}

function getMobileRowActions(row, dataColumnCount) {
  return row.slice(dataColumnCount).find((cell) => React.isValidElement(cell)) || null;
}

export function TableSection({ title, columns, rows, search, setSearch, action, pageSize = 10, onExport, enableSorting = true }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(pageSize);
  const [contextMenu, setContextMenu] = React.useState(null);
  const [internalSearch, setInternalSearch] = React.useState('');
  const [sortState, setSortState] = React.useState({ index: null, direction: 'asc' });
  const [showOptions, setShowOptions] = React.useState(false);
  const [tableDensity, setTableDensity] = React.useState('comfortable');
  const [hiddenColumns, setHiddenColumns] = React.useState({});
  const [selectedRows, setSelectedRows] = React.useState(new Set());
  const [detailRow, setDetailRow] = React.useState(null);
  const [activeMobileRowKey, setActiveMobileRowKey] = React.useState(null);
  const [filters, setFilters] = React.useState(EMPTY_TABLE_FILTERS);
  const currentSearch = filters.search || (setSearch ? (search || '') : internalSearch);
  const updateSearch = (value) => {
    setFilters((current) => ({ ...current, search: value }));
    if (setSearch) setSearch(value);
    else setInternalSearch(value);
  };
  const normalizedSearch = currentSearch.trim().toLowerCase();
  const columnCount = Math.max(columns.length, ...rows.map((row) => row.length), 0);
  const dataColumnCount = columns.length;
  const visibleDataIndexes = columns.map((_, index) => index).filter((index) => !hiddenColumns[index]);
  const monthFilterIndex = columns.findIndex((column) => isDateColumn(column));
  const hasMonthFilter = monthFilterIndex >= 0;
  const hasActionsColumn = columnCount > dataColumnCount;
  const visibleColumnDefs = [
    ...visibleDataIndexes.map((index) => ({ label: columns[index], originalIndex: index, actions: false })),
    ...(hasActionsColumn ? [{ label: 'Acciones', originalIndex: dataColumnCount, actions: true }] : []),
  ];
  const filteredRows = rows
    .filter((row) => {
      const rowText = row.map(cellToText).join(' ').toLowerCase();
      if (normalizedSearch && !rowText.includes(normalizedSearch)) return false;

      if ((filters.from || filters.to) && hasMonthFilter) {
        const rowMonth = toInputMonth(row[monthFilterIndex]);
        const from = filters.from && filters.to && filters.from > filters.to ? filters.to : filters.from;
        const to = filters.from && filters.to && filters.from > filters.to ? filters.from : filters.to;
        if (!rowMonth) return false;
        if (from && rowMonth < from) return false;
        if (to && rowMonth > to) return false;
      }

      return true;
    });
  const sortedRows = sortState.index === null
    ? filteredRows
    : [...filteredRows].sort((a, b) => compareCells(a[sortState.index], b[sortState.index], sortState.direction));
  React.useEffect(() => setPage(1), [rows.length, currentSearch, limit, JSON.stringify(hiddenColumns), sortState.index, sortState.direction, filters.from, filters.to]);
  React.useEffect(() => {
    const close = () => {
      setContextMenu(null);
      setShowOptions(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, []);
  const exportColumnDefs = visibleColumnDefs.filter((column) => !column.actions);
  const exportColumns = exportColumnDefs.map((column) => column.label);
  const exportRows = sortedRows.map((row) => exportColumnDefs.map((column) => row[column.originalIndex]));
  const amountIndex = columns.findIndex((column) => isCurrencyColumn(column));
  const totalAmount = amountIndex >= 0
    ? sortedRows.reduce((sum, row) => sum + (parseCurrencyValue(cellToText(row[amountIndex])) || 0), 0)
    : null;
  const selectedExportRows = sortedRows
    .filter((row) => selectedRows.has(getRowKey(row)))
    .map((row) => exportColumnDefs.map((column) => row[column.originalIndex]));
  const statusText = sortedRows.map((row) => row.map(cellToText).join(' ').toLowerCase()).join(' ');
  const statusSummary = [
    ['Pendientes', (statusText.match(/pendiente/g) || []).length],
    ['Vencidos', (statusText.match(/vencido/g) || []).length],
    ['Cobrados', (statusText.match(/cobrado|pagado/g) || []).length],
  ].filter(([, value]) => value > 0);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / limit));
  const currentPage = Math.min(page, totalPages);
  React.useEffect(() => setActiveMobileRowKey(null), [currentPage, currentSearch, limit, JSON.stringify(hiddenColumns), filters.from, filters.to]);
  const start = (currentPage - 1) * limit;
  const visibleRows = sortedRows.slice(start, start + limit);
  const visibleRowKeys = visibleRows.map(getRowKey);
  const allVisibleSelected = visibleRowKeys.length > 0 && visibleRowKeys.every((key) => selectedRows.has(key));
  function getRowKey(row) {
    return `${rows.indexOf(row)}-${cellToText(row[0])}-${cellToText(row[1])}`;
  }
  function toggleRowSelection(row) {
    const key = getRowKey(row);
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleVisibleSelection() {
    setSelectedRows((current) => {
      const next = new Set(current);
      const shouldSelect = !allVisibleSelected;
      visibleRowKeys.forEach((key) => {
        if (shouldSelect) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }
  function toggleSort(index) {
    if (!enableSorting || index >= dataColumnCount) return;
    setSortState((current) => {
      if (current.index !== index) return { index, direction: 'asc' };
      if (current.direction === 'asc') return { index, direction: 'desc' };
      return { index: null, direction: 'asc' };
    });
  }
  function toggleColumn(index) {
    setHiddenColumns((current) => {
      const next = { ...current };
      if (next[index]) delete next[index];
      else if (visibleDataIndexes.length > 1) next[index] = true;
      return next;
    });
  }
  function resetTableOptions() {
    setHiddenColumns({});
    setSortState({ index: null, direction: 'asc' });
    setTableDensity('comfortable');
    setSelectedRows(new Set());
  }
  function clearTableFilters() {
    setFilters(EMPTY_TABLE_FILTERS);
    if (setSearch) setSearch('');
    else setInternalSearch('');
  }
  function getRowExportValues(row) {
    return exportColumnDefs.map((column) => row[column.originalIndex]);
  }
  function openRowDetail(row) {
    setDetailRow((current) => current || row);
  }
  function downloadRow(row) {
    exportRowsToPdf(`${title} - detalle`, exportColumns, [getRowExportValues(row)]);
  }
  function isRowActionsElement(cell) {
    return React.isValidElement(cell) && (cell.type === RowActions || cell.type?.name === RowActions.name);
  }
  function enhanceActionCell(cell, row) {
    if (!isRowActionsElement(cell)) return cell;
    return React.cloneElement(cell, {
      onView: cell.props.onView || (() => openRowDetail(row)),
      onDownload: cell.props.onDownload || (() => downloadRow(row)),
      canView: cell.props.canView ?? true,
      canDownload: cell.props.canDownload ?? true,
    });
  }
  return (
    <>
      {action && <div className="action-bar action-bar-end">{action}</div>}
      <Card
        className={detailRow ? 'table-detail-open' : ''}
        title={title}
        action={(
          <div className="table-actions">
            <div className="table-options-wrap" onClick={(event) => event.stopPropagation()}>
              <Button size="sm" onClick={() => setShowOptions((value) => !value)}><SlidersHorizontal size={14} />Opciones</Button>
              {showOptions && (
                <div className="table-options-panel">
                  <div className="table-options-head">
                    <strong>Vista web</strong>
                    <button type="button" onClick={resetTableOptions}>Restablecer</button>
                  </div>
                  <div className="table-density-options">
                    {[
                      ['compact', 'Compacta'],
                      ['comfortable', 'Cómoda'],
                      ['spacious', 'Amplia'],
                    ].map(([id, label]) => (
                      <button key={id} type="button" className={tableDensity === id ? 'active' : ''} onClick={() => setTableDensity(id)}>{label}</button>
                    ))}
                  </div>
                  <div className="table-column-options">
                    <span><Columns3 size={14} />Columnas</span>
                    {columns.map((column, index) => (
                      <label key={`${column}-${index}`}>
                        <input type="checkbox" checked={!hiddenColumns[index]} onChange={() => toggleColumn(index)} />
                        {column}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button size="sm" onClick={() => exportRowsToPdf(title, exportColumns, exportRows)}><FileText size={14} />Exportar PDF</Button>
            <Button size="sm" onClick={() => exportRowsToExcel(title, exportColumns, exportRows)}><FileSpreadsheet size={14} />Exportar Excel</Button>
            {onExport && <Button size="sm" onClick={onExport}><Download size={14} />Exportar CSV</Button>}
          </div>
        )}
      >
        <div className="table-external-filters">
          <div className="table-external-filters-head">
            <div>
              <strong><SlidersHorizontal size={16} />Filtros</strong>
              <span>Busca por texto y filtra por rango de mes.</span>
            </div>
            <Button size="sm" onClick={clearTableFilters}>Limpiar filtros</Button>
          </div>
          <div className="table-external-filters-grid">
            <label>
              Buscar
              <input
                type="search"
                value={currentSearch}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder={`Buscar ${title.toLowerCase()}...`}
              />
            </label>
            {hasMonthFilter && (
              <>
                <label>
                  Desde mes
                  <input
                    type="month"
                    value={filters.from}
                    onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  />
                </label>
                <label>
                  Hasta mes
                  <input
                    type="month"
                    value={filters.to}
                    onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  />
                </label>
              </>
            )}
          </div>
        </div>
        <div className="table-summary-grid">
          <div className="table-summary-card">
            <span>Total registros</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="table-summary-card">
            <span>Filtrados</span>
            <strong>{sortedRows.length}</strong>
          </div>
          {totalAmount !== null && (
            <div className="table-summary-card">
              <span>Total monto</span>
              <strong>{money(totalAmount)}</strong>
            </div>
          )}
          <div className="table-summary-card">
            <span>Seleccionados</span>
            <strong>{selectedRows.size}</strong>
          </div>
          {statusSummary.slice(0, 3).map(([label, value]) => (
            <div className="table-summary-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {selectedRows.size > 0 && (
          <div className="table-selection-bar">
            <strong>{selectedRows.size} seleccionados</strong>
            <span>Exporta solo los registros marcados.</span>
            <div>
              <Button size="sm" onClick={() => exportRowsToPdf(`${title} seleccionados`, exportColumns, selectedExportRows)}><FileText size={14} />PDF seleccionados</Button>
              <Button size="sm" onClick={() => exportRowsToExcel(`${title} seleccionados`, exportColumns, selectedExportRows)}><FileSpreadsheet size={14} />Excel seleccionados</Button>
              <Button size="sm" onClick={() => setSelectedRows(new Set())}>Limpiar</Button>
            </div>
          </div>
        )}
        <div className={`table-wrap table-density-${tableDensity}`}>
          <table>
            <thead>
              <tr>
                <th className="selection-th">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} aria-label="Seleccionar filas visibles" />
                </th>
                {visibleColumnDefs.map((column) => {
                  const sortable = enableSorting && !column.actions;
                  const activeSort = sortState.index === column.originalIndex;
                  return (
                    <th key={`${column.label}-${column.originalIndex}`} className={sortable ? 'sortable-th' : ''}>
                      {sortable ? (
                        <button type="button" className={`sort-button ${activeSort ? 'active' : ''}`} onClick={() => toggleSort(column.originalIndex)}>
                          <span>{column.label}</span>
                          <b aria-hidden="true">{activeSort ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕'}</b>
                        </button>
                      ) : column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? visibleRows.map((row, i) => (
                <tr
                  key={`${start}-${i}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, row });
                  }}
                >
                  <td className="selection-td">
                    <input type="checkbox" checked={selectedRows.has(getRowKey(row))} onChange={() => toggleRowSelection(row)} aria-label="Seleccionar fila" />
                  </td>
                  {visibleColumnDefs.map((column) => (
                    <td key={column.originalIndex}>
                      {column.actions ? enhanceActionCell(row[column.originalIndex], row) : row[column.originalIndex]}
                    </td>
                  ))}
                </tr>
              )) : <tr><td colSpan={(visibleColumnDefs.length || columns.length) + 1}><EmptyState>{normalizedSearch ? 'Sin resultados para el filtro aplicado' : 'Sin datos'}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mobile-record-list">
          {sortedRows.length ? visibleRows.map((row, rowIndex) => {
            const rowKey = getRowKey(row);
            const isActive = activeMobileRowKey === rowKey;
            const amountIndex = findAmountIndex(columns, row);
            const actionsCell = enhanceActionCell(getMobileRowActions(row, dataColumnCount), row);
            const primary = cellToText(row[0]) || 'Registro';
            const secondary = cellToText(row[1]);
            const amount = amountIndex >= 0 ? row[amountIndex] : null;
            const detailIndexes = visibleDataIndexes.filter((index) => index !== 0 && index !== 1 && index !== amountIndex);
            return (
              <article
                className={`mobile-record-card ${isActive ? 'is-active' : ''}`}
                key={`mobile-${start}-${rowIndex}`}
                onClick={() => setActiveMobileRowKey((current) => (current === rowKey ? null : rowKey))}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveMobileRowKey((current) => (current === rowKey ? null : rowKey));
                  }
                }}
              >
                <div className="mobile-record-content">
                  <div className="mobile-record-head">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowKey)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleRowSelection(row)}
                      aria-label="Seleccionar registro"
                    />
                    <div>
                      <strong>{primary}</strong>
                      {secondary && <span>{secondary}</span>}
                    </div>
                    {amount && <b>{amount}</b>}
                  </div>
                  {detailIndexes.length > 0 && (
                    <div className="mobile-record-details">
                      {detailIndexes.map((index) => (
                        <div key={`${columns[index]}-${index}`}>
                          <span>{columns[index]}</span>
                          <strong>{row[index]}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {actionsCell && isActive && (
                  <div
                    className="mobile-record-actions"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveMobileRowKey(null);
                    }}
                  >
                    <div className="mobile-record-actions-inner" onClick={(event) => event.stopPropagation()}>
                      {actionsCell}
                    </div>
                  </div>
                )}
              </article>
            );
          }) : <EmptyState>{normalizedSearch ? 'Sin resultados para el filtro aplicado' : 'Sin datos'}</EmptyState>}
        </div>
        {contextMenu && (
          <div className="table-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => navigator.clipboard?.writeText(contextMenu.row.map(cellToText).join(' | '))}>Copiar fila</button>
            <button type="button" onClick={() => exportRowsToPdf(`${title} - fila`, exportColumns, [exportColumnDefs.map((column) => contextMenu.row[column.originalIndex])])}>Exportar fila PDF</button>
          </div>
        )}
        {sortedRows.length > 0 && (
          <div className="pagination">
            <span>Mostrando {start + 1}-{Math.min(start + limit, sortedRows.length)} de {sortedRows.length}</span>
            <div className="pagination-actions">
              <select className="pagination-size" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <Button size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
              <span>Página {currentPage} de {totalPages}</span>
              <Button size="sm" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>
      <Modal
        open={!!detailRow}
        title={`Detalle de ${title}`}
        onClose={() => setDetailRow(null)}
        className="detail-modal"
      >
        <div className="detail-grid">
          {detailRow && exportColumnDefs.map((column) => (
            <div className="detail-item" key={`${column.label}-${column.originalIndex}`}>
              <span>{column.label}</span>
              <strong>{detailRow[column.originalIndex] || '-'}</strong>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
