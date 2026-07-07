import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { REMEMBER_EMAIL_KEY, REMEMBER_KEY } from '../../constants/authStorage';
import { friendlyAuthError, sendPasswordReset, signInWithPassword, signUpUser } from '../../controllers/auth.controller';
import { storage } from '../../services/storage.service';
import { getPasswordStrength, validatePassword } from '../../utils/password';
import { hashPin } from '../../utils/security';
import { AuthCard, Field } from '../ui';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

export function Auth({ supabase, message, setMessage }) {
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ nombre: '', apellido: '', email: storage.getRaw(REMEMBER_EMAIL_KEY), password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(storage.getRaw(REMEMBER_KEY) === '1');
  const [loading, setLoading] = React.useState(false);
  const passwordStrength = getPasswordStrength(form.password, form.email);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        if (!form.email.trim()) {
          setMessage('Ingresa tu correo para enviar el enlace de recuperación.');
          return;
        }
        const { error } = await sendPasswordReset({ supabase, email: form.email });
        setMessage(error ? friendlyAuthError(error) : 'Te enviamos un enlace para recuperar tu contraseña. Revisa bandeja de entrada y spam.');
        return;
      }

      if (mode === 'login') {
        const { error } = await signInWithPassword({
          supabase,
          email: form.email,
          password: form.password,
          remember,
        });
        if (error) setMessage(friendlyAuthError(error));
        return;
      }

      const passwordError = validatePassword(form.password, form.email);
      if (passwordError) {
        setMessage(passwordError);
        return;
      }

      const { error } = await signUpUser({
        supabase,
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
      });
      if (error) {
        const rateLimited = error.status === 429 || /rate limit|email rate/i.test(error.message);
        setMessage(rateLimited ? 'Supabase alcanzó el límite temporal de correos. Espera o configura SMTP propio.' : friendlyAuthError(error));
      } else {
        setMessage('Correo de confirmación enviado. Revisa bandeja de entrada y spam.');
      }
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar sesión. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="FinTrack Pro">
      {mode !== 'reset' ? (
        <div className="auth-tabs">
          <button type="button" className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button type="button" className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Registrarse</button>
        </div>
      ) : (
        <div className="auth-reset-title">
          <strong>Recuperar contraseña</strong>
          <span>Te enviaremos un enlace seguro a tu correo.</span>
        </div>
      )}
      <form onSubmit={submit}>
        {mode === 'register' && (
          <div className="form-row">
            <Field label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} maxLength={80} />
            <Field label="Apellido" value={form.apellido} onChange={(value) => setField('apellido', value)} maxLength={80} />
          </div>
        )}
        <Field label="Correo electrónico" type="email" value={form.email} onChange={(value) => setField('email', value)} required maxLength={254} autoComplete="email" />
        {mode !== 'reset' && (
          <Field
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(value) => setField('password', value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            rightElement={<button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
          />
        )}
        {mode === 'register' && (
          <div className={`password-strength password-strength-${passwordStrength.label.toLowerCase()}`}>
            <div className="password-strength-head">
              <span>Seguridad de contraseña</span>
              <strong>{passwordStrength.label}</strong>
            </div>
            <div className="password-strength-track"><i style={{ width: `${passwordStrength.score}%` }} /></div>
            <div className="password-checks">
              {passwordStrength.checks.map(([key, label, ok]) => (
                <span key={key} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</span>
              ))}
            </div>
          </div>
        )}
        {mode === 'login' && (
          <label className="check-row">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Recordar cuenta y usar PIN en este celular</span>
          </label>
        )}
        <button className="btn-full" disabled={loading}>
          {loading ? (mode === 'login' ? 'Ingresando...' : mode === 'reset' ? 'Enviando enlace...' : 'Creando cuenta...') : (mode === 'login' ? 'Entrar al sistema' : mode === 'reset' ? 'Enviar enlace' : 'Crear cuenta de cliente')}
        </button>
        {message && <div className="auth-error">{message}</div>}
        {mode === 'login' && <button type="button" className="link-button" onClick={() => { setMessage(''); setMode('reset'); }}>Olvidé mi contraseña</button>}
        {mode === 'reset' && <button type="button" className="link-button" onClick={() => { setMessage(''); setMode('login'); }}>Volver al inicio de sesión</button>}
      </form>
    </AuthCard>
  );
}

