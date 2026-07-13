import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  Check,
  ClipboardList,
  FileDown,
  Pencil,
  Plus,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge, Field, Modal, RowActions, SelectField, TableSection } from '../../components/ui';
import {
  getBankBrand,
  getBankIdentifierType,
  getBankType,
  getEntityLabel,
  validateAccountNumber,
  validateCci,
} from '../../constants/bankLogos';
import { confirmAction, notify } from '../../services/feedback';
import { createCuenta, deleteCuenta, getCuentasViewData, registrarTransferencia, updateCuenta } from '../../services/cuentas.service';
import { calcEstado, dateFmt, money, month, today } from '../../utils/format';
import {
  MODULE_PERMISSIONS,
  PERMISSION_FIELDS,
  MetricCard,
  badge,
  downloadText,
  escapeHtml,
  logAudit,
  parseCsv,
  shortJson,
  toCsv,
} from './financePageShared';

export function Cuentas({ supabase, user, can = () => true }) {
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferencias, setTransferencias] = React.useState([]);
  const [historial, setHistorial] = React.useState([]);
  const [typeFilter, setTypeFilter] = React.useState('todos');
  const emptyForm = { banco: '', tipo: 'Ahorros', tipo_entidad: 'banco', cuenta_vinculada_id: '', numero: '', cci: '', moneda: 'PEN', saldo: '' };
  const emptyTransfer = { tipo_destino: 'propia', cuenta_origen_id: '', cuenta_destino_id: '', banco_destino: '', numero_destino: '', titular_destino: '', monto: '', fecha: today(), notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [transferForm, setTransferForm] = React.useState(emptyTransfer);
  const load = React.useCallback(async () => {
    const { cuentas: cuentasData, transferencias: transferenciasData, movimientos: movimientosData, pagos: pagosData } = await getCuentasViewData(supabase, user.id);
    setCuentas(cuentasData);
    setTransferencias(transferenciasData);
    setHistorial([
      ...movimientosData.filter((m) => m.cuenta_id).map((m) => ({ fecha: m.fecha, cuenta_id: m.cuenta_id, tipo: m.tipo, detalle: m.concepto, monto: Number(m.monto || 0) })),
      ...pagosData.filter((p) => p.cuenta_id).map((p) => ({ fecha: p.fecha, cuenta_id: p.cuenta_id, tipo: 'ingreso', detalle: `Pago ${p.metodo || ''} - ${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, monto: Number(p.monto || 0) })),
      ...transferenciasData.flatMap((t) => [
        { fecha: t.fecha, cuenta_id: t.cuenta_origen_id, tipo: 'egreso', detalle: 'Transferencia enviada', monto: Number(t.monto || 0) },
        t.cuenta_destino_id ? { fecha: t.fecha, cuenta_id: t.cuenta_destino_id, tipo: 'ingreso', detalle: 'Transferencia recibida', monto: Number(t.monto || 0) } : null,
      ].filter(Boolean)),
    ].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 80));
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(cuenta) {
    setEditingId(cuenta.id);
    setForm({
      banco: cuenta.banco || '',
      tipo: cuenta.tipo || 'Ahorros',
      tipo_entidad: cuenta.tipo_entidad || getBankType(cuenta.banco || ''),
      cuenta_vinculada_id: cuenta.cuenta_vinculada_id || '',
      numero: cuenta.numero || '',
      cci: cuenta.cci || '',
      moneda: cuenta.moneda || 'PEN',
      saldo: cuenta.saldo ?? '',
    });
    setOpen(true);
  }
  async function remove(cuenta) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar cuenta ${cuenta.banco || ''}?`))) return;
    const { error } = await deleteCuenta(supabase, user.id, cuenta.id);
    if (error) {
      notify(error.message);
      return;
    }
    notify('Cuenta eliminada correctamente.', 'success');
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const tipoEntidad = getBankType(form.banco);
    const numberValidation = validateAccountNumber(form.banco, form.numero);
    const cciValidation = validateCci(form.banco, form.cci);
    if (!numberValidation.valid) return notify(numberValidation.message);
    if (!cciValidation.valid) return notify(cciValidation.message);
    const payload = {
      ...form,
      tipo: tipoEntidad === 'billetera' ? 'Billetera' : tipoEntidad === 'efectivo' ? 'Caja' : form.tipo,
      tipo_entidad: tipoEntidad,
      cuenta_vinculada_id: tipoEntidad === 'billetera' && form.cuenta_vinculada_id ? form.cuenta_vinculada_id : null,
      cci: tipoEntidad === 'banco' ? form.cci || null : null,
      saldo: Number(form.saldo || 0),
    };
    const { error } = editingId
      ? await updateCuenta(supabase, user.id, editingId, payload)
      : await createCuenta(supabase, user.id, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    notify(editingId ? 'Cuenta actualizada correctamente.' : 'Cuenta creada correctamente.', 'success');
    load();
  }
  async function saveTransfer(event) {
    event.preventDefault();
    if (!can('create')) return notify('No tienes permiso para crear transferencias.');
    if (transferForm.tipo_destino === 'externa') {
      const numberValidation = validateAccountNumber(transferForm.banco_destino, transferForm.numero_destino);
      if (!numberValidation.valid) return notify(numberValidation.message);
    }
    const payload = {
      p_cuenta_origen_id: transferForm.cuenta_origen_id,
      p_cuenta_destino_id: transferForm.tipo_destino === 'propia' ? transferForm.cuenta_destino_id : null,
      p_tipo_destino: transferForm.tipo_destino,
      p_banco_destino: transferForm.tipo_destino === 'externa' ? transferForm.banco_destino || null : null,
      p_numero_destino: transferForm.tipo_destino === 'externa' ? transferForm.numero_destino || null : null,
      p_titular_destino: transferForm.tipo_destino === 'externa' ? transferForm.titular_destino || null : null,
      p_monto: Number(transferForm.monto || 0),
      p_fecha: transferForm.fecha,
      p_notas: transferForm.notas || null,
    };
    if (!payload.p_cuenta_origen_id || !payload.p_monto || !payload.p_fecha) return;
    if (transferForm.tipo_destino === 'propia' && !payload.p_cuenta_destino_id) return;
    const { error } = await registrarTransferencia(supabase, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setTransferForm(emptyTransfer);
    setTransferOpen(false);
    notify('Transferencia registrada correctamente.', 'success');
    load();
  }
  const cuentaNombre = (id) => {
    const cuenta = cuentas.find((c) => c.id === id);
    return cuenta ? `${cuenta.banco} - ${cuenta.tipo || ''}` : '-';
  };
  function updateBanco(value) {
    const tipoEntidad = getBankType(value);
    setForm((current) => ({
      ...current,
      banco: value,
      tipo_entidad: tipoEntidad,
      tipo: tipoEntidad === 'billetera' ? 'Billetera' : tipoEntidad === 'efectivo' ? 'Caja' : current.tipo === 'Billetera' || current.tipo === 'Caja' ? 'Ahorros' : current.tipo,
      cuenta_vinculada_id: tipoEntidad === 'billetera' ? current.cuenta_vinculada_id : '',
      cci: tipoEntidad === 'banco' ? current.cci : '',
    }));
  }
  function updateLinkedAccount(accountId) {
    const linkedAccount = cuentas.find((cuenta) => cuenta.id === accountId);
    setForm((current) => ({
      ...current,
      cuenta_vinculada_id: accountId,
      saldo: linkedAccount ? linkedAccount.saldo ?? 0 : current.saldo,
      moneda: linkedAccount ? linkedAccount.moneda || current.moneda : current.moneda,
    }));
  }
  const filteredCuentas = typeFilter === 'todos'
    ? cuentas
    : cuentas.filter((cuenta) => (cuenta.tipo_entidad || getBankType(cuenta.banco)) === typeFilter);
  const cuentaCounts = cuentas.reduce((map, cuenta) => {
    const type = cuenta.tipo_entidad || getBankType(cuenta.banco);
    return { ...map, [type]: (map[type] || 0) + 1 };
  }, { banco: 0, billetera: 0, efectivo: 0 });
  const bankAccounts = cuentas.filter((cuenta) => (cuenta.tipo_entidad || getBankType(cuenta.banco)) === 'banco');
  function BankLogo({ banco }) {
    const brand = getBankBrand(banco);
    if (!brand) return <Building2 size={22} />;
    if (brand.logo) {
      return <img className="bank-logo-img" src={brand.logo} alt={`Logo ${brand.label}`} loading="lazy" />;
    }
    return (
      <span className="bank-logo-mark" style={{ '--bank-color': brand.color, '--bank-accent': brand.accent }}>
        <span>{brand.label}</span>
      </span>
    );
  }
  return (
    <>
      <div className="action-bar"><div></div><div className="table-actions">{can('create') && <button className="btn" onClick={() => setTransferOpen(true)}><ArrowRightLeft size={16} />Nueva transferencia</button>}{can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva cuenta</button>}</div></div>
      <div className="account-type-filters">
        {[
          ['todos', 'Todas', cuentas.length],
          ['banco', 'Bancos', cuentaCounts.banco],
          ['billetera', 'Billeteras', cuentaCounts.billetera],
          ['efectivo', 'Efectivo', cuentaCounts.efectivo],
        ].map(([id, label, count]) => (
          <button key={id} type="button" className={`account-type-chip ${typeFilter === id ? 'active' : ''}`} onClick={() => setTypeFilter(id)}>
            <span>{label}</span>
            <b>{count}</b>
          </button>
        ))}
      </div>
      <div className="grid-3 accounts-grid">
        {filteredCuentas.map((c) => {
          const brand = getBankBrand(c.banco);
          const entityType = c.tipo_entidad || getBankType(c.banco);
          const linkedAccount = c.cuenta_vinculada_id ? cuentas.find((cuenta) => cuenta.id === c.cuenta_vinculada_id) : null;
          const displayBalance = entityType === 'billetera' && linkedAccount ? linkedAccount.saldo : c.saldo;
          const bankCardStyle = brand
            ? {
                '--bank-color': brand.color,
                '--bank-accent': brand.accent,
                '--bank-watermark': brand.logo ? `url("${brand.logo}")` : 'none',
              }
            : undefined;

          return (
          <div className="account-card account-card-hover bank-card" key={c.id} style={bankCardStyle}>
            <div className="account-card-actions"><RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></div>
            <div className="bank-card-head">
              <div className="bank-card-icon"><BankLogo banco={c.banco} /></div>
              <div>
                <strong>{c.banco}</strong>
                <span>{getEntityLabel(entityType)} · {c.tipo} · {c.moneda}</span>
              </div>
            </div>
            <div className="bank-card-balance">
              <small>{entityType === 'billetera' && linkedAccount ? 'Saldo del banco vinculado' : 'Saldo disponible'}</small>
              <b>{money(displayBalance)}</b>
            </div>
            <div className="bank-card-meta">
              <span>{entityType === 'billetera' ? 'Identificador' : entityType === 'efectivo' ? 'Referencia' : 'Cuenta'}: {c.numero ? `•••• ${String(c.numero).slice(-4)}` : 'No registrada'}</span>
              {entityType === 'banco' ? <span>CCI: {c.cci ? `•••• ${String(c.cci).slice(-4)}` : 'No registrado'}</span> : <span>CCI: No aplica</span>}
              {entityType === 'billetera' ? <span>Vinculada a: {linkedAccount ? `${linkedAccount.banco} ${linkedAccount.tipo || ''}` : 'Sin banco vinculado'}</span> : null}
            </div>
          </div>
          );
        })}
      </div>
      <div className="card transfer-card"><div className="card-header"><h3>Ultimas transferencias</h3></div><div className="card-body">{transferencias.length ? transferencias.map((t) => <div className="list-row transfer-row" key={t.id}><span>{dateFmt(t.fecha)} - {cuentaNombre(t.cuenta_origen_id)} a {t.tipo_destino === 'propia' ? cuentaNombre(t.cuenta_destino_id) : `${t.banco_destino || 'Cuenta externa'} ${t.numero_destino || ''}`}</span><strong>{money(t.monto)}</strong></div>) : <div className="empty-state"><p>Sin transferencias registradas</p></div>}</div></div>
      <div className="report-spacer" />
      <TableSection title="Historial por cuenta" columns={['Fecha', 'Cuenta', 'Tipo', 'Detalle', 'Monto']} rows={historial.map((h) => [dateFmt(h.fecha), cuentaNombre(h.cuenta_id), badge(h.tipo), h.detalle || '-', money(h.monto)])} />
      <Modal open={open} title={editingId ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Banco, billetera o caja" value={form.banco} onChange={updateBanco} required placeholder="Ej: BCP, Yape, Plin, Caja chica" />
            <div className={`account-entity-note account-entity-${form.tipo_entidad || getBankType(form.banco)}`}>
              <strong>{getEntityLabel(form.tipo_entidad || getBankType(form.banco))}</strong>
              <span>{(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? 'Se validara como billetera virtual. No usa CCI.' : (form.tipo_entidad || getBankType(form.banco)) === 'efectivo' ? 'Se tratara como caja o efectivo. No usa CCI.' : 'Se tratara como cuenta bancaria tradicional.'}</span>
            </div>
            <div className="form-row">
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}>
                {(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? <option>Billetera</option> : null}
                {(form.tipo_entidad || getBankType(form.banco)) === 'efectivo' ? <option>Caja</option> : null}
                {(form.tipo_entidad || getBankType(form.banco)) === 'banco' ? <><option>Ahorros</option><option>Corriente</option></> : null}
              </SelectField>
              <SelectField label="Moneda" value={form.moneda} onChange={(v) => setForm({ ...form, moneda: v })}><option value="PEN">Soles</option><option value="USD">Dólares</option><option value="EUR">Euros</option></SelectField>
            </div>
            {(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? (
              <>
                <SelectField label="Banco vinculado" value={form.cuenta_vinculada_id} onChange={updateLinkedAccount}>
                  <option value="">Sin banco vinculado</option>
                  {bankAccounts.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} - {cuenta.tipo} - {money(cuenta.saldo)}</option>
                  ))}
                </SelectField>
                <div className="account-entity-note muted">
                  <strong>Saldo automatico</strong>
                  <span>Al seleccionar un banco vinculado, el saldo de la billetera toma automaticamente el saldo actual de ese banco.</span>
                </div>
              </>
            ) : null}
            <Field
              label={(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? (getBankIdentifierType(form.banco) === 'email' ? 'Email asociado' : getBankIdentifierType(form.banco) === 'phone_or_email' ? 'Celular o email asociado' : 'Celular asociado') : (form.tipo_entidad || getBankType(form.banco)) === 'efectivo' ? 'Referencia' : 'Numero de cuenta'}
              value={form.numero}
              onChange={(v) => setForm({ ...form, numero: v })}
              placeholder={(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? '9XXXXXXXX' : 'Numero de cuenta o referencia'}
              maxLength={(form.tipo_entidad || getBankType(form.banco)) === 'billetera' ? 60 : 24}
            />
            {(form.tipo_entidad || getBankType(form.banco)) === 'banco' ? (
              <Field label="CCI" value={form.cci} onChange={(v) => setForm({ ...form, cci: v })} placeholder="20 digitos" maxLength={20} />
            ) : (
              <div className="account-entity-note muted"><strong>CCI no aplica</strong><span>Las billeteras y cajas no usan codigo interbancario.</span></div>
            )}
            <Field
              label={(form.tipo_entidad || getBankType(form.banco)) === 'billetera' && form.cuenta_vinculada_id ? 'Saldo del banco vinculado' : 'Saldo inicial'}
              type="number"
              value={form.saldo}
              onChange={(v) => setForm({ ...form, saldo: v })}
              readOnly={(form.tipo_entidad || getBankType(form.banco)) === 'billetera' && Boolean(form.cuenta_vinculada_id)}
            />
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
      <TransferenciaModal open={transferOpen} onClose={() => setTransferOpen(false)} onSubmit={saveTransfer} form={transferForm} setForm={setTransferForm} cuentas={cuentas} />
    </>
  );
}

function TransferenciaModal({ open, onClose, onSubmit, form, setForm, cuentas }) {
  const origin = cuentas.find((cuenta) => cuenta.id === form.cuenta_origen_id);
  const destinationType = form.tipo_destino === 'externa' ? getBankType(form.banco_destino) : 'banco';
  const destinationIdentifier = form.tipo_destino === 'externa' ? getBankIdentifierType(form.banco_destino) : 'account';
  return (
    <Modal open={open} title="Nueva transferencia" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <SelectField label="Cuenta origen" value={form.cuenta_origen_id} onChange={(v) => setForm({ ...form, cuenta_origen_id: v })}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
          </SelectField>
          <SelectField label="Destino" value={form.tipo_destino} onChange={(v) => setForm({ ...form, tipo_destino: v, cuenta_destino_id: '' })}>
            <option value="propia">Entre mis cuentas</option>
            <option value="externa">Destino externo</option>
          </SelectField>
          {form.tipo_destino === 'propia' ? (
            <SelectField label="Cuenta destino" value={form.cuenta_destino_id} onChange={(v) => setForm({ ...form, cuenta_destino_id: v })}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.filter((c) => c.id !== form.cuenta_origen_id).map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo}</option>)}
            </SelectField>
          ) : (
            <>
              <Field label="Banco o billetera destino" value={form.banco_destino} onChange={(v) => setForm({ ...form, banco_destino: v })} required placeholder="Ej: BCP, Yape, Plin" />
              <div className={`account-entity-note account-entity-${destinationType}`}>
                <strong>{getEntityLabel(destinationType)}</strong>
                <span>{destinationType === 'billetera' ? 'El destino se validara como billetera virtual.' : 'El destino se validara como cuenta bancaria o referencia externa.'}</span>
              </div>
              <Field
                label={destinationType === 'billetera' ? (destinationIdentifier === 'email' ? 'Email destino' : destinationIdentifier === 'phone_or_email' ? 'Celular o email destino' : 'Celular destino') : 'Numero de cuenta / CCI'}
                value={form.numero_destino}
                onChange={(v) => setForm({ ...form, numero_destino: v })}
                required
                placeholder={destinationType === 'billetera' ? '9XXXXXXXX' : 'Cuenta bancaria o CCI'}
              />
              <Field label="Titular destino" value={form.titular_destino} onChange={(v) => setForm({ ...form, titular_destino: v })} />
            </>
          )}
          {origin && <div className="account-entity-note muted"><strong>Origen: {getEntityLabel(origin.tipo_entidad || getBankType(origin.banco))}</strong><span>{origin.banco} - saldo disponible {money(origin.saldo)}</span></div>}
          <div className="form-row">
            <Field label="Monto" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
            <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
          </div>
          <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
        <div className="modal-footer"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary"><ArrowRightLeft size={16} />Transferir</button></div>
      </form>
    </Modal>
  );
}

