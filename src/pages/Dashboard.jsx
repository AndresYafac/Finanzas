import React from 'react';
import { Banknote, BarChart3, Check, CreditCard, FileText, Maximize2, Settings, Settings2, TrendingUp, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, Modal } from '../components/ui';
import { getDashboardData } from '../services/dashboard.service';
import { DynamicChart } from '../components/DynamicChart';
import { ChartConfig } from '../components/ChartConfig';
import { prepareChartData } from '../services/chartData.service';
import { convertAmount, formatCurrency, getCurrencyConfig, summarizeByCurrency } from '../services/currency.service';
import { calcEstado, dateFmt, money, month } from '../utils/format';

const DASHBOARD_CARDS_KEY = 'fintrack_dashboard_cards';
const DASHBOARD_CHART_KEY = 'fintrack_dashboard_chart';
const DASHBOARD_CARD_OPTIONS = [
  { id: 'balance', label: 'Balance de cuentas', description: 'Saldo total y distribucion por cuenta.', Icon: Wallet },
  { id: 'pendiente', label: 'Cuentas por cobrar', description: 'Importe pendiente de cobro.', Icon: CreditCard },
  { id: 'pagos', label: 'Cobros del mes', description: 'Cobros registrados durante el mes actual.', Icon: Banknote },
  { id: 'movimientos', label: 'Ingresos y egresos', description: 'Resumen general de movimientos.', Icon: TrendingUp },
];
const DEFAULT_DASHBOARD_CARDS = DASHBOARD_CARD_OPTIONS.map((item) => item.id);
const DATA_SOURCES_LABELS = {
  accounts: 'Balance de cuentas',
  debts: 'Cuentas por cobrar',
  payments: 'Cobros del mes',
  movements: 'Ingresos vs Egresos',
  budgets: 'Presupuestos',
  goals: 'Metas',
};
const DEFAULT_CHART_CONFIG = {
  type: 'bar',
  dataSources: ['accounts'],
  height: 300,
  showGrid: true,
  showLegend: true,
  showTooltip: true,
  curved: false,
};

function createDefaultChartConfig() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now();
  return { ...DEFAULT_CHART_CONFIG, id };
}

function normalizeChartConfigs(configs) {
  const list = Array.isArray(configs) && configs.length ? configs : [createDefaultChartConfig()];
  return list.map((config) => ({
    ...DEFAULT_CHART_CONFIG,
    ...config,
    id: config?.id || createDefaultChartConfig().id,
    dataSources: Array.isArray(config?.dataSources) && config.dataSources.length ? config.dataSources : DEFAULT_CHART_CONFIG.dataSources,
    height: Math.min(600, Math.max(200, Number(config?.height || DEFAULT_CHART_CONFIG.height))),
    showGrid: config?.showGrid !== false,
    showLegend: config?.showLegend !== false,
    showTooltip: config?.showTooltip !== false,
    curved: Boolean(config?.curved),
  }));
}

