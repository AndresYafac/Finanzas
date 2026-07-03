import React from 'react';
import { Download, Pencil, Search, Trash2, TrendingUp } from 'lucide-react';

export function AuthCard({ title, children }) {
  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon"><TrendingUp /></div>
          <h1>{title}</h1>
          <p>Sistema de gestión financiera</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AppDialogs({ toast, onCloseToast, confirmState, setConfirmState }) {
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
              <button className="btn" type="button" onClick={() => answer(false)}>Cancelar</button>
              <button className="btn btn-danger" type="button" onClick={() => answer(true)}>Confirmar</button>
            </div>
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

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose} type="button">X</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RowActions({ onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-sm btn-icon" onClick={onEdit} title="Editar"><Pencil size={14} /></button>
      <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={onDelete} title="Eliminar"><Trash2 size={14} /></button>
    </div>
  );
}

export function TableSection({ title, columns, rows, search, setSearch, action, pageSize = 10, onExport }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(pageSize);
  React.useEffect(() => setPage(1), [rows.length, search, limit]);
  const columnCount = Math.max(columns.length, ...rows.map((row) => row.length), 0);
  const visibleColumns = [...columns, ...Array.from({ length: columnCount - columns.length }, () => 'Acciones')];
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * limit;
  const visibleRows = rows.slice(start, start + limit);
  return (
    <>
      {(setSearch || action) && <div className="action-bar"><div>{setSearch && <div className="search-wrap"><Search size={16} /><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} /></div>}</div>{action}</div>}
      <div className="card">
        <div className="card-header"><h3>{title}</h3>{onExport && <button className="btn btn-sm" type="button" onClick={onExport}><Download size={14} />Exportar CSV</button>}</div>
        <div className="table-wrap"><table><thead><tr>{visibleColumns.map((c, i) => <th key={`${c}-${i}`}>{c}</th>)}</tr></thead><tbody>{rows.length ? visibleRows.map((row, i) => <tr key={`${start}-${i}`}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={columnCount || columns.length}><div className="empty-state"><p>Sin datos</p></div></td></tr>}</tbody></table></div>
        {rows.length > 0 && (
          <div className="pagination">
            <span>Mostrando {start + 1}-{Math.min(start + limit, rows.length)} de {rows.length}</span>
            <div className="pagination-actions">
              <select className="pagination-size" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button className="btn btn-sm" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
              <span>Página {currentPage} de {totalPages}</span>
              <button className="btn btn-sm" type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

