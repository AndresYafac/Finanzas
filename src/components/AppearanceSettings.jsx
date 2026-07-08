import React from 'react';
import { Check, Coins, LayoutPanelLeft, Layers, Moon, Palette, SlidersHorizontal, Sparkles, Sun, Type } from 'lucide-react';
import { applyVisualConfig, DEFAULT_COMPANY_CONFIG, getVisualConfig, saveVisualConfig } from '../config/visualConfig';
import { getCurrencyConfig, saveCurrencyConfig } from '../services/currency.service';
import { Button, FormActions } from './ui';

const PRESETS = [
  { name: 'FinTrack', description: 'Verde financiero con azul profesional.', primary_color: '#1d9e75', accent_color: '#378add', visual_style: 'aurora' },
  { name: 'Oceano', description: 'Azules limpios para un panel moderno.', primary_color: '#0ea5e9', accent_color: '#14b8a6', visual_style: 'finance' },
  { name: 'Purpura', description: 'Contraste elegante con acento verde.', primary_color: '#8b5cf6', accent_color: '#22c55e', visual_style: 'neon' },
  { name: 'Ambar', description: 'Tono calido con acentos financieros.', primary_color: '#f59e0b', accent_color: '#10b981', visual_style: 'minimal' },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', description: 'Fondo limpio para trabajar de dia.', icon: Sun },
  { value: 'dark', label: 'Oscuro', description: 'Menos brillo y mas contraste.', icon: Moon },
];

const STYLE_OPTIONS = [
  { value: 'aurora', label: 'Aurora', description: 'Fondos con degradados suaves.' },
  { value: 'minimal', label: 'Minimal', description: 'Superficies sobrias y directas.' },
  { value: 'finance', label: 'Financiero', description: 'Panel con profundidad ejecutiva.' },
  { value: 'neon', label: 'Neon suave', description: 'Acentos mas vivos y modernos.' },
];

const SURFACE_OPTIONS = [
  { value: 'glass', label: 'Cristal', description: 'Blur y transparencias ligeras.' },
  { value: 'solid', label: 'Solido', description: 'Cards planas y mas legibles.' },
  { value: 'bordered', label: 'Bordes', description: 'Separacion visual marcada.' },
];

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compacta', description: 'Mas informacion en pantalla.' },
  { value: 'comfortable', label: 'Comoda', description: 'Equilibrio entre aire y datos.' },
  { value: 'spacious', label: 'Espaciada', description: 'Mas aire para uso tactil.' },
];

const FONT_OPTIONS = [
  { value: 'system', label: 'Sistema', description: 'Fuente nativa del dispositivo.' },
  { value: 'inter', label: 'Inter', description: 'Lectura moderna y limpia.' },
  { value: 'serif', label: 'Serif', description: 'Estilo mas editorial.' },
];

const LAYOUT_OPTIONS = [
  { value: 'left', label: 'Menu izquierda', description: 'Navegacion clasica.' },
  { value: 'right', label: 'Menu derecha', description: 'Mayor alcance para usuarios diestros.' },
];

function isPresetActive(visual, preset) {
  return visual.primary_color === preset.primary_color && visual.accent_color === preset.accent_color && visual.visual_style === preset.visual_style;
}

function ChoiceCard({ option, active, onClick, icon: FallbackIcon }) {
  const Icon = option.icon || FallbackIcon;
  return (
    <button type="button" className={`appearance-choice ${active ? 'active' : ''}`} onClick={onClick}>
      {Icon && <span className="appearance-choice-icon"><Icon size={18} /></span>}
      <span>
        <strong>{option.label}</strong>
        <small>{option.description}</small>
      </span>
      <i className="appearance-choice-check">{active ? <Check size={14} /> : null}</i>
    </button>
  );
}

function ColorControl({ label, value, onChange }) {
  return (
    <label className="appearance-color-control">
      <span className="appearance-color-preview" style={{ background: value }} />
      <span className="appearance-color-copy">
        <b>{label}</b>
        <strong>{value}</strong>
      </span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </label>
  );
}

