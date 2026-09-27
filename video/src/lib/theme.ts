import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { createContext, useContext } from 'react';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 60 * FPS;

export const sans = loadInter('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
}).fontFamily;
export const mono = loadMono('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin'],
}).fontFamily;

// Cinematic stage colours (outside the product UI).
export const stage = {
  bg: '#05060B',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#22D3EE',
  orange: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  white: '#F8FAFC',
  dim: 'rgba(248,250,252,0.55)',
};

// Product UI tokens lifted from the real app (dark + light).
export type Tokens = {
  mode: 'dark' | 'light';
  bg: string;
  sidebar: string;
  card: string;
  cardHead: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  primary: string;
  primaryText: string;
  input: string;
  variable: string;
  varBg: string;
  ref: string;
  refBg: string;
  accent: string;
  hover: string;
};

export const dark: Tokens = {
  mode: 'dark',
  bg: '#0A0A0A',
  sidebar: '#141414',
  card: '#121212',
  cardHead: '#171717',
  border: '#262626',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  subtle: '#71717A',
  primary: '#FAFAFA',
  primaryText: '#0A0A0A',
  input: '#0A0A0A',
  variable: '#F5A524',
  varBg: 'rgba(234,88,12,0.16)',
  ref: '#60A5FA',
  refBg: 'rgba(37,99,235,0.16)',
  accent: '#4F46E5',
  hover: '#1F1F22',
};

export const light: Tokens = {
  mode: 'light',
  bg: '#FFFFFF',
  sidebar: '#F8FAFC',
  card: '#FFFFFF',
  cardHead: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  primary: '#0F172A',
  primaryText: '#FFFFFF',
  input: '#FFFFFF',
  variable: '#EA8C00',
  varBg: 'rgba(234,88,12,0.10)',
  ref: '#2563EB',
  refBg: 'rgba(37,99,235,0.08)',
  accent: '#4F46E5',
  hover: '#F1F5F9',
};

export const ThemeCtx = createContext<Tokens>(dark);
export const useTokens = () => useContext(ThemeCtx);
