import type { ColorScheme, Mode } from '../types';
import { githubDark } from './github-dark';
import { githubLight } from './github-light';
import { dracula } from './dracula';
import { monokai } from './monokai';
import { nordDark } from './nord-dark';
import { solarizedLight } from './solarized-light';
import { nordLight } from './nord-light';

export const ALL_SCHEMES: ColorScheme[] = [
  githubDark,
  dracula,
  monokai,
  nordDark,
  githubLight,
  solarizedLight,
  nordLight,
];

export const DARK_SCHEMES = ALL_SCHEMES.filter((s) => s.mode === 'dark');
export const LIGHT_SCHEMES = ALL_SCHEMES.filter((s) => s.mode === 'light');

const schemeMap = new Map(ALL_SCHEMES.map((s) => [s.id, s]));

export function getScheme(id: string): ColorScheme | undefined {
  return schemeMap.get(id);
}

export function getSchemesForMode(mode: Mode): ColorScheme[] {
  return mode === 'dark' ? DARK_SCHEMES : LIGHT_SCHEMES;
}
