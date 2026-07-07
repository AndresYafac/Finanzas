import React from 'react';
import { AreaChart, BarChart3, Check, LineChart, PieChart, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui';

const CHART_TYPES = [
  { id: 'bar', label: 'Barras', Icon: BarChart3, description: 'Comparativa entre categorias' },
  { id: 'line', label: 'Lineas', Icon: LineChart, description: 'Tendencias temporales' },
  { id: 'area', label: 'Area', Icon: AreaChart, description: 'Volumen acumulado' },
  { id: 'pie', label: 'Circular', Icon: PieChart, description: 'Distribucion porcentual' },
];

const DATA_SOURCES = [
  { id: 'accounts', label: 'Balance de cuentas', description: 'Saldo por cuenta bancaria' },
  { id: 'debts', label: 'Cuentas por cobrar', description: 'Deudas pendientes y cobradas' },
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
    <div className="chart-config-actions">
      <Button onClick={handleReset}>Restablecer</Button>
      <Button onClick={onClose}>Cancelar</Button>
      <Button variant="primary" onClick={handleSave}>Guardar configuracion</Button>
    </div>
  ), [draft, onClose]);

  React.useEffect(() => {
    onActionsChange?.(actions);
  }, [actions, onActionsChange]);

  return (
    <div className="chart-config-panel">
      <div className="chart-config-hero">
        <div>
          <strong>Configura tus graficos del dashboard</strong>
          <p>Elige el tipo de visualizacion, las fuentes de datos y las opciones visibles.</p>
        </div>
        <span>{draft.length} {draft.length === 1 ? 'grafico' : 'graficos'} activos</span>
      </div>

      {draft.map((config, index) => (
        <div key={config.id || index} className="chart-config-item">
          <div className="chart-config-item-header">
            <div>
              <h4>Grafico {index + 1}</h4>
              <p>{(config.dataSources || []).map((id) => DATA_SOURCES.find((source) => source.id === id)?.label || id).join(' + ')}</p>
            </div>
            {draft.length > 1 && (
              <button
                type="button"
                className="chart-config-remove"
                onClick={() => removeConfig(index)}
                title="Eliminar grafico"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="chart-config-section">
            <h4>Tipo de grafico</h4>
            <div className="chart-type-grid">
              {CHART_TYPES.map((chartType) => {
                const Icon = chartType.Icon;
                const isActive = config.type === chartType.id;
                return (
                  <button
                    key={chartType.id}
                    type="button"
                    className={`chart-type-card ${isActive ? 'active' : ''}`}
                    onClick={() => updateConfig(index, 'type', chartType.id)}
                  >
                    <Icon size={24} />
                    <div>
                      <b>{chartType.label}</b>
                      <small>{chartType.description}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chart-config-section">
            <h4>Fuentes de datos</h4>
            <div className="data-source-list">
              {DATA_SOURCES.map((source) => {
                const isSelected = (config.dataSources || []).includes(source.id);
                return (
                  <label key={source.id} className={`data-source-option ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDataSource(index, source.id)}
                    />
                    <div>
                      <b>{source.label}</b>
                      <small>{source.description}</small>
                    </div>
                    {isSelected && <Check size={16} />}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="chart-config-section">
            <h4>Opciones de visualizacion</h4>
            <div className="chart-options-grid">
              <div className="form-group">
                <label>Altura (px)</label>
                <input
                  type="number"
                  min="200"
                  max="600"
                  step="50"
                  value={config.height}
                  onChange={(event) => updateConfig(index, 'height', Number(event.target.value))}
                />
              </div>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={config.showGrid}
                  onChange={(event) => updateConfig(index, 'showGrid', event.target.checked)}
                />
                <span>Mostrar cuadricula</span>
              </label>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={config.showLegend}
                  onChange={(event) => updateConfig(index, 'showLegend', event.target.checked)}
                />
                <span>Mostrar leyenda</span>
              </label>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={config.showTooltip}
                  onChange={(event) => updateConfig(index, 'showTooltip', event.target.checked)}
                />
                <span>Mostrar tooltip</span>
              </label>
              {(config.type === 'line' || config.type === 'area') && (
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={config.curved}
                    onChange={(event) => updateConfig(index, 'curved', event.target.checked)}
                  />
                  <span>Linea curva</span>
                </label>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="chart-config-add">
        <button type="button" onClick={addConfig}>
          <Plus size={18} />
          Agregar otro grafico
        </button>
      </div>

    </div>
  );
}
