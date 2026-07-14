import React from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Button, Card, Field, TableSection } from '../../components/ui';
import { notify } from '../../services/feedback';
import { buildDailyCashSnapshot, listDailyCashSessions, saveDailyCashSession } from '../../services/dailyCash.service';
import { dateFmt, money, today } from '../../utils/format';

export function CajaDiaria({ supabase, user, can = () => true }) {
  const [fecha, setFecha] = React.useState(today());
  const [snapshot, setSnapshot] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [notas, setNotas] = React.useState('');

  const load = React.useCallback(async () => {
    const [snapshotResult, sessionsResult] = await Promise.all([
      buildDailyCashSnapshot(supabase, user.id, fecha),
      listDailyCashSessions(supabase, user.id),
    ]);
    setSnapshot(snapshotResult);
    setRows(sessionsResult.data || []);
  }, [supabase, user.id, fecha]);

  React.useEffect(() => { load(); }, [load]);

  async function closeDay() {
    if (!can('create')) return notify('No tienes permiso para cerrar caja.', 'error');
    const { error } = await saveDailyCashSession(supabase, user.id, { ...snapshot, notas });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Caja diaria cerrada correctamente.', 'success');
    setNotas('');
    load();
  }

  return (
    <div className="feature-page">
      <Card title="Caja diaria" action={<Button onClick={load}><RefreshCw size={16} />Actualizar</Button>}>
        <div className="card-body feature-grid">
          <Field label="Fecha" type="date" value={fecha} onChange={setFecha} />
          <Field label="Notas" value={notas} onChange={setNotas} placeholder="Observaciones del dia..." />
          {snapshot && (
            <div className="summary-grid wide">
              <div><span>Saldo inicial</span><strong>{money(snapshot.saldo_inicial)}</strong></div>
              <div><span>Ingresos</span><strong>{money(snapshot.ingresos)}</strong></div>
              <div><span>Egresos</span><strong>{money(snapshot.egresos)}</strong></div>
              <div><span>Saldo final</span><strong>{money(snapshot.saldo_final)}</strong></div>
            </div>
          )}
          <Button variant="primary" onClick={closeDay}><Check size={16} />Cerrar caja</Button>
        </div>
      </Card>
      <TableSection
        title="Historial de caja diaria"
        columns={['Fecha', 'Saldo inicial', 'Ingresos', 'Egresos', 'Saldo final', 'Estado', 'Notas']}
        rows={rows.map((row) => [dateFmt(row.fecha), money(row.saldo_inicial), money(row.ingresos), money(row.egresos), money(row.saldo_final), row.estado, row.notas || '-'])}
      />
    </div>
  );
}
