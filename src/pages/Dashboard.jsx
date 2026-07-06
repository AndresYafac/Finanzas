import React from 'react';
import { Banknote, Check, CreditCard, Settings, TrendingUp, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, Modal } from '../components/ui';
import { getDashboardData } from '../services/dashboard.service';
import { calcEstado, dateFmt, money, month } from '../utils/format';

const DASHBOARD_CARDS_KEY = 'fintrack_dashboard_cards';
const DASHBOARD_CARD_OPTIONS = [
  { id: 'balance', label: 'Balance de cuentas', description: 'Saldo total y distribución por cuenta.', Icon: Wallet },
  { id: 'pendiente', label: 'Cuentas por cobrar', description: 'Importe pendiente de cobro.', Icon: CreditCard },
  { id: 'pagos', label: 'Cobros del mes', description: 'Cobros registrados durante el mes actual.', Icon: Banknote },
  { id: 'movimientos', label: 'Ingresos y egresos', description: 'Resumen general de movimientos.', Icon: TrendingUp },
];
const DEFAULT_DASHBOARD_CARDS = DASHBOARD_CARD_OPTIONS.map((item) => item.id);

function MetricCard({ icon, label, value, helper, danger = false, chart }) {
  return <div className="metric-card"><div className="metric-label">{icon}{label}</div><div className={`metric-value ${danger ? 'danger-text' : ''}`}>{value}</div>{chart}<div className="metric-change neutral">{helper}</div></div>;
}

