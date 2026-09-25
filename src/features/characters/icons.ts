import type { CharacterDef } from './types';
import { getCharacterModelProfile } from './model-profile';

const cache = new Map<string, string>();

const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

function escapeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function identityDecoration(style: ReturnType<typeof getCharacterModelProfile>['identityStyle'], accent: string, dark: string) {
  if (style === 'chen') {
    return `
      <ellipse cx="48" cy="24" rx="31" ry="6" fill="${dark}"/>
      <path d="M30 24 35 7h26l8 17Z" fill="${accent}"/>
      <path d="M39 62q9 15 18 0v18H39Z" fill="${dark}"/>
    `;
  }
  if (style === 'clouse') return `<path d="M26 25Q48 2 70 25L64 39H32Z" fill="${dark}"/><path d="m48 16 5 8-5 5-5-5Z" fill="${accent}"/>`;
  if (style === 'eyezor') return `<path d="M25 43h46v5H25Z" fill="${dark}"/><rect x="30" y="37" width="17" height="15" rx="3" fill="${dark}"/><path d="m58 37 6 22" stroke="${accent}" stroke-width="4"/>`;
  if (style === 'zugu') return `<path d="M23 35h50v8H23Z" fill="${accent}"/><path d="M31 62h34v10H31Z" fill="${dark}"/>`;
  if (style === 'karlof') return `<path d="M24 58h48v14H24Z" fill="${accent}"/><circle cx="31" cy="51" r="4" fill="${accent}"/><circle cx="65" cy="51" r="4" fill="${accent}"/>`;
  if (style === 'griffin') return `<path d="m24 29 8-20 9 15 7-21 9 21 10-14 5 21Z" fill="${dark}"/><path d="M26 41h44v4H26Z" fill="${accent}"/>`;
  if (style === 'shade') return `<path d="M25 43h46v5H25Z" fill="${accent}"/><path d="M29 18Q48 3 67 18l7 20H22Z" fill="${dark}" opacity=".92"/>`;
  if (style === 'neuro') return `<circle cx="24" cy="47" r="8" fill="${accent}"/><circle cx="72" cy="47" r="8" fill="${accent}"/><path d="m48 18 6 10-6 6-6-6Z" fill="${accent}"/>`;
  if (style === 'paleman') return `<circle cx="48" cy="47" r="34" fill="none" stroke="${accent}" stroke-width="5" opacity=".75"/>`;
  if (style === 'tox') return `<path d="m25 28 6-19 11 15 6-22 8 22 12-16 4 22Z" fill="${dark}"/><circle cx="22" cy="67" r="7" fill="${accent}"/><circle cx="74" cy="67" r="7" fill="${accent}"/>`;
  if (style === 'skylor') return `<path d="M25 32Q32 8 48 9q20 1 24 23Z" fill="${dark}"/><circle cx="74" cy="33" r="9" fill="${dark}"/><path d="M26 40h44v4H26Z" fill="${accent}"/>`;
  if (style === 'chamille') return `<path d="m27 29 7-20 8 16 7-22 8 22 9-17 5 21Z" fill="${accent}"/><path d="m61 38 4 28" stroke="${accent}" stroke-width="4"/>`;
  if (style === 'ash') return `<path d="M25 31Q27 9 43 12q6-10 12 0 16-5 18 19Z" fill="${accent}" opacity=".75"/>`;
  return '';
}

export function getCharacterSvgIcon(character: CharacterDef) {
  const cached = cache.get(character.id);
  if (cached) return cached;

  const profile = getCharacterModelProfile(character);
  const primary = hex(character.color);
  const accent = hex(character.accent);
  const dark = '#17191c';
  const face = hex(profile.faceColor ?? 0xf2c64f);
  const eye = hex(profile.eyeColor ?? 0x17191c);

  const hood = profile.hood
    ? `<path d="M18 42Q19 12 48 9q29 3 30 33l-9 5-5-14H32l-5 14Z" fill="${primary}"/><path d="M28 38h40v11H28Z" fill="${dark}"/>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${character.name}">
      <defs>
        <radialGradient id="bg" cx="42%" cy="32%">
          <stop offset="0" stop-color="${accent}" stop-opacity=".72"/>
          <stop offset=".6" stop-color="${primary}" stop-opacity=".34"/>
          <stop offset="1" stop-color="#16131b"/>
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="url(#bg)" stroke="#b78933" stroke-width="4"/>
      <circle cx="48" cy="48" r="39" fill="#241d2a" opacity=".72"/>
      <path d="M31 35q0-13 17-13t17 13v27q0 12-17 12T31 62Z" fill="${face}"/>
      <rect x="42" y="18" width="12" height="8" rx="3" fill="${face}"/>
      ${hood}
      <rect x="36" y="44" width="8" height="4" rx="2" fill="${eye}"/>
      <rect x="52" y="44" width="8" height="4" rx="2" fill="${eye}"/>
      <path d="M40 62q8 5 16 0" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>
      ${identityDecoration(profile.identityStyle, accent, dark)}
      <circle cx="48" cy="83" r="7" fill="${accent}" stroke="#1a161c" stroke-width="2"/>
    </svg>
  `;

  const uri = escapeSvg(svg);
  cache.set(character.id, uri);
  return uri;
}
