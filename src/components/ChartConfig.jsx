import React from 'react';
import { AreaChart, BarChart3, Check, LineChart, PieChart, Plus, Trash2 } from 'lucide-react';

const CHART_TYPES = [
  { id: 'bar', label: 'Barras', Icon: BarChart3, description: 'Comparativa entre categorias' },
  { id: 'line', label: 'Lineas', Icon: LineChart, description: 'Tendencias temporales' },
  { id: 'area', label: 'Area', Icon: AreaChart, description: 'Volumen acumulado' },
  { id: 'pie', label: 'Circular', Icon: PieChart, description: 'Distribucion porcentual' },
];

const DATA_SOURCES = [
  { id: 'accounts', label: 'Balance de cuentas', description: 'Saldo por cuenta bancaria' },
  { id: 'debts', label: 'Cuentas por cobrar', description: 'Cuentas pendientes y cobradas' },
  { id: 'payments', label: 'Cobros del mes', description: 'Cobros por dia del mes' },
  { id: 'movements', label: 'Ingresos vs Egresos', description: 'Comparativa de movimientos' },
  { id: 'budgets', label: 'Presupuestos', description: 'Uso de presupuestos' },
  { id: 'goals', label: 'Metas', description: 'Progreso de metas' },
];

const DEFAULT_CHART_CONFIG = {
  type: 'bar',
  dataSources: ['accounts'],
  height: 300,
  showGrid: true,
  showLegend: true,
  showTooltip: true,
  curved: false,
};

function createDefaultConfig() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now();
  return { ...DEFAULT_CHART_CONFIG, id };
}

function normalizeConfig(config) {
  const validSources = Array.isArray(config?.dataSources)
    ? config.dataSources.filter((source) => DATA_SOURCES.some((item) => item.id === source))
    : [];

  return {
    ...DEFAULT_CHART_CONFIG,
    ...config,
    id: config?.id || createDefaultConfig().id,
    type: CHART_TYPES.some((item) => item.id === config?.type) ? config.type : DEFAULT_CHART_CONFIG.type,
    dataSources: validSources.length ? validSources : DEFAULT_CHART_CONFIG.dataSources,
    height: Math.min(600, Math.max(200, Number(config?.height || DEFAULT_CHART_CONFIG.height))),
    showGrid: config?.showGrid !== false,
    showLegend: config?.showLegend !== false,
    showTooltip: config?.showTooltip !== false,
    curved: Boolean(config?.curved),
  };
}

function normalizeConfigs(configs) {
  const list = Array.isArray(configs) && configs.length ? configs : [createDefaultConfig()];
  return list.map(normalizeConfig);
}

