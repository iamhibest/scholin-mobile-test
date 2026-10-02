// @ts-nocheck
/* =========================================================
   Report Card — Theme Engine
   =========================================================
   Handles: color presets, automatic contrast/readable-text
   calculation, and the Black & White mode transform. Every template
   renderer consumes a "resolved theme" object built by
   resolveTheme(rawTheme) below, so no template has to reimplement
   contrast logic itself.
   ========================================================= */

export const REPORT_CARD_PRESETS = {
  royal_blue:    { name: 'Royal Blue',    primary: '#1B3A6B', secondary: '#2C5AA0', accent: '#D4AF37', background: '#FFFFFF' },
  emerald_green: { name: 'Emerald Green', primary: '#0B5D3B', secondary: '#178856', accent: '#D4AF37', background: '#FFFFFF' },
  wine_red:      { name: 'Wine Red',      primary: '#6E1423', secondary: '#8C1D34', accent: '#D4AF37', background: '#FFF9F5' },
  purple_royal:  { name: 'Purple Royal',  primary: '#3B1E5E', secondary: '#5B2C87', accent: '#D4AF37', background: '#FBF8FF' },
  deep_navy:     { name: 'Deep Navy',     primary: '#0D1B3E', secondary: '#1B2A4A', accent: '#C9A15C', background: '#FFFFFF' },
  teal:          { name: 'Teal',          primary: '#0F6E6E', secondary: '#128C8C', accent: '#F2A93B', background: '#F5FEFE' },
  orange_gold:   { name: 'Orange Gold',   primary: '#C0501E', secondary: '#E07A2C', accent: '#1B2A4A', background: '#FFFBF5' },
  sky_blue:      { name: 'Sky Blue',      primary: '#1D6FA5', secondary: '#3B8FC4', accent: '#F2A93B', background: '#F5FBFF' },
  forest_green:  { name: 'Forest Green',  primary: '#1F4A2C', secondary: '#2F6B41', accent: '#C9A15C', background: '#F7FBF7' },
  burgundy:      { name: 'Burgundy',      primary: '#5C1A2E', secondary: '#7A2440', accent: '#D4AF37', background: '#FFF9F9' },
  slate_gray:    { name: 'Slate Gray',    primary: '#37424A', secondary: '#54646F', accent: '#B08D57', background: '#FAFAFA' },
  black_white:   { name: 'Black & White', primary: '#000000', secondary: '#333333', accent: '#666666', background: '#FFFFFF', blackAndWhite: true },
  classic_school:{ name: 'Classic School',primary: '#1B2A4A', secondary: '#7a1f2b', accent: '#C9A15C', background: '#FBF6EC' },
  premium_gold:  { name: 'Premium Gold',  primary: '#2A2018', secondary: '#4A3B28', accent: '#D4AF37', background: '#FFFCF5' },
  soft_cream:    { name: 'Soft Cream',    primary: '#8C6D46', secondary: '#A9813E', accent: '#5C4A30', background: '#FFF9EE' },
  minimal_white: { name: 'Minimal White', primary: '#1B2A4A', secondary: '#3B4A6B', accent: '#8C6D46', background: '#FFFFFF' }
};

/**
 * Relative luminance -> decides whether black or white text reads
 * better on a given background color. Standard WCAG-style formula.
 */
export function getReadableTextColor(hexColor) {
  const hex = (hexColor || '#ffffff').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const [rl, gl, bl] = [r, g, b].map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

export function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darken(hex, amount) {
  const h = (hex || '#000000').replace('#', '');
  const r = Math.max(0, parseInt(h.substring(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(h.substring(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(h.substring(4, 6), 16) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Turns a raw { primary_color, secondary_color, accent_color,
 * background_color, black_and_white } theme into a fully resolved set
 * of CSS-ready values every template can use directly — automatic
 * text colors, tinted backgrounds, borders, and hover shades, so no
 * template has to compute contrast itself and no admin can produce an
 * unreadable combination.
 */
export function resolveTheme(rawTheme) {
  const t = rawTheme || {};
  const bw = !!t.black_and_white;

  const primary = bw ? '#000000' : (t.primary_color || '#1B2A4A');
  const secondary = bw ? '#333333' : (t.secondary_color || '#7a1f2b');
  const accent = bw ? '#666666' : (t.accent_color || '#C9A15C');
  const background = bw ? '#FFFFFF' : (t.background_color || '#FFFFFF');

  return {
    primary, secondary, accent, background,
    blackAndWhite: bw,
    textOnPrimary: getReadableTextColor(primary),
    textOnSecondary: getReadableTextColor(secondary),
    textOnAccent: getReadableTextColor(accent),
    textOnBackground: getReadableTextColor(background),
    border: bw ? '#999999' : hexToRgba(primary, 0.25),
    tintPrimary: bw ? '#F2F2F2' : hexToRgba(primary, 0.08),
    tintSecondary: bw ? '#F2F2F2' : hexToRgba(secondary, 0.08),
    tintAccent: bw ? '#F2F2F2' : hexToRgba(accent, 0.12),
    primaryDark: darken(primary, 30),
    secondaryDark: darken(secondary, 30)
  };
}

export const REPORT_CARD_TEMPLATES = [
  { key: 'classic',     name: 'Scholin Classic',       description: 'The original Scholin design — navy header, wine-red accents, formal ledger styling.' },
  { key: 'modern',      name: 'Scholin Modern',        description: 'Card-based layout with icons and soft rounded sections.' },
  { key: 'royal',       name: 'Scholin Royal',         description: 'Premium cream and gold, ornate corner flourishes.' },
  { key: 'british',     name: 'Scholin British',       description: 'Formal boxed layout in the style of traditional academic reports.' },
  { key: 'prestige',    name: 'Scholin Prestige',      description: 'Luxury certificate design with a dark sidebar crest.' },
  { key: 'minimal',     name: 'Scholin Minimal',       description: 'Clean, spacious, distraction-free white layout.' },
  { key: 'primary',     name: 'Scholin Primary',       description: 'Bright, friendly design suitable for nursery and primary schools.' },
  { key: 'monochrome',  name: 'Scholin Black & White', description: 'Professional monochrome layout, optimized for black & white printing.' }
];
