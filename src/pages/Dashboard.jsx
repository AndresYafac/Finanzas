import React from 'react';
import { Banknote, BarChart3, Check, CreditCard, FileText, Maximize2, Settings, Settings2, TrendingUp, Wallet, X } from 'lucide-react';
import { getDashboardData } from '../services/dashboard.service';
import { DynamicChart } from '../components/DynamicChart';
import { ChartConfig } from '../components/ChartConfig';
import { prepareChartData } from '../services/chartData.service';
import { convertAmount, formatCurrency, getCurrencyConfig, summarizeByCurrency } from '../services/currency.service';
import { getDashboardPreferences, saveDashboardPreferences } from '../services/userSettings.service';
import { calcEstado, dateFmt, money, month } from '../utils/format';

const DASHBOARD_CARDS_KEY = 'fintrack_dashboard_cards';
const DASHBOARD_CHART_KEY = 'fintrack_dashboard_chart';
const dashboardStorageKey = (baseKey, userId) => `${baseKey}:${userId || 'guest'}`;
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

function DashboardModal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="tailwind-page fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 p-4">
      <section className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_72px_rgba(15,23,42,0.20)] ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 p-5 sm:p-6">{children}</div>
        {footer && <footer className="border-t border-slate-200 bg-white px-5 py-4">{footer}</footer>}
      </section>
    </div>
  );
}

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

function getLocalDashboardPreferences(userId) {
  let cards = DEFAULT_DASHBOARD_CARDS;
  let charts = [createDefaultChartConfig()];

  try {
    const savedCards = JSON.parse(localStorage.getItem(dashboardStorageKey(DASHBOARD_CARDS_KEY, userId)) || 'null');
    cards = Array.isArray(savedCards) && savedCards.length ? savedCards : DEFAULT_DASHBOARD_CARDS;
  } catch {
    cards = DEFAULT_DASHBOARD_CARDS;
  }

  try {
    const savedCharts = JSON.parse(localStorage.getItem(dashboardStorageKey(DASHBOARD_CHART_KEY, userId)) || 'null');
    charts = normalizeChartConfigs(savedCharts);
  } catch {
    charts = [createDefaultChartConfig()];
  }

  return { cards, charts };
}

function saveLocalDashboardPreferences(userId, preferences) {
  if (preferences.cards !== undefined) {
    localStorage.setItem(dashboardStorageKey(DASHBOARD_CARDS_KEY, userId), JSON.stringify(preferences.cards));
  }
  if (preferences.charts !== undefined) {
    localStorage.setItem(dashboardStorageKey(DASHBOARD_CHART_KEY, userId), JSON.stringify(preferences.charts));
  }
}

