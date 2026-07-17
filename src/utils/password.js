const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin1234',
  'fintrack123',
]);

export function getPasswordChecks(password = '', email = '') {
  const lowerPassword = password.toLowerCase();
  const emailName = String(email).split('@')[0]?.toLowerCase() || '';
  return [
    ['min', 'Mínimo 8 caracteres', password.length >= 8],
    ['upper', 'Una mayúscula', /[A-Z]/.test(password)],
    ['lower', 'Una minúscula', /[a-z]/.test(password)],
    ['number', 'Un número', /\d/.test(password)],
    ['symbol', 'Un símbolo', /[^A-Za-z0-9]/.test(password)],
    ['common', 'No usar una contraseña común', !COMMON_PASSWORDS.has(lowerPassword)],
    ['email', 'No debe parecerse al correo', !emailName || !lowerPassword.includes(emailName)],
  ];
}

export function getPasswordStrength(password = '', email = '') {
  const checks = getPasswordChecks(password, email);
  if (!password) {
    return { checks, passed: 0, score: 0, label: 'Sin evaluar', valid: false, empty: true };
  }
  const passed = checks.filter(([, , ok]) => ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const label = score >= 86 ? 'Fuerte' : score >= 58 ? 'Media' : 'Débil';
  return { checks, passed, score, label, valid: checks.every(([, , ok]) => ok), empty: false };
}

export function validatePassword(password = '', email = '') {
  const strength = getPasswordStrength(password, email);
  return strength.valid ? null : 'La contraseña no cumple los requisitos mínimos de seguridad.';
}
