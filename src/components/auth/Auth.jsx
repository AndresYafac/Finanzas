import React from 'react';
import { Eye, EyeOff, Fingerprint, LineChart } from 'lucide-react';
import { REMEMBER_EMAIL_KEY, REMEMBER_KEY } from '../../constants/authStorage';
import { getCompanyConfig } from '../../config/visualConfig';
import { friendlyAuthError, sendPasswordReset, signInWithPassword, signUpUser } from '../../controllers/auth.controller';
import { getBiometricAvailability, isBiometricEnabled, verifyNativeBiometric } from '../../services/nativeBiometric.service';
import { isNativeApp } from '../../services/platform.service';
import { storage } from '../../services/storage.service';
import { getPasswordStrength, validatePassword } from '../../utils/password';
import { hashPin } from '../../utils/security';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

function AuthShell({ title, subtitle = 'Sistema de gestión financiera', children }) {
  const [companyConfig, setCompanyConfig] = React.useState(getCompanyConfig);

  React.useEffect(() => {
    const syncCompanyConfig = () => setCompanyConfig(getCompanyConfig());
    window.addEventListener('fintrack_company_config', syncCompanyConfig);
    return () => window.removeEventListener('fintrack_company_config', syncCompanyConfig);
  }, []);

  return (
    <section className="tailwind-page flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_68%_30%,rgba(19,105,101,0.46)_0%,rgba(19,105,101,0.16)_24%,transparent_46%),linear-gradient(135deg,#081321_0%,#14283a_100%)] px-4 py-6 text-slate-900">
      <div className="w-full max-w-[430px] rounded-[28px] border border-white/45 bg-[#ffffffdb] p-9 shadow-[0_28px_70px_rgba(0,0,0,0.36)] max-[480px]:max-w-[calc(100vw-32px)] max-[480px]:p-7">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-100 bg-white p-1.5 text-emerald-700 shadow-[0_14px_34px_rgba(29,158,117,0.24)] ring-4 ring-white/65">
              {companyConfig.logo_url ? (
                <img className="h-full w-full rounded-[17px] object-cover" src={companyConfig.logo_url} alt="Logo de FinTrack" />
              ) : (
                <LineChart size={30} strokeWidth={2.7} />
              )}
          </div>
          <h1 className="text-[25px] font-black leading-tight tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] font-medium text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function TwField({ label, type = 'text', value, onChange, rightElement, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <span className="relative block">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-900 shadow-sm outline-none transition duration-200 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${rightElement ? 'pr-12' : ''}`}
          {...props}
        />
        {rightElement && <span className="absolute inset-y-0 right-3 flex items-center">{rightElement}</span>}
      </span>
    </label>
  );
}

