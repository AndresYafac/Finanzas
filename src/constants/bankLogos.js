const bankLogo = (fileName) => `/bancos/${fileName}`;

const BANKS = [
  { keys: ['bcp', 'banco de credito', 'banco de credito del peru'], label: 'BCP', logo: bankLogo('bcp.jpg'), color: '#0b4ea2', accent: '#f58220' },
  { keys: ['bbva', 'continental', 'banco continental'], label: 'BBVA', logo: bankLogo('bbva.png'), color: '#004481', accent: '#49a5e6' },
  { keys: ['interbank', 'inter bank'], label: 'Interbank', logo: bankLogo('interbank.jpg'), color: '#00a94f', accent: '#004b8d' },
  { keys: ['scotiabank', 'scotia'], label: 'Scotia', logo: bankLogo('scotiabank.png'), color: '#ec111a', accent: '#ffffff' },
  { keys: ['banbif'], label: 'BanBif', logo: bankLogo('banbif.webp'), color: '#006341', accent: '#d8a328' },
  { keys: ['pichincha', 'banco pichincha'], label: 'Pichincha', color: '#ffd100', accent: '#1f2a44' },
  { keys: ['yape'], label: 'Yape', type: 'billetera', identifier: 'phone', logo: bankLogo('yape.png'), color: '#742384', accent: '#00c4b3' },
  { keys: ['plin'], label: 'Plin', type: 'billetera', identifier: 'phone', logo: bankLogo('plin.webp'), color: '#00a3e0', accent: '#7ac943' },
  { keys: ['tunki'], label: 'Tunki', type: 'billetera', identifier: 'phone', logo: bankLogo('tunki.jpg'), color: '#ff6b00', accent: '#351c75' },
  { keys: ['mercado pago', 'mercadopago'], label: 'MP', type: 'billetera', identifier: 'phone_or_email', color: '#00b1ea', accent: '#ffffff' },
  { keys: ['paypal'], label: 'PayPal', type: 'billetera', identifier: 'email', color: '#003087', accent: '#009cde' },
  { keys: ['efectivo', 'cash', 'caja'], label: 'Cash', type: 'efectivo', color: '#1d9e75', accent: '#e1f5ee' },
];

export function normalizeBankName(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getBankBrand(bankName = '') {
  const normalized = normalizeBankName(bankName);
  return BANKS.find((bank) => bank.keys.some((key) => normalized === key || normalized.includes(key))) || null;
}

export function getBankType(bankName = '') {
  const brand = getBankBrand(bankName);
  return brand?.type || 'banco';
}

export function isWallet(bankName = '') {
  return getBankType(bankName) === 'billetera';
}

export function getBankIdentifierType(bankName = '') {
  const brand = getBankBrand(bankName);
  return brand?.identifier || (getBankType(bankName) === 'efectivo' ? 'none' : 'account');
}

export function getEntityLabel(type = 'banco') {
  if (type === 'billetera') return 'Billetera';
  if (type === 'efectivo') return 'Efectivo';
  return 'Banco';
}

export function validateAccountNumber(bankName = '', number = '') {
  const value = String(number || '').replace(/\s/g, '');
  const identifier = getBankIdentifierType(bankName);
  if (identifier === 'none') return { valid: true };
  if (!value) return { valid: true };
  if (identifier === 'phone') {
    return /^9\d{8}$/.test(value)
      ? { valid: true }
      : { valid: false, message: 'Ingresa un celular valido de 9 digitos que empiece con 9.' };
  }
  if (identifier === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { valid: true }
      : { valid: false, message: 'Ingresa un email valido para esta billetera.' };
  }
  if (identifier === 'phone_or_email') {
    return /^9\d{8}$/.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { valid: true }
      : { valid: false, message: 'Ingresa un celular peruano o email valido.' };
  }
  return /^\d{6,24}$/.test(value)
    ? { valid: true }
    : { valid: false, message: 'Ingresa un numero de cuenta valido.' };
}

export function validateCci(bankName = '', cci = '') {
  const type = getBankType(bankName);
  const value = String(cci || '').replace(/\s/g, '');
  if (type !== 'banco') {
    return value
      ? { valid: false, message: 'Las billeteras y cajas de efectivo no usan CCI.' }
      : { valid: true };
  }
  if (!value) return { valid: true };
  return /^\d{20}$/.test(value)
    ? { valid: true }
    : { valid: false, message: 'El CCI debe tener 20 digitos.' };
}
