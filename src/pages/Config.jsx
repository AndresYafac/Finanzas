import React from 'react';
import { Check } from 'lucide-react';
import { createStoredClient, createSupabaseClient } from '../config/supabase';
import { applyVisualConfig, COMPANY_CONFIG_KEY, DEFAULT_COMPANY_CONFIG, getCompanyConfig } from '../config/visualConfig';
import { Button, Card, Field, FormActions, SelectField } from '../components/ui';
import { getEmpresaConfig, getEmpresaLogoUrl, saveEmpresaConfig, testSupabaseConnection, uploadEmpresaLogo } from '../services/config.service';

export function Config({ onReady, compact = false }) {
  const [url, setUrl] = React.useState(localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [key, setKey] = React.useState(localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [company, setCompany] = React.useState(getCompanyConfig);
  const logoInputRef = React.useRef(null);
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  function updateCompany(patch, preview = false) {
    const next = { ...company, ...patch };
    setCompany(next);
    if (preview) {
      localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(next));
      applyVisualConfig(next);
      window.dispatchEvent(new Event('fintrack_visual_config'));
    }
  }

  React.useEffect(() => {
    if (compact) return;
    const client = createStoredClient();
    if (!client) return;
    getEmpresaConfig(client).then(({ data }) => {
      if (data) {
        const local = getCompanyConfig();
        const next = {
          nombre: data.nombre ?? local.nombre ?? DEFAULT_COMPANY_CONFIG.nombre,
          documento: data.documento ?? local.documento ?? '',
          direccion: data.direccion ?? local.direccion ?? '',
          telefono: data.telefono ?? local.telefono ?? '',
          logo_url: data.logo_url ?? local.logo_url ?? '',
          primary_color: local.primary_color ?? data.primary_color ?? DEFAULT_COMPANY_CONFIG.primary_color,
          accent_color: local.accent_color ?? data.accent_color ?? DEFAULT_COMPANY_CONFIG.accent_color,
          theme: local.theme ?? data.theme ?? DEFAULT_COMPANY_CONFIG.theme,
          visual_style: local.visual_style ?? data.visual_style ?? DEFAULT_COMPANY_CONFIG.visual_style,
          surface_style: local.surface_style ?? data.surface_style ?? DEFAULT_COMPANY_CONFIG.surface_style,
          density: local.density ?? data.density ?? DEFAULT_COMPANY_CONFIG.density,
        };
        setCompany(next);
        localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(next));
        applyVisualConfig(next);
      }
    });
  }, [compact]);

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
      setStatus('La URL debe tener formato https://proyecto.supabase.co');
      setLoading(false);
      return;
    }
    const client = createSupabaseClient(cleanUrl, key.trim());
    const { error } = await testSupabaseConnection(client);
    if (error && !/profiles|schema cache|relation/i.test(error.message) && error.code !== '42501') {
      setStatus(error.message);
      setLoading(false);
      return;
    }
    localStorage.setItem('sb_url', cleanUrl);
    localStorage.setItem('sb_key', key.trim());
    setStatus('Conexión guardada correctamente.');
    onReady(client);
    setLoading(false);
  }

  async function saveCompany(event) {
    event.preventDefault();
    localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(company));
    applyVisualConfig(company);
    window.dispatchEvent(new Event('fintrack_visual_config'));
    const client = createStoredClient();
    if (client) {
      const { data: sessionData } = await client.auth.getSession();
      const adminId = sessionData.session?.user?.id;
      if (adminId) {
        await saveEmpresaConfig(client, adminId, company);
      }
    }
    setStatus('Datos de empresa guardados correctamente.');
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const client = createStoredClient();
    if (!client) {
      setStatus('Configura Supabase antes de subir el logo.');
      return;
    }
    const { data: sessionData } = await client.auth.getSession();
    const adminId = sessionData.session?.user?.id;
    if (!adminId) return setStatus('Inicia sesión para subir el logo.');
    const ext = file.name.split('.').pop() || 'png';
    const path = `${adminId}/logo-${Date.now()}.${ext}`;
    const { error } = await uploadEmpresaLogo(client, path, file);
    if (error) {
      setStatus(error.message);
      return;
    }
    const { data } = getEmpresaLogoUrl(client, path);
    setCompany((current) => ({ ...current, logo_url: data.publicUrl }));
    setStatus('Logo subido. Guarda los datos de empresa para conservarlo.');
  }

  const content = (
    <div className={compact ? '' : 'card-body'}>
      <div className="alert alert-warning">Usa únicamente la clave Publishable o anon. Nunca uses service_role.</div>
      <form onSubmit={save}>
        <Field label="Supabase URL" value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" />
        <Field label="Publishable / Anon Key" type="password" value={key} onChange={setKey} />
        <FormActions><Button variant="primary" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar conexión'}</Button></FormActions>
        {status && <div className="connection-status success">{status}</div>}
      </form>
      {!compact && (
        <form className="config-company-form" onSubmit={saveCompany}>
          <h4>Datos de empresa para reportes</h4>
          <Field label="Nombre comercial" value={company.nombre} onChange={(value) => updateCompany({ nombre: value })} />
          <Field label="RUC / Documento" value={company.documento} onChange={(value) => updateCompany({ documento: value })} />
          <Field label="Dirección" value={company.direccion} onChange={(value) => updateCompany({ direccion: value })} />
          <Field label="Teléfono" value={company.telefono} onChange={(value) => updateCompany({ telefono: value })} />
          <Field label="URL del logo" value={company.logo_url} onChange={(value) => updateCompany({ logo_url: value })} placeholder="https://..." />

          <section className="visual-settings-panel">
            <div className="visual-settings-head">
              <div>
                <h4>Apariencia del sistema</h4>
                <p>Personaliza colores, fondo, superficies y densidad. Se previsualiza al seleccionar.</p>
              </div>
              <span>Vista previa activa</span>
            </div>

            <div className="form-row">
              <SelectField label="Tema visual" value={company.theme || 'light'} onChange={(value) => updateCompany({ theme: value }, true)}>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </SelectField>
              <SelectField label="Estilo visual" value={company.visual_style || 'aurora'} onChange={(value) => updateCompany({ visual_style: value }, true)}>
                <option value="aurora">Aurora dinámica</option>
                <option value="minimal">Minimal sobrio</option>
                <option value="finance">Financiero premium</option>
                <option value="neon">Neón suave</option>
              </SelectField>
            </div>

            <div className="form-row">
              <SelectField label="Superficies" value={company.surface_style || 'glass'} onChange={(value) => updateCompany({ surface_style: value }, true)}>
                <option value="glass">Cristal / blur</option>
                <option value="solid">Sólido</option>
                <option value="bordered">Bordes marcados</option>
              </SelectField>
              <SelectField label="Densidad" value={company.density || 'comfortable'} onChange={(value) => updateCompany({ density: value }, true)}>
                <option value="compact">Compacta</option>
                <option value="comfortable">Cómoda</option>
                <option value="spacious">Espaciada</option>
              </SelectField>
            </div>

            <div className="form-row">
              <Field label="Color principal" type="color" value={company.primary_color || DEFAULT_COMPANY_CONFIG.primary_color} onChange={(value) => updateCompany({ primary_color: value }, true)} />
              <Field label="Color secundario" type="color" value={company.accent_color || DEFAULT_COMPANY_CONFIG.accent_color} onChange={(value) => updateCompany({ accent_color: value }, true)} />
            </div>

            <div className="theme-preset-grid">
              {[
                { name: 'FinTrack', primary_color: '#1d9e75', accent_color: '#378add', visual_style: 'aurora' },
                { name: 'Océano', primary_color: '#0ea5e9', accent_color: '#14b8a6', visual_style: 'finance' },
                { name: 'Púrpura', primary_color: '#8b5cf6', accent_color: '#22c55e', visual_style: 'neon' },
                { name: 'Ámbar', primary_color: '#f59e0b', accent_color: '#10b981', visual_style: 'minimal' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="theme-preset-card"
                  onClick={() => updateCompany(preset, true)}
                >
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
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={uploadLogo} />
          <FormActions>
            <Button onClick={() => logoInputRef.current?.click()}>Subir logo</Button>
            <Button variant="primary" type="submit"><Check size={16} />Guardar datos de empresa</Button>
          </FormActions>
        </form>
      )}
    </div>
  );

  if (compact) return content;
  return <div className="profile-section"><Card title="Configuración del sistema">{content}</Card></div>;
}


