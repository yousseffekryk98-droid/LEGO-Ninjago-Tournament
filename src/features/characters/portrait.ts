import type { CharacterDef } from './types';

const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[char] ?? char));
}

/**
 * Clean-room minifigure portrait used by the fan remake.
 * It is generated from gameplay data rather than copied from LEGO artwork,
 * so every fighter gets a readable identity without shipping official assets.
 */
export function fighterPortraitDataUri(character: CharacterDef) {
  const primary = hex(character.color);
  const accent = hex(character.accent);
  const label = escapeXml(character.element.slice(0, 10).toUpperCase());
  const isRobot = /nindroid|p\.i\.x\.a\.l|zane/i.test(`${character.element} ${character.name}`);
  const isSerpentine = /serpentine|anacondrai|constrictai|hypnobrai|venomari/i.test(character.element);
  const face = isRobot ? '#bcc8cf' : isSerpentine ? primary : '#f1c64d';
  const eye = isRobot ? '#73ddff' : '#1c1715';
  const hood = !/teacher|master chen|garmadon|karlof|samurai|p\.i\.x\.a\.l/i.test(character.name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 184" role="img" aria-label="${escapeXml(character.name)} portrait">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset=".46" stop-color="#211829"/><stop offset="1" stop-color="${primary}"/></linearGradient>
      <linearGradient id="body" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="#151219"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".55"/></filter>
    </defs>
    <rect width="160" height="184" rx="18" fill="url(#bg)"/>
    <path d="M13 26h49M98 26h49M13 157h36M111 157h36" stroke="${accent}" stroke-width="3" opacity=".62"/>
    <circle cx="80" cy="75" r="48" fill="#0d0b10" opacity=".33"/>
    <g filter="url(#shadow)">
      <path d="M39 174 49 116 80 104l31 12 10 58Z" fill="url(#body)" stroke="${accent}" stroke-width="3"/>
      <path d="M51 119 80 143l29-24" fill="none" stroke="${accent}" stroke-width="8"/>
      <rect x="57" y="50" width="46" height="55" rx="13" fill="${face}" stroke="#161219" stroke-width="4"/>
      ${hood ? `<path d="M46 63Q48 29 80 27q32 2 34 36l-12-1-5-15H63l-5 15Z" fill="${primary}" stroke="#17131a" stroke-width="4"/><path d="M48 84h64v21l-17 15H65l-17-15Z" fill="${primary}" stroke="#17131a" stroke-width="4"/><path d="M58 65h44v22H58Z" fill="#17131a"/>` : ''}
      <path d="M64 75h12M84 75h12" stroke="${eye}" stroke-width="6" stroke-linecap="round"/>
      <path d="M70 90q10 7 20 0" fill="none" stroke="#7e5f27" stroke-width="2" opacity="${hood ? '0' : '.65'}"/>
      <rect x="48" y="151" width="64" height="9" rx="4.5" fill="${accent}"/>
      <circle cx="80" cy="132" r="10" fill="#17131a" stroke="${accent}" stroke-width="4"/>
    </g>
    <rect x="12" y="12" width="52" height="19" rx="9.5" fill="#0f0c13" opacity=".78" stroke="${accent}" stroke-width="1.5"/>
    <text x="38" y="25.5" fill="#fff1bf" font-family="system-ui,sans-serif" font-size="8" font-weight="800" text-anchor="middle">${label}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
