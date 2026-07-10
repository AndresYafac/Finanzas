const bankLogo = (fileName) => `/bancos/${fileName}`;

const BANKS = [
  { keys: ['bcp', 'banco de credito', 'banco de credito del peru'], label: 'BCP', logo: bankLogo('bcp.jpg'), color: '#0b4ea2', accent: '#f58220' },
  { keys: ['bbva', 'continental', 'banco continental'], label: 'BBVA', logo: bankLogo('bbva.png'), color: '#004481', accent: '#49a5e6' },
  { keys: ['interbank', 'inter bank'], label: 'Interbank', logo: bankLogo('interbank.jpg'), color: '#00a94f', accent: '#004b8d' },
  { keys: ['scotiabank', 'scotia'], label: 'Scotia', logo: bankLogo('scotiabank.png'), color: '#ec111a', accent: '#ffffff' },
  { keys: ['banbif'], label: 'BanBif', logo: bankLogo('banbif.webp'), color: '#006341', accent: '#d8a328' },
  { keys: ['pichincha', 'banco pichincha'], label: 'Pichincha', color: '#ffd100', accent: '#1f2a44' },
  { keys: ['yape'], label: 'Yape', logo: bankLogo('yape.png'), color: '#742384', accent: '#00c4b3' },
  { keys: ['plin'], label: 'Plin', logo: bankLogo('plin.webp'), color: '#00a3e0', accent: '#7ac943' },
  { keys: ['tunki'], label: 'Tunki', logo: bankLogo('tunki.jpg'), color: '#ff6b00', accent: '#351c75' },
  { keys: ['mercado pago', 'mercadopago'], label: 'MP', color: '#00b1ea', accent: '#ffffff' },
  { keys: ['paypal'], label: 'PayPal', color: '#003087', accent: '#009cde' },
  { keys: ['efectivo', 'cash', 'caja'], label: 'Cash', color: '#1d9e75', accent: '#e1f5ee' },
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
