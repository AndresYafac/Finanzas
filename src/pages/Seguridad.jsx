import React from 'react';
import { Check, Eye, EyeOff, Fingerprint, LogOut } from 'lucide-react';
import { clearRememberedAccount } from '../controllers/auth.controller';
import { updateMobilePin } from '../controllers/profile.controller';
import { confirmAction } from '../services/feedback';
import { isWebAuthnSupported, registerPasskey } from '../services/webauthn.service';
import { getPasswordStrength, validatePassword } from '../utils/password';
import { Button, Card, Field, FormActions } from '../components/ui';

export function Seguridad({ supabase, user, profile, onSaved }) {
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [pinStatus, setPinStatus] = React.useState('');
  const [passkeyStatus, setPasskeyStatus] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const passwordStrength = getPasswordStrength(password, user.email);

  async function savePin(event) {
    event.preventDefault();
    setPinStatus('');
    if (!/^\d{6}$/.test(pin)) {
      setPinStatus('El PIN debe tener 6 digitos.');
      return;
    }
    if (pin !== confirmPin) {
      setPinStatus('Los PIN no coinciden.');
      return;
    }
    const { error } = await updateMobilePin({ supabase, userId: user.id, pin });
    if (error) {
      setPinStatus(error.message);
      return;
    }
    setPin('');
    setConfirmPin('');
    setPinStatus('PIN movil actualizado correctamente.');
    onSaved?.();
  }

  async function activatePasskey() {
    setPasskeyStatus('');
    if (!isWebAuthnSupported()) {
      setPasskeyStatus('Este navegador no soporta biometria o no estas usando HTTPS.');
      return;
    }
    const { error } = await registerPasskey(supabase);
    if (error) {
      setPasskeyStatus(error.message || 'No se pudo activar la biometria. Verifica que la funcion webauthn este desplegada.');
      return;
    }
    setPasskeyStatus('Biometria activada correctamente en este dispositivo.');
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordStatus('');
    const validation = validatePassword(password, user.email);
    if (validation) {
      setPasswordStatus(validation);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordStatus('Las contrasenas no coinciden.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setPasswordStatus('Contrasena actualizada correctamente.');
  }

  async function signOutEverywhere() {
    const confirmed = await confirmAction('Se cerrara tu sesion en todos los dispositivos. Deseas continuar?');
    if (!confirmed) return;
    clearRememberedAccount();
    await supabase.auth.signOut({ scope: 'global' });
  }

  return (
    <div className="security-page">
      <Card title="Seguridad de la cuenta" className="security-card">
        <div className="card-body security-stack">
          <form className="security-form" onSubmit={savePin}>
            <div className="security-block-head">
              <h4>PIN movil</h4>
              <p className="muted">Crea un PIN de 6 digitos para desbloquear la app cuando uses Recordar cuenta.</p>
            </div>
            <div className="form-row">
              <Field label="Nuevo PIN" type="password" value={pin} maxLength={6} onChange={setPin} />
              <Field label="Confirmar PIN" type="password" value={confirmPin} maxLength={6} onChange={setConfirmPin} />
            </div>
            {pinStatus && <div className={`connection-status ${pinStatus.includes('correctamente') ? 'success' : ''}`}>{pinStatus}</div>}
            <FormActions>
              <Button variant="primary" type="submit"><Check size={16} />Cambiar PIN</Button>
            </FormActions>
          </form>

          <div className="security-form">
            <div className="security-block-head">
              <h4>Biometria / Passkey</h4>
              <p className="muted">Activa huella, Face ID o bloqueo del dispositivo para desbloquear esta cuenta. FinTrack no guarda tu huella.</p>
            </div>
            {passkeyStatus && <div className={`connection-status ${passkeyStatus.includes('correctamente') ? 'success' : ''}`}>{passkeyStatus}</div>}
            <FormActions>
              <Button variant="primary" type="button" onClick={activatePasskey}><Fingerprint size={16} />Activar biometria</Button>
            </FormActions>
          </div>

          <form className="security-form security-password-form" onSubmit={savePassword}>
            <div className="security-block-head">
              <h4>Contrasena</h4>
              <p className="muted">Cambia la contrasena con la que inicias sesion por correo. El cambio aplica a tu cuenta de Supabase Auth.</p>
            </div>
            <Field
              label="Nueva contrasena"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              rightElement={(
                <button type="button" className="input-icon-button" onClick={() => setShowPassword((value) => !value)} aria-label="Ver contrasena">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            />
            <div className={`password-strength password-strength-${passwordStrength.label.toLowerCase()}`}>
              <div className="password-strength-head">
                <span>Seguridad de contrasena</span>
                <strong>{passwordStrength.label}</strong>
              </div>
              <div className="password-strength-track"><i style={{ width: `${passwordStrength.score}%` }} /></div>
              <ul>
                {passwordStrength.checks.map(([key, label, ok]) => <li key={key} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</li>)}
              </ul>
            </div>
            <Field label="Confirmar contrasena" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            {passwordStatus && <div className={`connection-status ${passwordStatus.includes('correctamente') ? 'success' : ''}`}>{passwordStatus}</div>}
            <FormActions>
              <Button variant="primary" type="submit"><Check size={16} />Cambiar contrasena</Button>
              <Button variant="danger" type="button" onClick={signOutEverywhere}><LogOut size={16} />Cerrar sesion en todos</Button>
            </FormActions>
          </form>
        </div>
      </Card>
    </div>
  );
}