export function PasswordRecovery({ supabase, onComplete }) {
  const [form, setForm] = React.useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const strength = getPasswordStrength(form.password, '');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    const passwordError = validatePassword(form.password, '');
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    if (form.password !== form.confirm) {
      setMessage('Las contrasenas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) {
        setMessage(friendlyAuthError(error));
        return;
      }
      await supabase.auth.signOut();
      onComplete?.('Contrasena actualizada correctamente. Inicia sesion con tu nueva contrasena.');
    } catch (error) {
      setMessage(error.message || 'No se pudo cambiar la contrasena.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Recuperar contrasena">
      <div className="auth-reset-title">
        <strong>Crea tu nueva contrasena</strong>
        <span>Este formulario solo aparece desde el enlace de recuperacion enviado a tu correo.</span>
      </div>
      <form onSubmit={submit}>
        <Field
          label="Nueva contrasena"
          type={showPassword ? 'text' : 'password'}
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          rightElement={<button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contrasena' : 'Ver contrasena'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <Field
          label="Confirmar contrasena"
          type={showPassword ? 'text' : 'password'}
          value={form.confirm}
          onChange={(value) => setForm((current) => ({ ...current, confirm: value }))}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
        <div className={`password-strength password-strength-${strength.label.toLowerCase()}`}>
          <div className="password-strength-head">
            <span>Seguridad de contrasena</span>
            <strong>{strength.label}</strong>
          </div>
          <div className="password-strength-track"><i style={{ width: `${strength.score}%` }} /></div>
          <div className="password-checks">
            {strength.checks.map(([key, label, ok]) => (
              <span key={key} className={ok ? 'ok' : ''}>{ok ? 'OK' : '-'} {label}</span>
            ))}
          </div>
        </div>
        <button className="btn-full" disabled={loading}>{loading ? 'Guardando...' : 'Guardar nueva contrasena'}</button>
        {message && <div className="auth-error">{message}</div>}
      </form>
    </AuthCard>
  );
}

export function PinUnlock({ profile, onUnlock, onFullLogout }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);
  const [lockedUntil, setLockedUntil] = React.useState(() => Number(storage.getRaw('fintrack_pin_locked_until', '0') || 0));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`PIN bloqueado temporalmente. Intenta nuevamente en ${Math.ceil((lockedUntil - Date.now()) / 60000)} min.`);
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Ingresa tu PIN de 6 dígitos.');
      return;
    }
    const nextHash = await hashPin(pin, profile.pin_salt);
    if (nextHash !== profile.pin_hash) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const until = Date.now() + 5 * 60 * 1000;
        storage.setRaw('fintrack_pin_locked_until', String(until));
        setLockedUntil(until);
        setAttempts(0);
        setError('Demasiados intentos fallidos. PIN bloqueado por 5 minutos.');
      } else {
        setError(`PIN incorrecto. Intentos restantes: ${5 - nextAttempts}.`);
      }
      setPin('');
      return;
    }
    storage.remove('fintrack_pin_locked_until');
    onUnlock();
  }

  return (
    <AuthCard title="Desbloquear FinTrack">
      <form onSubmit={submit}>
        <div className="pin-user">
          <div className="user-avatar">{initials(profile, profile?.email_contacto)}</div>
          <div>
            <strong>{fullName(profile) || 'Cuenta recordada'}</strong>
            <span>Ingresa tu PIN para continuar</span>
          </div>
        </div>
        <Field
          label="PIN de 6 dígitos"
          type="password"
          value={pin}
          onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
          required
          minLength={6}
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="------"
        />
        <button className="btn-full">Entrar con PIN</button>
        {error && <div className="auth-error">{error}</div>}
        <button type="button" className="link-button" onClick={onFullLogout}>Cerrar sesión completa</button>
      </form>
    </AuthCard>
  );
}
