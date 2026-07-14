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
    ['min', 'Minimo 8 caracteres', password.length >= 8],
    ['upper', 'Una mayuscula', /[A-Z]/.test(password)],
    ['lower', 'Una minuscula', /[a-z]/.test(password)],
    ['number', 'Un numero', /\d/.test(password)],
    ['symbol', 'Un simbolo', /[^A-Za-z0-9]/.test(password)],
    ['common', 'No usar una contrasena comun', !COMMON_PASSWORDS.has(lowerPassword)],
    ['email', 'No debe parecerse al correo', !emailName || !lowerPassword.includes(emailName)],
  ];
}

export function getPasswordStrength(password = '', email = '') {
  const checks = getPasswordChecks(password, email);
  const passed = checks.filter(([, , ok]) => ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const label = score >= 86 ? 'Fuerte' : score >= 58 ? 'Media' : 'Debil';
  return { checks, passed, score, label, valid: checks.every(([, , ok]) => ok) };
}

export function validatePassword(password = '', email = '') {
  const strength = getPasswordStrength(password, email);
  return strength.valid ? null : 'La contrasena no cumple los requisitos minimos de seguridad.';
}
