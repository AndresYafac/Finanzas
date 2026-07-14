import React from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Button, Card, Field, TableSection } from '../../components/ui';
import { notify } from '../../services/feedback';
import { buildMonthlyClosureSnapshot, listMonthlyClosures, saveMonthlyClosure } from '../../services/monthlyClosure.service';
import { money, month } from '../../utils/format';

export function CierreMensual({ supabase, user, can = () => true }) {
  const [selectedMonth, setSelectedMonth] = React.useState(month());
  const [snapshot, setSnapshot] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [notas, setNotas] = React.useState('');

  const load = React.useCallback(async () => {
    const [snapshotResult, closuresResult] = await Promise.all([
      buildMonthlyClosureSnapshot(supabase, user.id, selectedMonth),
      listMonthlyClosures(supabase, user.id),
    ]);
    setSnapshot(snapshotResult);
    setRows(closuresResult.data || []);
  }, [supabase, user.id, selectedMonth]);

  React.useEffect(() => { load(); }, [load]);

  async function closeMonth() {
    if (!can('create')) return notify('No tienes permiso para crear cierres.', 'error');
    const { error } = await saveMonthlyClosure(supabase, user.id, user.id, { ...snapshot, notas });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Cierre mensual guardado correctamente.', 'success');
    setNotas('');
    load();
  }

  return (
    <div className="feature-page">
      <Card title="Cierre mensual" action={<Button onClick={load}><RefreshCw size={16} />Actualizar</Button>}>
        <div className="card-body feature-grid">
          <Field label="Mes a cerrar" type="month" value={selectedMonth} onChange={setSelectedMonth} />
          <Field label="Notas" value={notas} onChange={setNotas} placeholder="Observaciones del cierre..." />
          {snapshot && (
            <div className="summary-grid wide">
              <div><span>Saldo cuentas</span><strong>{money(snapshot.saldo_cuentas)}</strong></div>
              <div><span>Ingresos</span><strong>{money(snapshot.total_ingresos)}</strong></div>
              <div><span>Egresos</span><strong>{money(snapshot.total_egresos)}</strong></div>
              <div><span>Por cobrar</span><strong>{money(snapshot.total_por_cobrar)}</strong></div>
              <div><span>Por pagar</span><strong>{money(snapshot.total_por_pagar)}</strong></div>
            </div>
          )}
          <Button variant="primary" onClick={closeMonth}><Check size={16} />Guardar cierre</Button>
        </div>
      </Card>
      <TableSection
        title="Historial de cierres"
        columns={['Mes', 'Saldo cuentas', 'Ingresos', 'Egresos', 'Por cobrar', 'Por pagar', 'Notas']}
        rows={rows.map((row) => [row.mes, money(row.saldo_cuentas), money(row.total_ingresos), money(row.total_egresos), money(row.total_por_cobrar), money(row.total_por_pagar), row.notas || '-'])}
      />
    </div>
  );
}