function MetricCard({ icon, label, value, helper, danger = false, chart }) {
  const valueClass = "metric-value " + (danger ? "danger-text" : "");
  return (
    <div className="metric-card">
      <div className="metric-label">{icon}{label}</div>
      <div className={valueClass}>{value}</div>
      {chart && <div className="metric-card-chart">{chart}</div>}
      <div className="metric-change neutral">{helper}</div>
    </div>
  );
}
function MiniBarChart({ items, danger = false, split = false }) {
  const cleanItems = items.filter((item) => Number(item.value || 0) > 0).slice(0, 8);
  const max = Math.max(...cleanItems.map((item) => Number(item.value || 0)), 1);
  if (!cleanItems.length) return <div className="mini-chart-empty">Sin datos para grafico</div>;
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
  const [period, setPeriod] = React.useState('month');
  const [presentation, setPresentation] = React.useState(false);
  const [currencyConfig, setCurrencyConfig] = React.useState(getCurrencyConfig);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [chartConfigOpen, setChartConfigOpen] = React.useState(false);
  const [chartConfigFooter, setChartConfigFooter] = React.useState(null);
  const [draftCards, setDraftCards] = React.useState(DEFAULT_DASHBOARD_CARDS);
  const [visibleCards, setVisibleCards] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DASHBOARD_CARDS_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_DASHBOARD_CARDS;
    } catch {
      return DEFAULT_DASHBOARD_CARDS;
    }
  });
  const [chartConfigs, setChartConfigs] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DASHBOARD_CHART_KEY) || 'null');
      return normalizeChartConfigs(saved);
    } catch {
      return [createDefaultChartConfig()];
    }
  });

  React.useEffect(() => {
    async function load() {
      setData(await getDashboardData(supabase, user.id));
    }
    load();
  }, [supabase, user.id, isAdmin]);

  React.useEffect(() => {
    const syncCurrency = () => setCurrencyConfig(getCurrencyConfig());
    window.addEventListener('fintrack_currency_config', syncCurrency);
    return () => window.removeEventListener('fintrack_currency_config', syncCurrency);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(DASHBOARD_CARDS_KEY, JSON.stringify(visibleCards));
  }, [visibleCards]);

  React.useEffect(() => {
    localStorage.setItem(DASHBOARD_CHART_KEY, JSON.stringify(chartConfigs));
  }, [chartConfigs]);

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
  const openChartConfig = React.useCallback(() => {
    setChartConfigOpen(true);
  }, []);
  const closeChartConfig = React.useCallback(() => {
    setChartConfigOpen(false);
  }, []);
  const saveChartConfig = React.useCallback((newConfigs) => {
    setChartConfigs(normalizeChartConfigs(newConfigs));
    setChartConfigOpen(false);
  }, []);

  const pendiente = data.deudas.reduce((sum, deuda) => sum + Math.max(0, Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0)), 0);
  const currentMonth = month();
  const previousMonthDate = new Date(`${currentMonth}-01T00:00:00`);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const periodStart = period === 'all' ? '' : period === 'quarter' ? (() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return date.toISOString().slice(0, 7);
  })() : currentMonth;
  const periodMovimientos = periodStart ? data.movimientos.filter((movimiento) => movimiento.fecha?.slice(0, 7) >= periodStart) : data.movimientos;
  const ingresos = periodMovimientos.filter((movimiento) => movimiento.tipo === 'ingreso').reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const egresos = periodMovimientos.filter((movimiento) => movimiento.tipo === 'egreso').reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const pagosMes = data.pagos.filter((pago) => pago.fecha?.startsWith(currentMonth)).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const ingresosMesAnterior = data.movimientos.filter((movimiento) => movimiento.tipo === 'ingreso' && movimiento.fecha?.startsWith(previousMonth)).reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const egresosMesAnterior = data.movimientos.filter((movimiento) => movimiento.tipo === 'egreso' && movimiento.fecha?.startsWith(previousMonth)).reduce((sum, movimiento) => sum + Number(movimiento.monto || 0), 0);
  const porVencer = data.deudas.filter((deuda) => ['por_vencer', 'vencido'].includes(calcEstado(deuda))).slice(0, 5);
  const movimientosMes = data.movimientos.filter((movimiento) => movimiento.fecha?.startsWith(currentMonth));
  const balanceTotal = data.cuentas.reduce((sum, cuenta) => sum + convertAmount(cuenta.saldo, cuenta.moneda || 'PEN', currencyConfig.base, currencyConfig), 0);
  const balanceByCurrency = summarizeByCurrency(data.cuentas, 'saldo', 'moneda');
  const pagosPorDia = data.pagos
    .filter((pago) => pago.fecha?.startsWith(month()))
    .reduce((map, pago) => {
      const day = pago.fecha.slice(-2);
      map[day] = (map[day] || 0) + Number(pago.monto || 0);
      return map;
    }, {});
  const accountChart = data.cuentas.map((cuenta) => ({ label: cuenta.banco, value: Number(cuenta.saldo || 0) }));
  const debtChart = [
    { label: 'Saldo por cobrar', value: pendiente },
  ];
  const paymentsChart = Object.entries(pagosPorDia).slice(-8).map(([label, value]) => ({ label, value }));
  const movementChart = [
    { label: 'Ingresos', value: ingresos },
    { label: 'Egresos', value: egresos },
  ];
  const ahorroActual = ingresos - egresos;
  const ahorroAnterior = ingresosMesAnterior - egresosMesAnterior;
  const variacionAhorro = ahorroAnterior ? Math.round(((ahorroActual - ahorroAnterior) / Math.abs(ahorroAnterior)) * 100) : 0;
  function exportDashboardPdf() {
    const html = `<!doctype html><html><head><title>Dashboard FinTrack</title><style>
      body{font-family:Arial,sans-serif;margin:28px;color:#122033} h1{margin:0 0 6px}.muted{color:#64748b;font-size:12px;margin-bottom:18px}
      .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{border:1px solid #dbe5ee;border-radius:14px;padding:16px}
      .label{color:#64748b;text-transform:uppercase;font-size:11px;font-weight:700}.value{font-size:24px;font-weight:900;margin-top:8px}
      ul{margin:8px 0 0 18px;padding:0} li{margin:5px 0}
    </style></head><body>
      <h1>Dashboard FinTrack</h1><div class="muted">Generado: ${new Date().toLocaleString('es-PE')} - Moneda base: ${currencyConfig.base}</div>
      <div class="cards">
        <div class="card"><div class="label">Balance consolidado</div><div class="value">${formatCurrency(balanceTotal, currencyConfig.base)}</div></div>
        <div class="card"><div class="label">Pendiente por cobrar</div><div class="value">${money(pendiente)}</div></div>
        <div class="card"><div class="label">Ingresos / Egresos</div><div class="value">${money(ingresos)} / ${money(egresos)}</div></div>
        <div class="card"><div class="label">Cobros del mes</div><div class="value">${money(pagosMes)}</div></div>
      </div>
      <h2>Alertas</h2><ul>${porVencer.map((d) => `<li>${d.descripcion || 'Cuenta'}: ${money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}</li>`).join('') || '<li>Sin alertas</li>'}</ul>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }
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

  const chartsDataResults = chartConfigs.map((config) => ({
    config,
    ...prepareChartData(config.dataSources, data),
  }));

  return (
    <div className={presentation ? 'dashboard-presentation' : ''}>
      <div className="dashboard-toolbar">
        <div className="dashboard-period-tabs">
          <button className={period === 'month' ? 'active' : ''} type="button" onClick={() => setPeriod('month')}>Este mes</button>
          <button className={period === 'quarter' ? 'active' : ''} type="button" onClick={() => setPeriod('quarter')}>Ultimos 3 meses</button>
          <button className={period === 'all' ? 'active' : ''} type="button" onClick={() => setPeriod('all')}>Todo</button>
        </div>
        <Button onClick={exportDashboardPdf}><FileText size={16} />Exportar PDF</Button>
        <Button onClick={() => setPresentation((value) => !value)}><Maximize2 size={16} />{presentation ? 'Salir presentacion' : 'Presentacion'}</Button>
        <Button onClick={openDashboardConfig}><Settings size={16} />Configurar dashboard</Button>
        <Button onClick={openChartConfig}><BarChart3 size={16} />Configurar grafico</Button>
      </div>
      <div className="metrics-grid">
        {visibleCards.map((cardId) => {
          if (cardId === 'balance') return <MetricCard key={cardId} icon={<Wallet />} label={`Balance consolidado (${currencyConfig.base})`} value={formatCurrency(balanceTotal, currencyConfig.base)} helper={`${data.cuentas.length} cuentas - ${Object.entries(balanceByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(' / ') || 'sin saldos'}`} trend={balanceTotal > 0 ? 'up' : 'neutral'} chart={<MiniBarChart items={accountChart} />} />;
          if (cardId === 'pendiente') return <MetricCard key={cardId} icon={<CreditCard />} label="Cuentas por cobrar" value={money(pendiente)} helper={`${data.deudas.filter((deuda) => calcEstado(deuda) !== 'pagado').length} cuentas activas`} danger trend="down" chart={<MiniBarChart items={debtChart} danger />} />;
          if (cardId === 'pagos') return <MetricCard key={cardId} icon={<Banknote />} label="Cobros del mes" value={money(pagosMes)} helper={`${data.pagos.filter((pago) => pago.fecha?.startsWith(currentMonth)).length} cobros`} trend={pagosMes > 0 ? 'up' : 'neutral'} chart={<MiniBarChart items={paymentsChart} />} />;
          if (cardId === 'movimientos') return <MetricCard key={cardId} icon={<TrendingUp />} label="Ingresos y egresos" value={`${money(ingresos)} / ${money(egresos)}`} helper={`Ahorro ${money(ahorroActual)} - variacion ${variacionAhorro}%`} trend={ingresos >= egresos ? 'up' : 'down'} chart={<MiniBarChart items={movementChart} split />} />;
          return null;
        })}
      </div>
      {!visibleCards.length && <Card className="empty-dashboard"><div className="card-body muted">Activa al menos una tarjeta desde Configurar dashboard.</div></Card>}
      <div className="grid-2">
        <ListCard title="Cuentas por cobrar por vencer" empty="Sin cuentas por cobrar por vencer" items={porVencer.map((deuda) => `${deuda.clientes?.nombre || ''} - ${deuda.descripcion}: ${money(Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0))}`)} />
        <ListCard title="Ultimos cobros recibidos" empty="Sin cobros registrados" items={data.pagos.slice(0, 5).map((pago) => `${dateFmt(pago.fecha)} - ${pago.clientes?.nombre || ''}: ${money(pago.monto)}`)} />
      </div>
      <div className="grid-2 dashboard-extra">
        <ListCard title="Alertas de presupuesto" empty="Sin presupuestos en alerta" items={presupuestoAlerts.map((presupuesto) => `${presupuesto.label}: ${money(presupuesto.usado)} de ${money(presupuesto.limite)} (${presupuesto.pct}%)`)} />
        <ListCard title="Metas proximas" empty="Sin metas proximas" items={metasAlerts.map((meta) => `${meta.nombre}: ${meta.pct}% completado (${money(meta.monto_actual)} / ${money(meta.monto_objetivo)})`)} />
      </div>
      <div className="charts-grid">
        {chartsDataResults.map((result, index) => {
          const config = result.config;
          const sources = result.sources;
          const dataMap = result.dataMap;

          const allData = sources.flatMap((source) => dataMap[source]?.data || []);
          const firstConfig = sources.map((source) => dataMap[source]?.config).find(Boolean) || {};

          if (allData.length === 0) return null;

          return (
            <Card key={index} className="chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {sources.map((s) => DATA_SOURCES_LABELS[s] || s).join(' + ')}
                </h3>
                <div className="chart-card-actions">
                  <button onClick={openChartConfig} title="Configurar graficos">
                    <Settings2 size={18} />
                  </button>
                </div>
              </div>
              <DynamicChart
                type={config.type}
                data={allData}
                config={{
                  ...firstConfig,
                  showGrid: config.showGrid,
                  showLegend: config.showLegend,
                  showTooltip: config.showTooltip,
                  curved: config.curved,
                }}
                height={config.height}
              />
            </Card>
          );
        })}
      </div>
      <Modal open={configOpen} title="Configurar dashboard" onClose={closeDashboardConfig}>
        <div className="modal-body">
          <div className="dashboard-config-hero">
            <div>
              <strong>Personaliza tu resumen</strong>
              <p>Activa solo las tarjetas que necesitas ver al iniciar sesion.</p>
            </div>
            <span>{draftCards.length}/{DASHBOARD_CARD_OPTIONS.length} activas</span>
          </div>
          <div className="dashboard-config-help">Las tarjetas ocultas no se muestran en el dashboard. El orden se mantiene segun esta lista.</div>
          <div className="dashboard-options-grid">
            {DASHBOARD_CARD_OPTIONS.map((card) => {
              const active = draftCards.includes(card.id);
              const Icon = card.Icon;
              return (
                <div
                  key={card.id}
                  className={`dashboard-option-card ${active ? 'active' : ''}`}
                >
                  <span className="dashboard-option-icon"><Icon size={22} /></span>
                  <span className="dashboard-option-copy">
                    <b>{card.label}</b>
                    <small>{card.description}</small>
                  </span>
                  <button
                    type="button"
                    className={`dashboard-option-toggle ${active ? 'active' : ''}`}
                    onClick={() => toggleDraftCard(card.id)}
                  >
                    {active ? <><Check size={15} /> Visible</> : 'Activar'}
                  </button>
                </div>
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
      <Modal open={chartConfigOpen} title="Configurar graficos" onClose={closeChartConfig} className="chart-config-modal" footer={chartConfigFooter}>
        <div className="modal-body">
          <ChartConfig configs={chartConfigs} onChange={saveChartConfig} onClose={closeChartConfig} onActionsChange={setChartConfigFooter} />
        </div>
      </Modal>
    </div>
  );
}