function MiniBarChart({ items, danger = false, split = false }) {
  const cleanItems = items.filter((item) => Number(item.value || 0) > 0).slice(0, 8);
  const max = Math.max(...cleanItems.map((item) => Number(item.value || 0)), 1);
  if (!cleanItems.length) return <div className="mini-chart-empty">Sin datos para gráfico</div>;
  return (
    <div className="mini-chart">
      {cleanItems.map((item, index) => (
        <div className="mini-chart-row" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <div className="mini-chart-track"><i className={`${danger ? 'danger' : ''} ${split && index === 1 ? 'danger' : ''}`} style={{ width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} /></div>
          <b>{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, items, empty }) {
  return (
    <Card title={title}>
      <div className="card-body">
        {items.length ? items.map((item) => <div className="list-row" key={item}>{item}</div>) : <EmptyState>{empty}</EmptyState>}
      </div>
    </Card>
  );
}

export function Dashboard({ supabase, user, isAdmin }) {
  const [data, setData] = React.useState({ deudas: [], pagos: [], cuentas: [], movimientos: [], presupuestos: [], metas: [] });
  const [configOpen, setConfigOpen] = React.useState(false);
  const [draftCards, setDraftCards] = React.useState(DEFAULT_DASHBOARD_CARDS);
  const [visibleCards, setVisibleCards] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DASHBOARD_CARDS_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_DASHBOARD_CARDS;
    } catch {
      return DEFAULT_DASHBOARD_CARDS;
    }
  });

  React.useEffect(() => {
    async function load() {
      setData(await getDashboardData(supabase, user.id));
    }
    load();
  }, [supabase, user.id, isAdmin]);

  React.useEffect(() => {
    localStorage.setItem(DASHBOARD_CARDS_KEY, JSON.stringify(visibleCards));
  }, [visibleCards]);

  const isVisible = (id) => visibleCards.includes(id);
  function openDashboardConfig() {
    setDraftCards(visibleCards);
    setConfigOpen(true);
  }
  function closeDashboardConfig() {
    setConfigOpen(false);
    setDraftCards(visibleCards);
  }
  function saveDashboardConfig() {
    setVisibleCards(draftCards);
    setConfigOpen(false);
  }
  function toggleDraftCard(id) {
    setDraftCards((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const pendiente = data.deudas.reduce((sum, deuda) => sum + Math.max(0, Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0)), 0);
  const ingresos = data.movimientos.filter((movimiento) => movimiento.tipo === 'ingreso').reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const egresos = data.movimientos.filter((movimiento) => movimiento.tipo === 'egreso').reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const pagosMes = data.pagos.filter((pago) => pago.fecha?.startsWith(month())).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const porVencer = data.deudas.filter((deuda) => ['por_vencer', 'vencido'].includes(calcEstado(deuda))).slice(0, 5);
  const movimientosMes = data.movimientos.filter((movimiento) => movimiento.fecha?.startsWith(month()));
  const balanceTotal = data.cuentas.reduce((sum, cuenta) => sum + Number(cuenta.saldo || 0), 0);
  const cobradoDeudas = data.deudas.reduce((sum, deuda) => sum + Number(deuda.monto_pagado || 0), 0);
  const pagosPorDia = data.pagos
    .filter((pago) => pago.fecha?.startsWith(month()))
    .reduce((map, pago) => {
      const day = pago.fecha.slice(-2);
      map[day] = (map[day] || 0) + Number(pago.monto || 0);
      return map;
    }, {});
  const accountChart = data.cuentas.map((cuenta) => ({ label: cuenta.banco, value: Number(cuenta.saldo || 0) }));
  const debtChart = [
    { label: 'Cobrado', value: cobradoDeudas },
    { label: 'Saldo por cobrar', value: pendiente },
  ];
  const paymentsChart = Object.entries(pagosPorDia).slice(-8).map(([label, value]) => ({ label, value }));
  const movementChart = [
    { label: 'Ingresos', value: ingresos },
    { label: 'Egresos', value: egresos },
  ];
  const presupuestoAlerts = data.presupuestos
    .map((presupuesto) => {
      const usado = movimientosMes
        .filter((movimiento) => movimiento.tipo === presupuesto.tipo && ((presupuesto.tipo_movimiento_id && movimiento.tipo_movimiento_id === presupuesto.tipo_movimiento_id) || (!presupuesto.tipo_movimiento_id && (movimiento.categoria || '') === (presupuesto.categoria || ''))))
        .reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
      const limite = Number(presupuesto.monto_limite || 0);
      return { label: presupuesto.tipos_movimiento?.nombre || presupuesto.categoria || presupuesto.tipo, usado, limite, pct: limite ? Math.round((usado / limite) * 100) : 0 };
    })
    .filter((presupuesto) => presupuesto.limite && presupuesto.pct >= 80);
  const metasAlerts = data.metas
    .filter((meta) => meta.estado === 'activa')
    .filter((meta) => Number(meta.monto_objetivo || 0) > 0)
    .map((meta) => ({ ...meta, pct: Math.round((Number(meta.monto_actual || 0) / Number(meta.monto_objetivo || 0)) * 100) }))
    .filter((meta) => meta.pct >= 80)
    .slice(0, 3);

  return (
    <>
      <div className="dashboard-toolbar">
        <Button onClick={openDashboardConfig}><Settings size={16} />Configurar dashboard</Button>
      </div>
      <div className="metrics-grid">
        {isVisible('balance') && <MetricCard icon={<Wallet />} label="Balance cuentas" value={money(balanceTotal)} helper={`${data.cuentas.length} cuentas activas`} chart={<MiniBarChart items={accountChart} />} />}
        {isVisible('pendiente') && <MetricCard icon={<CreditCard />} label="Cuentas por cobrar" value={money(pendiente)} helper={`${data.deudas.filter((deuda) => calcEstado(deuda) !== 'pagado').length} cuentas activas`} danger chart={<MiniBarChart items={debtChart} danger />} />}
        {isVisible('pagos') && <MetricCard icon={<Banknote />} label="Cobros del mes" value={money(pagosMes)} helper={`${data.pagos.filter((pago) => pago.fecha?.startsWith(month())).length} cobros`} chart={<MiniBarChart items={paymentsChart} />} />}
        {isVisible('movimientos') && <MetricCard icon={<TrendingUp />} label="Ingresos y egresos" value={`${money(ingresos)} / ${money(egresos)}`} helper="Movimientos generales" chart={<MiniBarChart items={movementChart} split />} />}
      </div>
      {!visibleCards.length && <Card className="empty-dashboard"><div className="card-body muted">Activa al menos una tarjeta desde Configurar dashboard.</div></Card>}
      <div className="grid-2">
        <ListCard title="Cuentas por cobrar por vencer" empty="Sin cuentas por cobrar por vencer" items={porVencer.map((deuda) => `${deuda.clientes?.nombre || ''} - ${deuda.descripcion}: ${money(Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0))}`)} />
        <ListCard title="Últimos cobros recibidos" empty="Sin cobros registrados" items={data.pagos.slice(0, 5).map((pago) => `${dateFmt(pago.fecha)} - ${pago.clientes?.nombre || ''}: ${money(pago.monto)}`)} />
      </div>
      <div className="grid-2 dashboard-extra">
        <ListCard title="Alertas de presupuesto" empty="Sin presupuestos en alerta" items={presupuestoAlerts.map((presupuesto) => `${presupuesto.label}: ${money(presupuesto.usado)} de ${money(presupuesto.limite)} (${presupuesto.pct}%)`)} />
        <ListCard title="Metas próximas" empty="Sin metas próximas" items={metasAlerts.map((meta) => `${meta.nombre}: ${meta.pct}% completado (${money(meta.monto_actual)} / ${money(meta.monto_objetivo)})`)} />
      </div>
      <Modal open={configOpen} title="Configurar dashboard" onClose={closeDashboardConfig}>
        <div className="modal-body">
          <div className="dashboard-config-hero">
            <div>
              <strong>Personaliza tu resumen</strong>
              <p>Activa solo las tarjetas que necesitas ver al iniciar sesión.</p>
            </div>
            <span>{draftCards.length}/{DASHBOARD_CARD_OPTIONS.length} activas</span>
          </div>
          <div className="dashboard-options-grid">
            {DASHBOARD_CARD_OPTIONS.map((card) => {
              const active = draftCards.includes(card.id);
              const Icon = card.Icon;
              return (
                <button key={card.id} type="button" className={`dashboard-option-card ${active ? 'active' : ''}`} onClick={() => toggleDraftCard(card.id)}>
                  <span className="dashboard-option-icon"><Icon size={22} /></span>
                  <span className="dashboard-option-copy">
                    <b>{card.label}</b>
                    <small>{card.description}</small>
                  </span>
                  <span className="dashboard-option-check">{active ? <Check size={16} /> : null}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <Button onClick={() => setDraftCards(DEFAULT_DASHBOARD_CARDS)}>Restablecer</Button>
          <Button onClick={closeDashboardConfig}>Cancelar</Button>
          <Button variant="primary" onClick={saveDashboardConfig}>Guardar</Button>
        </div>
      </Modal>
    </>
  );
}

