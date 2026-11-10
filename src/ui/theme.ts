import { useColorScheme } from 'react-native';

const light = {
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEEF2',
  text: '#15181D',
  textMuted: '#5D6572',
  border: '#D9DEE5',
  gridLine: '#E6E9EE',
  accent: '#2F6FEB',
  accentSoft: 'rgba(47,111,235,0.14)',
  onAccent: '#FFFFFF',
  danger: '#D33A3A',
  warn: '#A8660B',
  warnSoft: '#FCF1DE',
  success: '#2B8A57',
  successSoft: '#E2F4EA',
  nowLine: '#E5484D',
  overlay: 'rgba(10,12,16,0.45)',
  busyText: '#FFFFFF',
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#22262E',
  text: '#ECEEF2',
  textMuted: '#9AA3B0',
  border: '#2E333C',
  gridLine: '#23272F',
  accent: '#6B9BFF',
  accentSoft: 'rgba(107,155,255,0.18)',
  onAccent: '#0B1020',
  danger: '#FF6B6B',
  warn: '#F0B35A',
  warnSoft: '#3A2D16',
  success: '#5BC48A',
  successSoft: '#17301F',
  nowLine: '#FF6B6B',
  overlay: 'rgba(0,0,0,0.6)',
  busyText: '#FFFFFF',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Colours for busy blocks and routines (muted so tasks stand out). */
export const BLOCK_COLORS = ['#7C8DB5', '#C27C7C', '#7FA37F', '#B49660', '#9A7CB5', '#5FA3A8', '#B07AA1', '#8A8F98'];
