import { storage } from '../services/storage.service';

export const COMPANY_CONFIG_KEY = 'fintrack_company_config';
export const VISUAL_CONFIG_KEY = 'fintrack_visual_config';

export const DEFAULT_COMPANY_CONFIG = {
  nombre: 'FinTrack Pro',
  documento: '',
  direccion: '',
  telefono: '',
  logo_url: '',
  primary_color: '#1d9e75',
  accent_color: '#378add',
  theme: 'light',
  visual_style: 'aurora',
  surface_style: 'glass',
  density: 'comfortable',
};

function hexToRgb(hex, fallback = '29, 158, 117') {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  const value = Number.parseInt(clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function getCompanyConfig() {
  try {
    return { ...DEFAULT_COMPANY_CONFIG, ...(storage.getJson(COMPANY_CONFIG_KEY, {}) || {}) };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

export function getVisualConfig(userId) {
  try {
    const userConfig = userId ? storage.getJson(`${VISUAL_CONFIG_KEY}_${userId}`, null) : null;
    const sharedConfig = storage.getJson(VISUAL_CONFIG_KEY, null);
    const companyConfig = getCompanyConfig();
    return {
      primary_color: companyConfig.primary_color || DEFAULT_COMPANY_CONFIG.primary_color,
      accent_color: companyConfig.accent_color || DEFAULT_COMPANY_CONFIG.accent_color,
      theme: companyConfig.theme || DEFAULT_COMPANY_CONFIG.theme,
      visual_style: companyConfig.visual_style || DEFAULT_COMPANY_CONFIG.visual_style,
      surface_style: companyConfig.surface_style || DEFAULT_COMPANY_CONFIG.surface_style,
      density: companyConfig.density || DEFAULT_COMPANY_CONFIG.density,
      ...(sharedConfig || {}),
      ...(userConfig || {}),
    };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

export function saveVisualConfig(userId, config) {
  const key = userId ? `${VISUAL_CONFIG_KEY}_${userId}` : VISUAL_CONFIG_KEY;
  storage.setJson(key, config);
}

export function applyVisualConfig(config = getVisualConfig()) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_COMPANY_CONFIG, ...config };
  root.dataset.theme = merged.theme === 'dark' ? 'dark' : 'light';
  root.dataset.visualStyle = merged.visual_style || DEFAULT_COMPANY_CONFIG.visual_style;
  root.dataset.surfaceStyle = merged.surface_style || DEFAULT_COMPANY_CONFIG.surface_style;
  root.dataset.density = merged.density || DEFAULT_COMPANY_CONFIG.density;
  root.style.setProperty('--primary', merged.primary_color || DEFAULT_COMPANY_CONFIG.primary_color);
  root.style.setProperty('--primary-rgb', hexToRgb(merged.primary_color, '29, 158, 117'));
  root.style.setProperty('--accent', merged.accent_color || DEFAULT_COMPANY_CONFIG.accent_color);
  root.style.setProperty('--accent-rgb', hexToRgb(merged.accent_color, '55, 138, 221'));
}