function ToggleBox({ checked, label, onChange }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-black shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition ${checked ? 'border-fintrack-green bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}>
      <span>{label}</span>
      <input className="h-5 w-5 accent-fintrack-green" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function ChartConfig({ configs, onChange, onClose, onActionsChange }) {
  const [draft, setDraft] = React.useState(() => normalizeConfigs(configs));

  React.useEffect(() => {
    setDraft(normalizeConfigs(configs));
  }, [configs]);

  function updateConfig(index, field, value) {
    setDraft((prev) => prev.map((config, itemIndex) => (
      itemIndex === index ? normalizeConfig({ ...config, [field]: value }) : config
    )));
  }

  function toggleDataSource(configIndex, sourceId) {
    setDraft((prev) => prev.map((config, itemIndex) => {
      if (itemIndex !== configIndex) return config;
      const currentSources = Array.isArray(config.dataSources) ? config.dataSources : [];
      const nextSources = currentSources.includes(sourceId)
        ? currentSources.filter((id) => id !== sourceId)
        : [...currentSources, sourceId];
      return normalizeConfig({ ...config, dataSources: nextSources.length ? nextSources : [sourceId] });
    }));
  }

  function addConfig() {
    setDraft((prev) => [...prev, createDefaultConfig()]);
  }

  function removeConfig(index) {
    setDraft((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [createDefaultConfig()];
    });
  }

  function handleSave() {
    onChange(normalizeConfigs(draft));
    onClose?.();
  }

  function handleReset() {
    setDraft([createDefaultConfig()]);
  }

  const actions = React.useMemo(() => (
    <div className="tailwind-page flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={handleReset}>Restablecer</button>
      <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50" type="button" onClick={onClose}>Cancelar</button>
      <button className="rounded-2xl border border-fintrack-green bg-fintrack-green px-5 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-fintrack-greenDark" type="button" onClick={handleSave}>Guardar configuracion</button>
    </div>
  ), [draft, onClose]);

  React.useEffect(() => {
    onActionsChange?.(actions);
  }, [actions, onActionsChange]);

  return (
    <div className="tailwind-page space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="block text-lg font-black text-slate-950">Configura tus graficos del dashboard</strong>
          <p className="mt-1 text-sm font-medium text-slate-500">Elige visualizacion, fuentes de datos y opciones visibles.</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-fintrack-green">
          {draft.length} {draft.length === 1 ? 'grafico activo' : 'graficos activos'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {draft.map((config, index) => (
          <section key={config.id || index} className="rounded-3xl border border-slate-300 bg-slate-50 p-5 shadow-[0_16px_38px_rgba(15,23,42,0.10)]">
            <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-lg font-black text-slate-950">Grafico {index + 1}</h4>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {(config.dataSources || []).map((id) => DATA_SOURCES.find((source) => source.id === id)?.label || id).join(' + ')}
                </p>
              </div>
              {draft.length > 1 && (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                  onClick={() => removeConfig(index)}
                  title="Eliminar grafico"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </header>

            <div className="space-y-5">
              <div>
                <h5 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Tipo de grafico</h5>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {CHART_TYPES.map((chartType) => {
                    const Icon = chartType.Icon;
                    const isActive = config.type === chartType.id;
                    return (
                      <button
                        key={chartType.id}
                        type="button"
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition ${isActive ? 'border-fintrack-green bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                        onClick={() => updateConfig(index, 'type', chartType.id)}
                      >
                        <Icon className="shrink-0" size={24} />
                        <div>
                          <b className="block text-sm font-black">{chartType.label}</b>
                          <small className="mt-1 block text-xs font-semibold text-slate-500">{chartType.description}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h5 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Fuentes de datos</h5>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DATA_SOURCES.map((source) => {
                    const isSelected = (config.dataSources || []).includes(source.id);
                    return (
                      <label key={source.id} className={`flex min-h-[82px] cursor-pointer items-center gap-3 rounded-2xl border p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition ${isSelected ? 'border-fintrack-green bg-emerald-50/70 ring-2 ring-emerald-100' : 'border-slate-300 bg-white hover:border-slate-400'}`}>
                        <input
                          className="h-5 w-5 accent-fintrack-green"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDataSource(index, source.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <b className="block text-sm font-black text-slate-950">{source.label}</b>
                          <small className="mt-1 block text-xs font-semibold text-slate-500">{source.description}</small>
                        </div>
                        {isSelected && <Check className="text-fintrack-green" size={17} />}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h5 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Opciones de visualizacion</h5>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Altura (px)</span>
                    <input
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-fintrack-green focus:ring-4 focus:ring-emerald-100"
                      type="number"
                      min="200"
                      max="600"
                      step="50"
                      value={config.height}
                      onChange={(event) => updateConfig(index, 'height', Number(event.target.value))}
                    />
                  </label>
                  <ToggleBox checked={config.showGrid} label="Mostrar cuadricula" onChange={(value) => updateConfig(index, 'showGrid', value)} />
                  <ToggleBox checked={config.showLegend} label="Mostrar leyenda" onChange={(value) => updateConfig(index, 'showLegend', value)} />
                  <ToggleBox checked={config.showTooltip} label="Mostrar tooltip" onChange={(value) => updateConfig(index, 'showTooltip', value)} />
                  {(config.type === 'line' || config.type === 'area') && (
                    <ToggleBox checked={config.curved} label="Linea curva" onChange={(value) => updateConfig(index, 'curved', value)} />
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-black text-slate-700 transition hover:border-fintrack-green hover:text-fintrack-green"
        onClick={addConfig}
      >
        <Plus size={18} />
        Agregar otro grafico
      </button>
    </div>
  );
}