function EyeButton({ show, onClick, label }) {
  return (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-slate-50 text-slate-500 shadow-sm outline-none transition hover:bg-white hover:text-slate-900 focus-visible:ring-4 focus-visible:ring-emerald-500/15"
      type="button"
      onClick={onClick}
      aria-label={label}
    >
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-0 bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(29,158,117,0.22)] outline-none transition hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function LinkButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`mx-auto block border-0 bg-transparent p-0 text-sm font-black text-slate-500 underline-offset-4 outline-none transition hover:text-emerald-700 hover:underline focus-visible:text-emerald-700 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function AuthMessage({ children }) {
  if (!children) return null;
  return <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-500">{children}</div>;
}

function PasswordStrength({ strength }) {
  const empty = strength.empty || strength.score === 0;
  const color = strength.score >= 85 ? 'bg-emerald-500' : strength.score >= 55 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black">
        <span className="uppercase tracking-[0.08em] text-slate-500">Seguridad de contraseña</span>
        <strong className={empty ? 'text-slate-400' : strength.score >= 85 ? 'text-emerald-600' : strength.score >= 55 ? 'text-amber-600' : 'text-red-500'}>{empty ? 'Sin evaluar' : strength.label}</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <i className={`block h-full rounded-full ${empty ? 'bg-transparent' : color}`} style={{ width: `${empty ? 0 : strength.score}%` }} />
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs font-bold leading-relaxed text-slate-500">
        {strength.checks.map(([key, label, ok]) => (
          <span key={key} className={ok && !empty ? 'text-emerald-700' : ''}>{ok && !empty ? '✓' : '•'} {label}</span>
        ))}
      </div>
    </div>
  );
}

export function Auth({ supabase, message, setMessage }) {
  const nativeApp = isNativeApp();
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ nombre: '', apellido: '', email: storage.getRaw(REMEMBER_EMAIL_KEY), password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(nativeApp || storage.getRaw(REMEMBER_KEY) === '1');
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
          remember: nativeApp || remember,
        });
        if (error) {
          if (error.clearRemembered) {
            setRemember(false);
            setForm((current) => ({ ...current, email: '' }));
          }
          setMessage(friendlyAuthError(error));
        }
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
    <AuthShell title="FinTrack Pro">
      {mode !== 'reset' ? (
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-[20px] bg-slate-200/75 p-2 shadow-inner">
          <button
            type="button"
            className={`h-10 rounded-[15px] border-0 text-[12.5px] outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-500/15 ${mode === 'login' ? 'bg-white font-extrabold text-slate-950 shadow-sm' : 'bg-transparent font-extrabold text-slate-500 hover:text-slate-900'}`}
            onClick={() => setMode('login')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`h-10 rounded-[15px] border-0 text-[12.5px] outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-500/15 ${mode === 'register' ? 'bg-white font-extrabold text-slate-950 shadow-sm' : 'bg-transparent font-extrabold text-slate-500 hover:text-slate-900'}`}
            onClick={() => setMode('register')}
          >
            Registrarse
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <strong className="block text-base font-black text-slate-950">Recuperar contraseña</strong>
          <span className="mt-1 block text-sm font-medium text-slate-500">Te enviaremos un enlace seguro a tu correo.</span>
        </div>
      )}
      <form className="space-y-4" onSubmit={submit}>
        {mode === 'register' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TwField label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} maxLength={80} />
            <TwField label="Apellido" value={form.apellido} onChange={(value) => setField('apellido', value)} maxLength={80} />
          </div>
        )}
        <TwField label="Correo electrónico" type="email" value={form.email} onChange={(value) => setField('email', value)} required maxLength={254} autoComplete="email" />
        {mode !== 'reset' && (
          <TwField
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(value) => setField('password', value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            rightElement={<EyeButton show={showPassword} onClick={() => setShowPassword((value) => !value)} label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} />}
          />
        )}
        {mode === 'register' && <PasswordStrength strength={passwordStrength} />}
        {mode === 'login' && nativeApp && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            La app mantendrá tu sesión en este dispositivo. Luego podrás desbloquear con PIN o biometría.
          </div>
        )}
        {mode === 'login' && !nativeApp && (
          <label className="flex items-center gap-3 rounded-xl px-1 text-sm font-medium text-slate-500">
            <input className="h-4 w-4 rounded border-slate-300 accent-emerald-600 focus:ring-emerald-500" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Recordar correo en este navegador</span>
          </label>
        )}
        <PrimaryButton disabled={loading}>
          {loading ? (mode === 'login' ? 'Ingresando...' : mode === 'reset' ? 'Enviando enlace...' : 'Creando cuenta...') : (mode === 'login' ? 'Entrar al sistema' : mode === 'reset' ? 'Enviar enlace' : 'Crear cuenta de cliente')}
        </PrimaryButton>
        <AuthMessage>{message}</AuthMessage>
        {mode === 'login' && <LinkButton onClick={() => { setMessage(''); setMode('reset'); }}>Olvidé mi contraseña</LinkButton>}
        {mode === 'reset' && <LinkButton onClick={() => { setMessage(''); setMode('login'); }}>Volver al inicio de sesión</LinkButton>}
      </form>
    </AuthShell>
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
      setMessage('Las contraseñas no coinciden.');
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
      onComplete?.('Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.');
    } catch (error) {
      setMessage(error.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Recuperar contraseña">
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <strong className="block text-base font-black text-slate-950">Crea tu nueva contraseña</strong>
        <span className="mt-1 block text-sm font-medium text-slate-500">Este formulario solo aparece desde el enlace de recuperación enviado a tu correo.</span>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <TwField
          label="Nueva contraseña"
          type={showPassword ? 'text' : 'password'}
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          rightElement={<EyeButton show={showPassword} onClick={() => setShowPassword((value) => !value)} label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} />}
        />
        <TwField
          label="Confirmar contraseña"
          type={showPassword ? 'text' : 'password'}
          value={form.confirm}
          onChange={(value) => setForm((current) => ({ ...current, confirm: value }))}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
        <PasswordStrength strength={strength} />
        <PrimaryButton disabled={loading}>{loading ? 'Guardando...' : 'Guardar nueva contraseña'}</PrimaryButton>
        <AuthMessage>{message}</AuthMessage>
      </form>
    </AuthShell>
  );
}

export function PinUnlock({ supabase, profile, onUnlock, onFullLogout }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);
  const [lockedUntil, setLockedUntil] = React.useState(() => Number(storage.getRaw('fintrack_pin_locked_until', '0') || 0));
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    async function checkBiometric() {
      if (!isBiometricEnabled()) return;
      const availability = await getBiometricAvailability();
      if (alive) setBiometricAvailable(!!availability.available);
    }
    checkBiometric();
    return () => { alive = false; };
  }, []);

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

  async function unlockWithBiometric() {
    setError('');
    const result = await verifyNativeBiometric();
    if (!result.ok) {
      setError(result.error || 'No se pudo validar la biometría.');
      return;
    }
    storage.remove('fintrack_pin_locked_until');
    onUnlock();
  }

  return (
    <AuthShell title="Desbloquear FinTrack">
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-black text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)]">
            {initials(profile, profile?.email_contacto)}
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-base font-black text-slate-950">{fullName(profile) || 'Cuenta recordada'}</strong>
            <span className="block text-sm font-medium text-slate-500">Ingresa tu PIN para continuar</span>
          </div>
        </div>
        <TwField
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
        <div className="space-y-3">
          <PrimaryButton>Entrar con PIN</PrimaryButton>
          {biometricAvailable && (
            <PrimaryButton type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={unlockWithBiometric}>
              <Fingerprint size={18} /> Desbloquear con biometría
            </PrimaryButton>
          )}
        </div>
        <AuthMessage>{error}</AuthMessage>
        <LinkButton onClick={onFullLogout}>Cerrar sesión completa</LinkButton>
      </form>
    </AuthShell>
  );
}