export function AppearanceSettings({ userId, onStatus }) {
  const [visual, setVisual] = React.useState(() => getVisualConfig(userId));
  const [currency, setCurrency] = React.useState(getCurrencyConfig);

  React.useEffect(() => {
    setVisual(getVisualConfig(userId));
  }, [userId]);

  function updateVisual(patch) {
    const next = { ...visual, ...patch };
    setVisual(next);
    applyVisualConfig(next);
  }

  function save(event) {
    event.preventDefault();
    const next = {
      theme: visual.theme || DEFAULT_COMPANY_CONFIG.theme,
      visual_style: visual.visual_style || DEFAULT_COMPANY_CONFIG.visual_style,
      surface_style: visual.surface_style || DEFAULT_COMPANY_CONFIG.surface_style,
      density: visual.density || DEFAULT_COMPANY_CONFIG.density,
      primary_color: visual.primary_color || DEFAULT_COMPANY_CONFIG.primary_color,
      accent_color: visual.accent_color || DEFAULT_COMPANY_CONFIG.accent_color,
      font_family: visual.font_family || DEFAULT_COMPANY_CONFIG.font_family,
      layout_side: visual.layout_side || DEFAULT_COMPANY_CONFIG.layout_side,
    };
    saveVisualConfig(userId, next);
    saveCurrencyConfig(currency);
    applyVisualConfig(next);
    setVisual(next);
    window.dispatchEvent(new Event('fintrack_visual_config'));
    onStatus?.('Apariencia y moneda guardadas correctamente.');
  }

  const primary = visual.primary_color || DEFAULT_COMPANY_CONFIG.primary_color;
  const accent = visual.accent_color || DEFAULT_COMPANY_CONFIG.accent_color;

  return (
    <form className="card-body appearance-profile-form" onSubmit={save}>
      <section className="visual-settings-panel appearance-builder">
        <div className="visual-settings-head appearance-builder-head">
          <div>
            <h4>Apariencia del sistema</h4>
            <p>Elige un estilo visual completo o ajusta colores, tema, superficies y densidad para tu usuario.</p>
          </div>
          <span>Vista previa activa</span>
        </div>

        <div className="appearance-layout">
          <div className="appearance-main-column">
            <div className="appearance-section">
              <div className="appearance-section-title"><Palette size={16} /> Paletas rapidas</div>
              <div className="appearance-preset-grid">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`appearance-preset ${isPresetActive(visual, preset) ? 'active' : ''}`}
                    onClick={() => updateVisual(preset)}
                  >
                    <span className="theme-preset-swatches">
                      <i style={{ background: preset.primary_color }} />
                      <i style={{ background: preset.accent_color }} />
                    </span>
                    <strong>{preset.name}</strong>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-color-grid">
              <ColorControl label="Color principal" value={primary} onChange={(value) => updateVisual({ primary_color: value })} />
              <ColorControl label="Color secundario" value={accent} onChange={(value) => updateVisual({ accent_color: value })} />
            </div>

            <div className="appearance-section appearance-option-group currency-settings">
              <div className="appearance-section-title"><Coins size={16} /> Multi-moneda</div>
              <div className="currency-grid">
                <label>
                  <span>Moneda base</span>
                  <select value={currency.base} onChange={(event) => setCurrency((current) => ({ ...current, base: event.target.value }))}>
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dolares (USD)</option>
                    <option value="EUR">Euros (EUR)</option>
                  </select>
                </label>
                {['PEN', 'USD', 'EUR'].map((code) => (
                  <label key={code}>
                    <span>Tasa {code}</span>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={currency.rates?.[code] || ''}
                      onChange={(event) => setCurrency((current) => ({ ...current, rates: { ...current.rates, [code]: Number(event.target.value || 0) } }))}
                    />
                  </label>
                ))}
              </div>
              <small className="muted">La tasa representa cuantas unidades de moneda base equivale 1 unidad de cada moneda. Puedes actualizarla manualmente.</small>
            </div>

            <div className="theme-live-preview appearance-preview">
              <div>
                <span className="preview-label">Vista previa</span>
                <strong>FinTrack Pro</strong>
                <small>Menu, botones, cards y acentos aplicados.</small>
              </div>
              <div className="preview-bars">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="appearance-options-column">
            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><Sun size={16} /> Tema</div>
              <div className="appearance-choice-grid compact">
                {THEME_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} active={(visual.theme || 'light') === option.value} onClick={() => updateVisual({ theme: option.value })} />
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><Sparkles size={16} /> Estilo</div>
              <div className="appearance-choice-grid">
                {STYLE_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} icon={Sparkles} active={(visual.visual_style || 'aurora') === option.value} onClick={() => updateVisual({ visual_style: option.value })} />
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><Layers size={16} /> Superficies</div>
              <div className="appearance-choice-grid">
                {SURFACE_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} icon={Layers} active={(visual.surface_style || 'glass') === option.value} onClick={() => updateVisual({ surface_style: option.value })} />
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><SlidersHorizontal size={16} /> Densidad</div>
              <div className="appearance-choice-grid">
                {DENSITY_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} icon={SlidersHorizontal} active={(visual.density || 'comfortable') === option.value} onClick={() => updateVisual({ density: option.value })} />
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><Type size={16} /> Fuente</div>
              <div className="appearance-choice-grid">
                {FONT_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} icon={Type} active={(visual.font_family || 'system') === option.value} onClick={() => updateVisual({ font_family: option.value })} />
                ))}
              </div>
            </div>

            <div className="appearance-section appearance-option-group">
              <div className="appearance-section-title"><LayoutPanelLeft size={16} /> Layout</div>
              <div className="appearance-choice-grid compact">
                {LAYOUT_OPTIONS.map((option) => (
                  <ChoiceCard key={option.value} option={option} icon={LayoutPanelLeft} active={(visual.layout_side || 'left') === option.value} onClick={() => updateVisual({ layout_side: option.value })} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <FormActions>
        <Button variant="primary" type="submit"><Check size={16} />Guardar apariencia</Button>
      </FormActions>
    </form>
  );
}
