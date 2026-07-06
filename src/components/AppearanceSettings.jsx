import React from 'react';
import { Check } from 'lucide-react';
import { applyVisualConfig, DEFAULT_COMPANY_CONFIG, getVisualConfig, saveVisualConfig } from '../config/visualConfig';
import { Button, Field, FormActions, SelectField } from './ui';

const PRESETS = [
  { name: 'FinTrack', primary_color: '#1d9e75', accent_color: '#378add', visual_style: 'aurora' },
  { name: 'Océano', primary_color: '#0ea5e9', accent_color: '#14b8a6', visual_style: 'finance' },
  { name: 'Púrpura', primary_color: '#8b5cf6', accent_color: '#22c55e', visual_style: 'neon' },
  { name: 'Ámbar', primary_color: '#f59e0b', accent_color: '#10b981', visual_style: 'minimal' },
];

export function AppearanceSettings({ userId, onStatus }) {
  const [visual, setVisual] = React.useState(() => getVisualConfig(userId));

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
    saveVisualConfig(userId, visual);
    applyVisualConfig(visual);
    window.dispatchEvent(new Event('fintrack_visual_config'));
    onStatus?.('Apariencia guardada correctamente.');
  }

  return (
    <form className="card-body appearance-profile-form" onSubmit={save}>
      <section className="visual-settings-panel">
        <div className="visual-settings-head">
          <div>
            <h4>Apariencia del sistema</h4>
            <p>Personaliza colores, fondo, superficies y densidad solo para tu usuario.</p>
          </div>
          <span>Vista previa activa</span>
        </div>

        <div className="form-row">
          <SelectField label="Tema visual" value={visual.theme || 'light'} onChange={(value) => updateVisual({ theme: value })}>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </SelectField>
          <SelectField label="Estilo visual" value={visual.visual_style || 'aurora'} onChange={(value) => updateVisual({ visual_style: value })}>
            <option value="aurora">Aurora dinámica</option>
            <option value="minimal">Minimal sobrio</option>
            <option value="finance">Financiero premium</option>
            <option value="neon">Neón suave</option>
          </SelectField>
        </div>

        <div className="form-row">
          <SelectField label="Superficies" value={visual.surface_style || 'glass'} onChange={(value) => updateVisual({ surface_style: value })}>
            <option value="glass">Cristal / blur</option>
            <option value="solid">Sólido</option>
            <option value="bordered">Bordes marcados</option>
          </SelectField>
          <SelectField label="Densidad" value={visual.density || 'comfortable'} onChange={(value) => updateVisual({ density: value })}>
            <option value="compact">Compacta</option>
            <option value="comfortable">Cómoda</option>
            <option value="spacious">Espaciada</option>
          </SelectField>
        </div>

        <div className="form-row">
          <Field label="Color principal" type="color" value={visual.primary_color || DEFAULT_COMPANY_CONFIG.primary_color} onChange={(value) => updateVisual({ primary_color: value })} />
          <Field label="Color secundario" type="color" value={visual.accent_color || DEFAULT_COMPANY_CONFIG.accent_color} onChange={(value) => updateVisual({ accent_color: value })} />
        </div>

        <div className="theme-preset-grid">
          {PRESETS.map((preset) => (
            <button key={preset.name} type="button" className="theme-preset-card" onClick={() => updateVisual(preset)}>
              <span className="theme-preset-swatches">
                <i style={{ background: preset.primary_color }} />
                <i style={{ background: preset.accent_color }} />
              </span>
              <strong>{preset.name}</strong>
            </button>
          ))}
        </div>

        <div className="theme-live-preview">
          <div>
            <span className="preview-label">Balance</span>
            <strong>S/ 1,250.00</strong>
            <small>Fondo, cards y acentos aplicados</small>
          </div>
          <div className="preview-bars">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <FormActions>
        <Button variant="primary" type="submit"><Check size={16} />Guardar apariencia</Button>
      </FormActions>
    </form>
  );
}
