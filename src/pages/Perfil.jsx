import React from 'react';
import { Check } from 'lucide-react';
import { updateProfile } from '../controllers/profile.controller';
import { Button, Card, Field, FormActions, SelectField } from '../components/ui';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

export function Perfil({ supabase, user, profile, onSaved }) {
  const [form, setForm] = React.useState({
    nombre: '',
    apellido: '',
    tipo_doc: 'DNI',
    documento: '',
    email_contacto: '',
    telefono: '',
    direccion: '',
    empresa: '',
    moneda: 'PEN',
  });
  const [status, setStatus] = React.useState('');

  React.useEffect(() => setForm({
    nombre: profile?.nombre || '',
    apellido: profile?.apellido || '',
    tipo_doc: profile?.tipo_doc || 'DNI',
    documento: profile?.documento || '',
    email_contacto: profile?.email_contacto || user.email || '',
    telefono: profile?.telefono || '',
    direccion: profile?.direccion || '',
    empresa: profile?.empresa || '',
    moneda: profile?.moneda || 'PEN',
  }), [profile, user.email]);

  async function save(event) {
    event.preventDefault();
    setStatus('');
    const { error } = await updateProfile({ supabase, userId: user.id, form });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus('Perfil actualizado correctamente.');
    onSaved?.();
  }

  return (
    <div className="profile-section profile-section-single">
      <Card title="Informacion personal" className="profile-main-card">
        <form className="card-body" onSubmit={save}>
          <div className="avatar-upload">
            <div className="avatar-big">{initials(profile, user.email)}</div>
            <div>
              <div className="profile-name">{fullName(profile) || user.email}</div>
              <div className="muted">{user.email}</div>
              <div className="role-text">{profile?.role === 'admin' ? 'Administrador' : 'Usuario'}</div>
            </div>
          </div>
          <div className="form-row">
            <Field label="Nombre" value={form.nombre} onChange={(value) => setForm({ ...form, nombre: value })} />
            <Field label="Apellido" value={form.apellido} onChange={(value) => setForm({ ...form, apellido: value })} />
          </div>
          <div className="form-row">
            <SelectField label="Tipo de documento" value={form.tipo_doc} onChange={(value) => setForm({ ...form, tipo_doc: value })}>
              <option>DNI</option>
              <option>RUC</option>
              <option>CE</option>
              <option>Pasaporte</option>
            </SelectField>
            <Field label="Documento" value={form.documento} onChange={(value) => setForm({ ...form, documento: value })} />
          </div>
          <Field label="Email de contacto" type="email" value={form.email_contacto} onChange={(value) => setForm({ ...form, email_contacto: value })} />
          <Field label="Telefono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} />
          <Field label="Direccion" value={form.direccion} onChange={(value) => setForm({ ...form, direccion: value })} />
          <Field label="Empresa / Negocio" value={form.empresa} onChange={(value) => setForm({ ...form, empresa: value })} />
          <SelectField label="Moneda predeterminada" value={form.moneda} onChange={(value) => setForm({ ...form, moneda: value })}>
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dolares ($)</option>
            <option value="EUR">Euros (EUR)</option>
          </SelectField>
          {status && <div className={`connection-status ${status.includes('correctamente') ? 'success' : ''}`}>{status}</div>}
          <FormActions><Button variant="primary" type="submit"><Check size={16} />Guardar cambios</Button></FormActions>
        </form>
      </Card>
    </div>
  );
}
