import React from 'react';
import { Check, Eye, EyeOff, LogOut } from 'lucide-react';
import { clearRememberedAccount } from '../controllers/auth.controller';
import { updateMobilePin, updateProfile } from '../controllers/profile.controller';
import { confirmAction } from '../services/feedback';
import { getPasswordStrength, validatePassword } from '../utils/password';
import { Button, Card, Field, FormActions, SelectField } from '../components/ui';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

export function Perfil({ supabase, user, profile, onSaved }) {
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN' });
  const [pinForm, setPinForm] = React.useState({ pin: '', confirm: '' });
  const [passwordForm, setPasswordForm] = React.useState({ password: '', confirm: '' });
  const [status, setStatus] = React.useState('');
  const [pinStatus, setPinStatus] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showProfilePassword, setShowProfilePassword] = React.useState(false);
  const profilePasswordStrength = getPasswordStrength(passwordForm.password, user.email);

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
    onSaved();
  }

  async function savePin(event) {
    event.preventDefault();
    setPinStatus('');
    if (!/^\d{6}$/.test(pinForm.pin)) {
      setPinStatus('El PIN debe tener exactamente 6 dígitos.');
      return;
    }
    if (pinForm.pin !== pinForm.confirm) {
      setPinStatus('La confirmación del PIN no coincide.');
      return;
    }
    const { error } = await updateMobilePin({ supabase, userId: user.id, pin: pinForm.pin });
    if (error) {
      setPinStatus(error.message);
      return;
    }
    setPinForm({ pin: '', confirm: '' });
    setPinStatus('PIN actualizado correctamente.');
    onSaved();
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordStatus('');
    const passwordError = validatePassword(passwordForm.password, user.email);
    if (passwordError) {
      setPasswordStatus(passwordError);
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordStatus('La confirmación de contraseña no coincide.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }
    setPasswordForm({ password: '', confirm: '' });
    setPasswordStatus('Contraseña actualizada correctamente.');
  }

  async function signOutEverywhere() {
    if (!(await confirmAction('Cerrar sesión en todos tus dispositivos? Tendrás que volver a iniciar sesión.'))) return;
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }
    clearRememberedAccount();
    window.location.reload();
  }

  const setPinField = (field, value) => setPinForm((current) => ({ ...current, [field]: value.replace(/\D/g, '').slice(0, 6) }));

  return (
    <div className="profile-section">
      <Card title="Información personal" className="profile-main-card">
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
          <Field label="Teléfono" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value })} />
          <Field label="Dirección" value={form.direccion} onChange={(value) => setForm({ ...form, direccion: value })} />
          <Field label="Empresa / Negocio" value={form.empresa} onChange={(value) => setForm({ ...form, empresa: value })} />
          <SelectField label="Moneda predeterminada" value={form.moneda} onChange={(value) => setForm({ ...form, moneda: value })}>
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dólares ($)</option>
            <option value="EUR">Euros (EUR)</option>
          </SelectField>
          {status && <div className={`connection-status ${status.includes('correctamente') ? 'success' : ''}`}>{status}</div>}
          <FormActions><Button variant="primary" type="submit"><Check size={16} />Guardar cambios</Button></FormActions>
        </form>
      </Card>

      <div className="profile-side">
        <Card title="Seguridad" className="security-card">
          <div className="card-body security-stack">
            <form className="security-form" onSubmit={savePin}>
              <div className="security-block-head">
                <h4>PIN móvil</h4>
                <p className="muted">Crea un PIN de 6 dígitos para desbloquear la app en este celular cuando uses Recordar cuenta.</p>
              </div>
              <div className="form-row">
                <Field label="Nuevo PIN" type="password" value={pinForm.pin} onChange={(value) => setPinField('pin', value)} inputMode="numeric" pattern="\d{6}" placeholder="------" required minLength={6} />
                <Field label="Confirmar PIN" type="password" value={pinForm.confirm} onChange={(value) => setPinField('confirm', value)} inputMode="numeric" pattern="\d{6}" placeholder="------" required minLength={6} />
              </div>
              {pinStatus && <div className={`connection-status ${pinStatus.includes('correctamente') ? 'success' : ''}`}>{pinStatus}</div>}
              <FormActions><Button variant="primary" type="submit"><Check size={16} />{profile?.pin_hash ? 'Cambiar PIN' : 'Crear PIN'}</Button></FormActions>
            </form>

            <div className="security-divider" />

            <form className="security-form" onSubmit={savePassword}>
              <div className="security-block-head">
                <h4>Contraseña</h4>
                <p className="muted">Cambia la contraseña con la que inicias sesión por correo. El cambio aplica a tu cuenta de Supabase Auth.</p>
              </div>
              <Field
                label="Nueva contraseña"
                type={showProfilePassword ? 'text' : 'password'}
                value={passwordForm.password}
                onChange={(value) => setPasswordForm({ ...passwordForm, password: value })}
                required
                minLength={8}
                rightElement={<button className="input-action" type="button" onClick={() => setShowProfilePassword((value) => !value)}>{showProfilePassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
              />
              <div className={`password-strength password-strength-${profilePasswordStrength.label.toLowerCase()}`}>
                <div className="password-strength-head">
                  <span>Seguridad de contraseña</span>
                  <strong>{profilePasswordStrength.label}</strong>
                </div>
                <div className="password-strength-track"><i style={{ width: `${profilePasswordStrength.score}%` }} /></div>
                <div className="password-checks">
                  {profilePasswordStrength.checks.map(([key, label, ok]) => (
                    <span key={key} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</span>
                  ))}
                </div>
              </div>
              <Field label="Confirmar contraseña" type={showProfilePassword ? 'text' : 'password'} value={passwordForm.confirm} onChange={(value) => setPasswordForm({ ...passwordForm, confirm: value })} required minLength={8} />
              {passwordStatus && <div className={`connection-status ${passwordStatus.includes('correctamente') ? 'success' : ''}`}>{passwordStatus}</div>}
              <FormActions>
                <Button variant="primary" type="submit"><Check size={16} />Cambiar contraseña</Button>
                <Button variant="danger" onClick={signOutEverywhere}><LogOut size={16} />Cerrar sesión en todos</Button>
              </FormActions>
            </form>
          </div>
        </Card>

      </div>
    </div>
  );
}
