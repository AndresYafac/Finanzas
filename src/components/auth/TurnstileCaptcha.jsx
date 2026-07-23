import React from 'react';

const SCRIPT_ID = 'fintrack-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function TurnstileCaptcha({ siteKey, resetKey, onVerify, onExpire }) {
  const containerRef = React.useRef(null);
  const widgetRef = React.useRef(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    if (!siteKey || !containerRef.current) return undefined;
    setError('');

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        if (widgetRef.current) turnstile.remove(widgetRef.current);
        widgetRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => onVerify?.(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => {
            onExpire?.();
            setError('No se pudo validar el captcha. Intenta nuevamente.');
          },
        });
      })
      .catch(() => {
        onExpire?.();
        setError('No se pudo cargar la validacion anti-bots.');
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetRef.current) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [siteKey, resetKey, onVerify, onExpire]);

  if (!siteKey) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div ref={containerRef} className="min-h-[65px]" />
      {error ? <p className="mt-2 text-center text-xs font-semibold text-red-500">{error}</p> : null}
    </div>
  );
}