function MetricCard({ icon, label, value, helper, danger = false, chart }) {
  const valueClass = danger ? 'text-red-500' : 'text-slate-950';
  return (
    <section className="relative flex min-h-[220px] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 border-l-4 border-l-fintrack-green bg-white p-6 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100/80" />
      <div className="relative flex items-center gap-2 text-xs font-black uppercase tracking-[0.04em] text-slate-500 [&_svg]:h-5 [&_svg]:w-5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`relative mt-4 text-[32px] font-black leading-none tracking-tight ${valueClass}`}>{value}</div>
      {chart && <div className="relative mt-5 w-full min-w-0 flex-1">{chart}</div>}
      <div className="relative mt-4 text-sm font-bold text-slate-500">{helper}</div>
    </section>
  );
}
function MiniBarChart({ items, danger = false, split = false }) {
  const cleanItems = items.filter((item) => Number(item.value || 0) > 0).slice(0, 8);
  const max = Math.max(...cleanItems.map((item) => Number(item.value || 0)), 1);
  if (!cleanItems.length) return <div className="w-full rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-medium text-slate-500">Sin datos para grafico</div>;
  const fillColor = (index) => (
    danger || (split && index === 1)
      ? 'linear-gradient(90deg, #ef4444 0%, #fb923c 100%)'
      : 'linear-gradient(90deg, #1d9e75 0%, #52c7a1 100%)'
  );
  return (
    <div className="w-full space-y-2.5">
      {cleanItems.map((item, index) => (
        <div className="grid w-full grid-cols-[84px_minmax(120px,1fr)_92px] items-center gap-3 text-xs" key={`${item.label}-${index}`}>
          <span className="min-w-0 truncate text-slate-500" title={item.label}>{item.label}</span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%`,
                background: fillColor(index),
              }}
            />
          </div>
          <b className="whitespace-nowrap text-right font-black text-slate-800">{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, items, empty }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-soft">
      <header className="border-b border-slate-200/80 px-5 py-4">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
      </header>
      <div className="min-h-[150px] p-5">
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700" key={item}>{item}</div>)}
          </div>
        ) : (
          <div className="flex min-h-[110px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">{empty}</div>
        )}
      </div>
    </section>
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
  const [visibleCards, setVisibleCards] = React.useState(DEFAULT_DASHBOARD_CARDS);
  const [chartConfigs, setChartConfigs] = React.useState(() => [createDefaultChartConfig()]);
  const preferencesLoadedRef = React.useRef(false);

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
    let active = true;

    async function loadPreferences() {
      preferencesLoadedRef.current = false;
      const localPreferences = getLocalDashboardPreferences(user.id);
      setVisibleCards(localPreferences.cards);
      setChartConfigs(localPreferences.charts);

      const { data: remotePreferences, error } = await getDashboardPreferences(supabase, user.id);
      if (!active) return;

      if (!error && remotePreferences) {
        const remoteCards = Array.isArray(remotePreferences.cards) && remotePreferences.cards.length
          ? remotePreferences.cards
          : DEFAULT_DASHBOARD_CARDS;
        const remoteCharts = normalizeChartConfigs(remotePreferences.charts);
        setVisibleCards(remoteCards);
        setChartConfigs(remoteCharts);
        saveLocalDashboardPreferences(user.id, { cards: remoteCards, charts: remoteCharts });
      } else if (!error) {
        await saveDashboardPreferences(supabase, user.id, localPreferences);
      }

      if (active) preferencesLoadedRef.current = true;
    }

    loadPreferences();
    return () => {
      active = false;
    };
  }, [supabase, user.id]);

  React.useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    saveLocalDashboardPreferences(user.id, { cards: visibleCards });
    saveDashboardPreferences(supabase, user.id, { cards: visibleCards });
  }, [supabase, visibleCards, user.id]);

  React.useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    saveLocalDashboardPreferences(user.id, { charts: chartConfigs });
    saveDashboardPreferences(supabase, user.id, { charts: chartConfigs });
  }, [chartConfigs, supabase, user.id]);

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
  const periodButtonClass = (id) => `rounded-xl border px-4 py-2 text-sm font-black transition ${period === id ? 'border-fintrack-green bg-fintrack-green text-white shadow-glow' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950'}`;
  const toolbarButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-fintrack-green hover:text-fintrack-green hover:shadow-soft active:translate-y-0';
  const footerButtonClass = 'rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50';
  const footerPrimaryClass = 'rounded-2xl border border-fintrack-green bg-fintrack-green px-5 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-fintrack-greenDark';

  return (
    <div className={`tailwind-page ${presentation ? 'dashboard-presentation' : ''}`}>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button className={periodButtonClass('month')} type="button" onClick={() => setPeriod('month')}>Este mes</button>
          <button className={periodButtonClass('quarter')} type="button" onClick={() => setPeriod('quarter')}>Ultimos 3 meses</button>
          <button className={periodButtonClass('all')} type="button" onClick={() => setPeriod('all')}>Todo</button>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
          <button className={toolbarButtonClass} type="button" onClick={exportDashboardPdf}><FileText size={16} />Exportar PDF</button>
          <button className={toolbarButtonClass} type="button" onClick={() => setPresentation((value) => !value)}><Maximize2 size={16} />{presentation ? 'Salir presentacion' : 'Presentacion'}</button>
          <button className={toolbarButtonClass} type="button" onClick={openDashboardConfig}><Settings size={16} />Configurar dashboard</button>
          <button className={toolbarButtonClass} type="button" onClick={openChartConfig}><BarChart3 size={16} />Configurar grafico</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {visibleCards.map((cardId) => {
          if (cardId === 'balance') return <MetricCard key={cardId} icon={<Wallet />} label={`Balance consolidado (${currencyConfig.base})`} value={formatCurrency(balanceTotal, currencyConfig.base)} helper={`${data.cuentas.length} cuentas - ${Object.entries(balanceByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(' / ') || 'sin saldos'}`} trend={balanceTotal > 0 ? 'up' : 'neutral'} chart={<MiniBarChart items={accountChart} />} />;
          if (cardId === 'pendiente') return <MetricCard key={cardId} icon={<CreditCard />} label="Cuentas por cobrar" value={money(pendiente)} helper={`${data.deudas.filter((deuda) => calcEstado(deuda) !== 'pagado').length} cuentas activas`} danger trend="down" chart={<MiniBarChart items={debtChart} danger />} />;
          if (cardId === 'pagos') return <MetricCard key={cardId} icon={<Banknote />} label="Cobros del mes" value={money(pagosMes)} helper={`${data.pagos.filter((pago) => pago.fecha?.startsWith(currentMonth)).length} cobros`} trend={pagosMes > 0 ? 'up' : 'neutral'} chart={<MiniBarChart items={paymentsChart} />} />;
          if (cardId === 'movimientos') return <MetricCard key={cardId} icon={<TrendingUp />} label="Ingresos y egresos" value={`${money(ingresos)} / ${money(egresos)}`} helper={`Ahorro ${money(ahorroActual)} - variacion ${variacionAhorro}%`} trend={ingresos >= egresos ? 'up' : 'down'} chart={<MiniBarChart items={movementChart} split />} />;
          return null;
        })}
      </div>
      {!visibleCards.length && <section className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-soft">Activa al menos una tarjeta desde Configurar dashboard.</section>}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ListCard title="Cuentas por cobrar por vencer" empty="Sin cuentas por cobrar por vencer" items={porVencer.map((deuda) => `${deuda.clientes?.nombre || ''} - ${deuda.descripcion}: ${money(Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0))}`)} />
        <ListCard title="Ultimos cobros recibidos" empty="Sin cobros registrados" items={data.pagos.slice(0, 5).map((pago) => `${dateFmt(pago.fecha)} - ${pago.clientes?.nombre || ''}: ${money(pago.monto)}`)} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ListCard title="Alertas de presupuesto" empty="Sin presupuestos en alerta" items={presupuestoAlerts.map((presupuesto) => `${presupuesto.label}: ${money(presupuesto.usado)} de ${money(presupuesto.limite)} (${presupuesto.pct}%)`)} />
        <ListCard title="Metas proximas" empty="Sin metas proximas" items={metasAlerts.map((meta) => `${meta.nombre}: ${meta.pct}% completado (${money(meta.monto_actual)} / ${money(meta.monto_objetivo)})`)} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {chartsDataResults.map((result, index) => {
          const config = result.config;
          const sources = result.sources;
          const dataMap = result.dataMap;

          const allData = sources.flatMap((source) => dataMap[source]?.data || []);
          const firstConfig = sources.map((source) => dataMap[source]?.config).find(Boolean) || {};

          if (allData.length === 0) return null;

          return (
            <section key={index} className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
                <h3 className="text-base font-black text-slate-950">
                  {sources.map((s) => DATA_SOURCES_LABELS[s] || s).join(' + ')}
                </h3>
                <div>
                  <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-fintrack-green hover:text-fintrack-green" onClick={openChartConfig} title="Configurar graficos">
                    <Settings2 size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4">
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
              </div>
            </section>
          );
        })}
      </div>
      <DashboardModal
        open={configOpen}
        title="Configurar dashboard"
        onClose={closeDashboardConfig}
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className={footerButtonClass} type="button" onClick={() => setDraftCards(DEFAULT_DASHBOARD_CARDS)}>Restablecer</button>
            <button className={footerButtonClass} type="button" onClick={closeDashboardConfig}>Cancelar</button>
            <button className={footerPrimaryClass} type="button" onClick={saveDashboardConfig}>Guardar</button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="block text-lg font-black text-slate-950">Personaliza tu resumen</strong>
              <p className="mt-1 text-sm font-medium text-slate-500">Activa solo las tarjetas que necesitas ver al iniciar sesion.</p>
            </div>
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-fintrack-green">{draftCards.length}/{DASHBOARD_CARD_OPTIONS.length} activas</span>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-500 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">Las tarjetas ocultas no se muestran en el dashboard. El orden se mantiene segun esta lista.</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DASHBOARD_CARD_OPTIONS.map((card) => {
              const active = draftCards.includes(card.id);
              const Icon = card.Icon;
              return (
                <div
                  key={card.id}
                  className={`flex min-h-[142px] flex-col rounded-3xl border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.10)] transition ${active ? 'border-fintrack-green bg-emerald-50/55 ring-2 ring-emerald-100' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${active ? 'border-emerald-200 bg-emerald-50 text-fintrack-green' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><Icon size={21} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm font-black leading-snug text-slate-950">{card.label}</b>
                      <small className="mt-1 block text-sm font-medium leading-relaxed text-slate-500">{card.description}</small>
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`mt-4 inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-xl border px-4 py-2.5 text-sm font-black transition ${active ? 'border-fintrack-green bg-fintrack-green text-white shadow-sm hover:bg-fintrack-greenDark' : 'border-slate-300 bg-white text-slate-700 hover:border-fintrack-green hover:text-fintrack-green'}`}
                    onClick={() => toggleDraftCard(card.id)}
                  >
                    {active ? <><Check size={15} /> Visible</> : 'Activar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </DashboardModal>
      <DashboardModal open={chartConfigOpen} title="Configurar graficos" onClose={closeChartConfig} footer={chartConfigFooter} wide>
        <ChartConfig configs={chartConfigs} onChange={saveChartConfig} onClose={closeChartConfig} onActionsChange={setChartConfigFooter} />
      </DashboardModal>
    </div>
  );
}

