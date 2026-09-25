import './styles.css';
import { TournamentGame, type HudState } from '../features/combat';
import { DojoGame, type DojoAction, type DojoStep } from '../features/dojo/DojoGame';
import { formatKeyLabel, getKeyBindings, showControlsPanel } from '../features/controls';
import {
  ROSTER,
  CharacterPreview,
  characterSearchText,
  findCharacter,
  getCharacterIdentity,
  getCharacterReferenceImage,
  getElementCombatTheme,
  getCachedCharacterPortrait,
  getUserCharacterPortrait,
  getCharacterSvgIcon,
  getBossRushRoster,
  renderCharacterPortraits,
  type CharacterDef
} from '../features/characters';
import {
  LEVEL_THRESHOLDS,
  applyFighterXp,
  fighterLevelFromXp,
  fighterUpgradeCostFromXp,
  nextUpgradeCopyFromXp,
  xpProgressFromXp
} from '../features/progression';

interface DailyState {
  date: string;
  draws: number;
  runs: number;
  studs: number;
  bestWave: number;
  claimed: string[];
}

interface SaveData {
  bankStuds: number;
  unlocked: string[];
  selected: string;
  bestWave: number;
  bestRun: number;
  totalRuns: number;
  fighterXp: Record<string, number>;
  daily: DailyState;
}

interface MoveController {
  setMove: (x: number, y: number) => void;
}

interface DodgeController {
  dodge: (x?: number, y?: number) => void;
}

const STORAGE_KEY = 'ninja-tournament-fan-remake-v1';
const SAVE_CACHE_KEY = `${STORAGE_KEY}:cache`;

function localDateKey() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function freshDaily(): DailyState {
  return { date: localDateKey(), draws: 1, runs: 0, studs: 0, bestWave: 0, claimed: [] };
}

const defaults = (): SaveData => ({
  bankStuds: 0,
  unlocked: ROSTER.map((c) => c.id),
  selected: ROSTER[0].id,
  bestWave: 0,
  bestRun: 0,
  totalRuns: 0,
  fighterXp: {},
  daily: freshDaily()
});

function readSaveSnapshot(): Partial<SaveData> | null {
  for (const key of [STORAGE_KEY, SAVE_CACHE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<SaveData> | null;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // A damaged primary save should never destroy the mirrored cache.
    }
  }
  return null;
}

function loadSave(): SaveData {
  const saved = readSaveSnapshot();
  if (!saved) return defaults();

  const base = defaults();
  const daily = saved.daily && saved.daily.date === localDateKey()
    ? {
        date: saved.daily.date,
        draws: Math.max(0, saved.daily.draws ?? 0),
        runs: Math.max(0, saved.daily.runs ?? 0),
        studs: Math.max(0, saved.daily.studs ?? 0),
        bestWave: Math.max(0, saved.daily.bestWave ?? 0),
        claimed: Array.isArray(saved.daily.claimed) ? saved.daily.claimed : []
      }
    : freshDaily();

  return {
    bankStuds: Math.max(0, saved.bankStuds ?? base.bankStuds),
    // Free-play build: every playable roster entry stays available even for old saves.
    unlocked: ROSTER.map((fighter) => fighter.id),
    selected: saved.selected && ROSTER.some((c) => c.id === saved.selected) ? saved.selected : base.selected,
    bestWave: Math.max(0, saved.bestWave ?? 0),
    bestRun: Math.max(0, saved.bestRun ?? 0),
    totalRuns: Math.max(0, saved.totalRuns ?? 0),
    fighterXp: saved.fighterXp && typeof saved.fighterXp === 'object' ? saved.fighterXp : {},
    daily
  };
}

let save = loadSave();
let activeGame: TournamentGame | null = null;
let activeDojo: DojoGame | null = null;
let activeCharacterPreview: CharacterPreview | null = null;
let continueUsedThisRun = false;
let lastHudWave = 0;
let lastHudEnemies = 0;
let stageBannerTimer = 0;
let freePlayMode = false;
let bossRushMode = false;
const app = document.querySelector<HTMLDivElement>('#app')!;

function persist() {
  const payload = JSON.stringify(save);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(SAVE_CACHE_KEY, payload);
}

function refreshSaveFromStorage() {
  save = loadSave();
}

function formatStuds(value: number) {
  return Math.floor(value).toLocaleString();
}

function legacyActionIcon(type: 'jump' | 'block' | 'grab' | 'punch' | 'kick' | 'spin') {
  const common = 'viewBox="0 0 36 36" aria-hidden="true" focusable="false"';
  if (type === 'jump') {
    return `<svg ${common}><path d="M18 4 9 15h6v8h6v-8h6L18 4Z"/><path d="M9 29c5-3 13-3 18 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  }
  if (type === 'block') {
    return `<svg ${common}><path d="M18 3 29 7v9c0 8-4.8 14-11 17C11.8 30 7 24 7 16V7l11-4Z"/><path d="M18 8v19" fill="none" stroke="#24172d" stroke-width="3" opacity=".55"/></svg>`;
  }
  if (type === 'grab') {
    return `<svg ${common}><path d="M9 17V9c0-2 3-2 3 0v6h1V6c0-2 3-2 3 0v9h1V5c0-2 3-2 3 0v10h1V7c0-2 3-2 3 0v11l3-3c2-2 4 1 2 3l-7 10c-2 3-5 4-9 3-5-1-8-6-8-11v-3c0-2 4-2 4 0Z"/></svg>`;
  }
  if (type === 'punch') {
    return `<svg ${common}><path d="M8 17v-5c0-3 4-3 4 0v4h1V9c0-3 4-3 4 0v7h1V8c0-3 4-3 4 0v8h1v-5c0-3 4-3 4 0v8c0 8-4 13-11 13-7 0-11-5-11-11 0-3 3-5 6-4l3 2v-2H8Z"/></svg>`;
  }
  if (type === 'kick') {
    return `<svg ${common}><path d="M10 5h9l2 11 8 3c3 1 4 4 2 7l-2 3-13-5-4-9-5-3 3-7Z"/><path d="m21 16 4 8" fill="none" stroke="#24172d" stroke-width="2.5" opacity=".45"/></svg>`;
  }
  return `<svg ${common}><path d="M29 15c-1-7-9-11-15-7-5 3-6 10-2 14 4 4 11 3 13-2 2-4-1-8-5-8-4 0-6 5-3 8 2 2 5 1 6-1" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="m27 9 3 6-6 1" fill="currentColor"/></svg>`;
}

function fighterLevel(id: string) {
  return fighterLevelFromXp(save.fighterXp[id] ?? 0);
}

function xpProgress(id: string) {
  return xpProgressFromXp(save.fighterXp[id] ?? 0);
}

function fighterUpgradeCost(id: string) {
  return fighterUpgradeCostFromXp(save.fighterXp[id] ?? 0);
}

function nextUpgradeCopy(id: string) {
  return nextUpgradeCopyFromXp(save.fighterXp[id] ?? 0);
}

function upgradedCharacter(base: CharacterDef): CharacterDef {
  return applyFighterXp(base, save.fighterXp[base.id] ?? 0);
}

function cleanupGame() {
  activeGame?.destroy();
  activeGame = null;
  activeDojo?.destroy();
  activeDojo = null;
  activeCharacterPreview?.destroy();
  activeCharacterPreview = null;
}

function showHome() {
  cleanupGame();
  freePlayMode = false;
  bossRushMode = false;
  const selected = findCharacter(save.selected);
  const selectedIdentity = getCharacterIdentity(selected);
  const level = fighterLevel(selected.id);
  app.innerHTML = `
    <main class="menu-screen">
      <div class="dragon-pattern"></div>
      <section class="title-card legacy-title-card">
        <div class="production-menu-kicker" aria-hidden="true"><i></i><span>ISLAND TOURNAMENT</span><i></i></div>
        <div class="chen-seal" aria-hidden="true"><i></i><b>陳</b></div>
        <p class="eyebrow">MASTER CHEN PRESENTS</p>
        <h1 class="classic-logo"><span>NINJA</span><strong>TOURNAMENT</strong><em>OF ELEMENTS</em></h1>
        <p class="subtitle">Enter Chen's Island arena, master your elemental fighter, survive the waves and unlock your True Potential.</p>
        <div class="selected-fighter">
          <span class="fighter-dot" style="--fighter:#${selected.color.toString(16).padStart(6, '0')}"></span>
          <div>
            <small>SELECTED FIGHTER · LEVEL ${level}</small>
            <b class="fighter-primary-name">${selectedIdentity.name}</b>
            ${selectedIdentity.variant ? `<span class="fighter-variant">${selectedIdentity.variant}</span>` : ''}
            <em>${selected.element} · ${selected.style} · ${selected.special.replace('-', ' ')}</em>
          </div>
        </div>
        <div class="menu-actions">
          <button class="gold-button primary" id="play-btn">▶ ENTER TOURNAMENT</button>
          <button class="gold-button boss-rush-button" id="boss-rush-btn">⚔ ELEMENTAL MASTER GAUNTLET</button>
          <button class="gold-button" id="fighters-btn">◉ FIGHTERS (${ROSTER.length})</button>
          <button class="gold-button" id="rewards-btn">✦ DAILY DRAW & CHALLENGES ${save.daily.draws > 0 ? `(${save.daily.draws})` : ''}</button>
          <button class="gold-button" id="dojo-btn">◇ PLAY DOJO TUTORIAL</button>
          <button class="gold-button" id="controls-btn">⌨ KEYBOARD CONTROLS</button>
          <button class="gold-button freeplay-button" id="freeplay-btn">∞ FREE PLAY · UNLIMITED SPINJITZU</button>
          <a class="gold-button github-link-button" href="https://github.com/yousseffekryk98-droid/LEGO-Ninjago-Tournament" target="_blank" rel="noopener noreferrer" aria-label="Open Ninja Tournament source code on GitHub">⌘ GITHUB · SOURCE CODE</a>
        </div>
        <div class="save-stats">
          <span>◉ ${formatStuds(save.bankStuds)} banked studs</span>
          <span>Best wave ${save.bestWave}</span>
          <span>Best run ${formatStuds(save.bestRun)}</span>
          <span>${save.totalRuns} runs</span>
        </div>
        <p class="legal-note">Fan project only. No extracted APK/OBB assets, official logos, audio, models, textures, animations, or source code are included. · <a href="/about.html">About / Open Source</a></p>
      </section>
    </main>`;

  document.querySelector('#play-btn')?.addEventListener('click', startTournament);
  document.querySelector('#boss-rush-btn')?.addEventListener('click', showBossPath);
  document.querySelector('#fighters-btn')?.addEventListener('click', showRoster);
  document.querySelector('#rewards-btn')?.addEventListener('click', showRewards);
  document.querySelector('#dojo-btn')?.addEventListener('click', showDojo);
  document.querySelector('#controls-btn')?.addEventListener('click', showControlsPanel);
  document.querySelector('#freeplay-btn')?.addEventListener('click', startFreePlay);
}

function showBossPath() {
  cleanupGame();
  freePlayMode = false;
  bossRushMode = false;

  const selected = findCharacter(save.selected);
  const selectedIdentity = getCharacterIdentity(selected);
  const challengers = getBossRushRoster(selected.id);
  const tournamentNodes = challengers.slice(0, Math.min(20, challengers.length));
  const guardIds = new Set(['kapau', 'chope', 'eyezor', 'zugu', 'krait', 'sleven']);
  const guards = challengers.filter((fighter) => guardIds.has(fighter.id));

  const routeNodes = tournamentNodes.map((fighter, index) => {
    const identity = getCharacterIdentity(fighter);
    const portrait = getCachedCharacterPortrait(fighter.id) ?? getCharacterSvgIcon(fighter);
    const state = index === 0 ? 'current' : 'locked';
    return `
      <article class="boss-path-node ${state}" data-boss-node="${fighter.id}" style="--node-color:#${fighter.color.toString(16).padStart(6, '0')};--node-accent:#${fighter.accent.toString(16).padStart(6, '0')}">
        <span class="boss-path-connector" aria-hidden="true"></span>
        <div class="boss-path-medallion">
          <img src="${portrait}" alt="" aria-hidden="true" />
          <i class="boss-path-lock" aria-hidden="true">${index === 0 ? '▶' : '◆'}</i>
        </div>
        <small>CHALLENGER ${index + 1}</small>
        <b>${identity.name}</b>
        <em>${identity.variant ?? fighter.element}</em>
      </article>`;
  }).join('');

  const guardNodes = guards.map((fighter) => {
    const identity = getCharacterIdentity(fighter);
    const portrait = getCachedCharacterPortrait(fighter.id) ?? getCharacterSvgIcon(fighter);
    return `
      <article class="boss-guard-node" data-guard-node="${fighter.id}" style="--node-color:#${fighter.color.toString(16).padStart(6, '0')}">
        <div><img src="${portrait}" alt="" aria-hidden="true" /></div>
        <span><b>${identity.name}</b><small>${fighter.element}</small></span>
      </article>`;
  }).join('');

  const allNodes = challengers.map((fighter, index) => {
    const identity = getCharacterIdentity(fighter);
    const reference = getCharacterReferenceImage(fighter);
    const suppliedLook = getUserCharacterPortrait(fighter.id);
    const showRemoteReference = suppliedLook ? null : reference;
    return `
      <span class="boss-path-mini ${index === 0 ? 'current' : ''}" data-gauntlet-order="${index + 1}" title="${identity.name} · ${identity.variant ?? fighter.element}" style="--node-color:#${fighter.color.toString(16).padStart(6, '0')}">
        <img src="${getCachedCharacterPortrait(fighter.id) ?? getCharacterSvgIcon(fighter)}" alt="" aria-hidden="true" />
        <i>${index + 1}</i>
      </span>`;
  }).join('');

  app.innerHTML = `
    <main class="boss-path-screen">
      <div class="boss-path-backdrop" aria-hidden="true"></div>
      <header class="boss-path-header">
        <button class="back-button" id="boss-path-back" aria-label="Back">‹</button>
        <div>
          <small>MASTER CHEN'S ISLAND</small>
          <h2>Elemental Master Gauntlet</h2>
          <p>Defeat every challenger in sequence. Tournament masters lead the route, then the full playable roster enters the arena.</p>
        </div>
        <div class="boss-path-player">
          <img src="${getCachedCharacterPortrait(selected.id) ?? getCharacterSvgIcon(selected)}" alt="" aria-hidden="true" />
          <span><small>YOUR FIGHTER</small><b>${selectedIdentity.name}</b></span>
        </div>
      </header>

      <section class="boss-path-board" aria-label="Gauntlet progression map">
        <div class="boss-path-tabs" aria-hidden="true"><b>BOSSES</b><span>TOURNAMENT ROUTE</span><em>${challengers.length} FIGHTS</em></div>
        <div class="boss-route-scroll">
          <div class="boss-route-track">${routeNodes}</div>
        </div>

        <div class="boss-guard-section">
          <div class="boss-path-tabs compact" aria-hidden="true"><b>ENEMIES</b><span>CHEN'S GUARDS</span></div>
          <div class="boss-guard-grid">${guardNodes}</div>
        </div>

        <div class="boss-all-section">
          <div class="boss-path-tabs compact"><b>ALL CHALLENGERS</b><span>FULL ROSTER ORDER · ${challengers.length}</span></div>
          <div class="boss-path-mini-grid">${allNodes}</div>
        </div>
      </section>

      <footer class="boss-path-footer">
        <div>
          <small>GAUNTLET RULE</small>
          <b>ONE FIGHTER · ${challengers.length} CHALLENGERS · NO WAVE BREAKS</b>
          <span>First opponent: ${getCharacterIdentity(challengers[0]).name}</span>
        </div>
        <button class="boss-path-play" id="boss-path-start" type="button"><i>▶</i><span><small>START</small><b>GAUNTLET</b></span></button>
      </footer>
    </main>`;

  document.querySelector('#boss-path-back')?.addEventListener('click', showHome);
  document.querySelector('#boss-path-start')?.addEventListener('click', startBossRush);

  const visibleFighters = Array.from(new Set([
    selected.id,
    ...tournamentNodes.map((fighter) => fighter.id),
    ...guards.map((fighter) => fighter.id)
  ])).map((id) => findCharacter(id));

  void renderCharacterPortraits(visibleFighters).then((cache) => {
    if (!document.querySelector('.boss-path-screen')) return;
    document.querySelectorAll<HTMLImageElement>('[data-boss-node] img, [data-guard-node] img, .boss-path-player img').forEach((image) => {
      const host = image.closest<HTMLElement>('[data-boss-node], [data-guard-node]');
      const id = host?.dataset.bossNode ?? host?.dataset.guardNode ?? selected.id;
      const portrait = cache.get(id);
      if (portrait) image.src = portrait;
    });
  }).catch(() => {
    // SVG badges remain visible when WebGL portrait rendering is unavailable.
  });
}

function showRoster() {
  cleanupGame();
  const cards = ROSTER.map((fighter) => {
    const unlocked = save.unlocked.includes(fighter.id);
    const selected = fighter.id === save.selected;
    const canBuy = save.bankStuds >= fighter.cost;
    const progress = xpProgress(fighter.id);
    const upgraded = upgradedCharacter(fighter);
    const upgradeCost = fighterUpgradeCost(fighter.id);
    const canUpgrade = progress.level < 5 && save.bankStuds >= upgradeCost;
    const identity = getCharacterIdentity(fighter);
    const reference = getCharacterReferenceImage(fighter);
    return `
      <article class="fighter-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-id="${fighter.id}" data-search="${characterSearchText(fighter)}">
        <button class="fighter-avatar preview-character-btn ${suppliedLook ? 'has-user-look' : showRemoteReference ? 'has-reference' : ''}" type="button" data-preview="${fighter.id}" aria-label="View ${identity.name} ${identity.variant ?? ''} 3D model" style="--fighter:#${fighter.color.toString(16).padStart(6, '0')};--accent:#${fighter.accent.toString(16).padStart(6, '0')}">
          ${getCachedCharacterPortrait(fighter.id)
            ? `<img class="fighter-avatar-render" src="${getCachedCharacterPortrait(fighter.id)}" alt="" aria-hidden="true" />`
            : `<img class="fighter-avatar-svg" src="${getCharacterSvgIcon(fighter)}" alt="" aria-hidden="true" />`}
          ${showRemoteReference ? `<img class="fighter-avatar-real" data-reference-image src="${showRemoteReference.imageUrl}" alt="" aria-hidden="true" referrerpolicy="no-referrer" loading="lazy" /><span class="fighter-reference-badge">LEGO REF</span>` : ''}
          ${suppliedLook ? '<span class="fighter-reference-badge user-look-badge">GAME LOOK</span>' : ''}
          <span class="fighter-avatar-fallback"></span><i class="fighter-avatar-body"></i><small>${suppliedLook ? 'LOOK' : reference ? 'REF' : '3D'}</small>
        </button>
        <div class="fighter-copy">
          <h3><span class="fighter-primary-name">${identity.name}</span> <small>LV ${progress.level}</small></h3>
          ${identity.variant ? `<span class="fighter-variant">${identity.variant}</span>` : ''}
          <p>${fighter.power ?? fighter.element} · ${fighter.style} · ${fighter.specialAttack ?? fighter.special.replace('-', ' ')}</p>
          <small class="fighter-ability-line">NORMAL ${fighter.normalAttack ?? 'Ninja Combo'} · SPIN ${fighter.spinjitzu ?? 'Spinjitzu'} · ULT ${fighter.ultimateSpinjitzu ?? 'Ultimate'} · PASSIVE ${fighter.passive ?? 'Battle Focus'}</small>
          ${fighter.sourceEra ? `<small class="fighter-source-line">${fighter.sourceEra}${fighter.sourceGroup ? ` · ${fighter.sourceGroup}` : ''}</small>` : ''}
          ${reference ? `<a class="fighter-reference-link" href="${reference.sourceUrl}" target="_blank" rel="noopener noreferrer" title="${reference.note}">OFFICIAL LEGO® REFERENCE ↗</a>` : ''}
          <div class="stat-row"><span>SPD ${upgraded.speed.toFixed(1)}</span><span>DMG ${upgraded.damage}</span><span>♥ ${upgraded.maxHealth}</span></div>
          ${unlocked ? `<div class="xp-line"><i style="width:${progress.percent}%"></i></div><em>${progress.level >= 5 ? 'MAX POTENTIAL' : `${progress.current}/${progress.target} XP`}</em><small class="upgrade-copy">${nextUpgradeCopy(fighter.id)}</small>` : ''}
        </div>
        ${unlocked
          ? `<div class="fighter-card-actions"><button class="mini-button select-btn" data-select="${fighter.id}">${selected ? 'SELECTED' : 'SELECT'}</button><button class="mini-button upgrade-btn" data-upgrade="${fighter.id}" ${progress.level >= 5 || !canUpgrade ? 'disabled' : ''}>${progress.level >= 5 ? 'MAX LEVEL' : `UPGRADE ◉ ${formatStuds(upgradeCost)}`}</button></div>`
          : `<button class="mini-button unlock-btn" data-unlock="${fighter.id}" ${canBuy ? '' : 'disabled'}>◉ ${formatStuds(fighter.cost)}</button>`}
      </article>`;
  }).join('');

  app.innerHTML = `
    <main class="panel-screen">
      <header class="top-bar legacy-selection-bar"><button class="back-button" id="back-btn">‹</button><div><small>MASTER CHEN'S TOURNAMENT</small><h2>Select a Ninja · ${ROSTER.length}</h2></div><strong>◉ ${formatStuds(save.bankStuds)}</strong></header>
      <section class="roster-toolbar">
        <label for="fighter-search">Find a fighter</label>
        <input id="fighter-search" type="search" autocomplete="off" placeholder="Search Zane, Kai, Ice, Spinjitzu..." />
      </section>
      <section class="character-showcase" aria-label="3D fighter viewer">
        <div class="character-preview-stage" id="character-preview-stage"></div>
        <div class="character-preview-copy">
          <small>LIVE 3D MODEL</small>
          <h3 id="preview-character-name"></h3>
          <span id="preview-character-variant" class="fighter-variant"></span>
          <p id="preview-character-meta"></p>
          <p class="preview-help">Select the 3D badge on any fighter card to inspect that model. The same character model is used in the arena and Dojo.</p>
        </div>
      </section>
      <section class="roster-grid">${cards}</section>
    </main>`;

  const previewHost = document.querySelector<HTMLElement>('#character-preview-stage')!;
  const previewName = document.querySelector<HTMLElement>('#preview-character-name')!;
  const previewVariant = document.querySelector<HTMLElement>('#preview-character-variant')!;
  const previewMeta = document.querySelector<HTMLElement>('#preview-character-meta')!;

  const setPreview = (fighter: CharacterDef) => {
    const identity = getCharacterIdentity(fighter);
    previewName.textContent = identity.name;
    previewVariant.textContent = identity.variant ?? 'BASE';
    previewMeta.textContent = `${fighter.power ?? fighter.element} · ${fighter.style.toUpperCase()} · ${fighter.specialAttack ?? fighter.special.replace('-', ' ').toUpperCase()} · ULT: ${fighter.ultimateSpinjitzu ?? 'Ultimate'} · PASSIVE: ${fighter.passive ?? 'Battle Focus'}`;
    if (activeCharacterPreview) activeCharacterPreview.setCharacter(fighter);
    else activeCharacterPreview = new CharacterPreview(previewHost, fighter);

    document.querySelectorAll<HTMLElement>('[data-preview]').forEach((button) => {
      button.classList.toggle('active-preview', button.dataset.preview === fighter.id);
    });
  };

  setPreview(upgradedCharacter(findCharacter(save.selected)));

  // Hundreds of fighters are now playable. Render portraits lazily as cards enter
  // the viewport so opening the roster never tries to create every WebGL portrait at once.
  const portraitObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const button = entry.target as HTMLButtonElement;
      const fighterId = button.dataset.preview;
      if (!fighterId) continue;
      observer.unobserve(button);
      if (button.classList.contains('has-reference')) continue;
      const fighter = findCharacter(fighterId);
      void renderCharacterPortraits([fighter]).then((cache) => {
        if (!button.isConnected) return;
        const source = cache.get(fighterId);
        if (!source) return;
        let image = button.querySelector<HTMLImageElement>('.fighter-avatar-render');
        if (!image) {
          image = document.createElement('img');
          image.className = 'fighter-avatar-render';
          image.alt = '';
          image.setAttribute('aria-hidden', 'true');
          button.prepend(image);
        }
        image.src = source;
        button.classList.add('has-render');
      }).catch(() => {
        // Generated SVG stays visible if WebGL portrait rendering is unavailable.
      });
    }
  }, { rootMargin: '240px 0px' });

  document.querySelectorAll<HTMLButtonElement>('.fighter-avatar[data-preview]').forEach((button) => {
    portraitObserver.observe(button);
  });

  document.querySelectorAll<HTMLImageElement>('[data-reference-image]').forEach((image) => {
    image.addEventListener('error', () => {
      image.closest('.fighter-avatar')?.classList.remove('has-reference');
      image.remove();
    }, { once: true });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const fighter = findCharacter(button.dataset.preview!);
      setPreview(upgradedCharacter(fighter));
      document.querySelector('.character-showcase')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.querySelector('#back-btn')?.addEventListener('click', showHome);
  document.querySelector<HTMLInputElement>('#fighter-search')?.addEventListener('input', (event) => {
    const query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>('.fighter-card').forEach((card) => {
      const matches = !query || (card.dataset.search ?? '').includes(query);
      card.hidden = !matches;
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
    button.addEventListener('click', () => {
      save.selected = button.dataset.select!;
      persist();
      showRoster();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.upgrade!;
      const level = fighterLevel(id);
      if (level >= 5) return;
      const cost = fighterUpgradeCost(id);
      if (save.bankStuds < cost) return;
      save.bankStuds -= cost;
      save.fighterXp[id] = Math.max(save.fighterXp[id] ?? 0, LEVEL_THRESHOLDS[level]);
      persist();
      showRoster();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-unlock]').forEach((button) => {
    button.addEventListener('click', () => {
      const fighter = findCharacter(button.dataset.unlock!);
      if (save.unlocked.includes(fighter.id) || save.bankStuds < fighter.cost) return;
      save.bankStuds -= fighter.cost;
      save.unlocked.push(fighter.id);
      save.selected = fighter.id;
      persist();
      showRoster();
    });
  });
}

function showRewards() {
  cleanupGame();
  const tasks = [
    { id: 'run', title: 'Enter the arena', text: 'Complete 1 tournament run today.', done: save.daily.runs >= 1, progress: `${Math.min(save.daily.runs, 1)}/1` },
    { id: 'wave', title: 'Survivor', text: 'Reach wave 5 in a run today.', done: save.daily.bestWave >= 5, progress: `${Math.min(save.daily.bestWave, 5)}/5` },
    { id: 'studs', title: 'Stud hunter', text: 'Bank 3,000 studs from runs today.', done: save.daily.studs >= 3000, progress: `${formatStuds(Math.min(save.daily.studs, 3000))}/3,000` }
  ];

  app.innerHTML = `
    <main class="panel-screen rewards-screen">
      <header class="top-bar"><button class="back-button" id="back-btn">‹</button><div><small>MASTER CHEN'S PRIZE TABLE</small><h2>Daily Draw</h2></div><strong>◉ ${formatStuds(save.bankStuds)}</strong></header>
      <section class="rewards-layout">
        <article class="draw-card legacy-draw-card">
          <div class="draw-wheel-shell"><i></i><div class="draw-orb">${save.daily.draws}</div><b>PRIZE</b></div>
          <h3>${save.daily.draws > 0 ? 'Draw available' : 'No draws left'}</h3>
          <p>You receive one free draw each day. Complete all three daily challenges to earn up to three additional draws.</p>
          <button class="gold-button primary" id="draw-btn" ${save.daily.draws > 0 ? '' : 'disabled'}>DRAW A PRIZE</button>
          <div id="draw-result" class="draw-result"></div>
        </article>
        <section class="challenge-list">
          ${tasks.map((task) => {
            const claimed = save.daily.claimed.includes(task.id);
            return `<article class="challenge-card ${task.done ? 'done' : ''}">
              <div><small>DAILY CHALLENGE</small><h3>${task.title}</h3><p>${task.text}</p><b>${task.progress}</b></div>
              <button class="mini-button claim-btn" data-claim="${task.id}" ${task.done && !claimed ? '' : 'disabled'}>${claimed ? 'CLAIMED' : '+1 DRAW'}</button>
            </article>`;
          }).join('')}
        </section>
      </section>
    </main>`;

  document.querySelector('#back-btn')?.addEventListener('click', showHome);
  document.querySelector('#draw-btn')?.addEventListener('click', () => {
    if (save.daily.draws <= 0) return;
    save.daily.draws -= 1;
    const prizes = [500, 750, 1000, 1250, 2000, 3000, 5000];
    const roll = Math.random();
    const index = roll < .3 ? 0 : roll < .5 ? 1 : roll < .68 ? 2 : roll < .81 ? 3 : roll < .91 ? 4 : roll < .98 ? 5 : 6;
    const prize = prizes[index];
    save.bankStuds += prize;
    persist();
    const result = document.querySelector<HTMLElement>('#draw-result');
    if (result) result.innerHTML = `<strong>◉ ${formatStuds(prize)}</strong><span>STUD PRIZE</span>`;
    const wheel = document.querySelector<HTMLElement>('.draw-wheel-shell');
    wheel?.classList.remove('spinning');
    if (wheel) { void wheel.offsetWidth; wheel.classList.add('spinning'); }
    const button = document.querySelector<HTMLButtonElement>('#draw-btn');
    if (button && save.daily.draws <= 0) button.disabled = true;
    const orb = document.querySelector<HTMLElement>('.draw-orb');
    if (orb) orb.textContent = String(save.daily.draws);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.claim!;
      const task = tasks.find((entry) => entry.id === id);
      if (!task?.done || save.daily.claimed.includes(id)) return;
      save.daily.claimed.push(id);
      save.daily.draws += 1;
      persist();
      showRewards();
    });
  });
}

function showDojo() {
  cleanupGame();
  freePlayMode = false;
  const baseFighter = findCharacter(save.selected);
  const keys = getKeyBindings();
  const fighter = upgradedCharacter(baseFighter);
  const identity = getCharacterIdentity(baseFighter);
  const elementTheme = getElementCombatTheme(baseFighter.element);
  const elementColor = `#${elementTheme.color.toString(16).padStart(6, '0')}`;
  const elementAccent = `#${elementTheme.accent.toString(16).padStart(6, '0')}`;
  const specialLabel = baseFighter.special === 'spinjitzu' ? 'SPINJITZU' : baseFighter.special.replace('-', ' ').toUpperCase();
  app.innerHTML = `
    <main class="game-screen dojo-game-screen">
      <div id="dojo-host"></div>
      <button class="pause-button dojo-exit" id="dojo-exit" aria-label="Exit dojo">‹</button>
      <section class="dojo-coach" id="dojo-coach">
        <small>SENSEI'S DOJO · STEP <span id="dojo-step-number">1</span>/7</small>
        <h2 id="dojo-step-title">Movement</h2>
        <p id="dojo-step-copy">Use the joystick or WASD / arrow keys.</p>
        <div class="dojo-progress"><i id="dojo-progress"></i></div>
      </section>
      <div class="dojo-fighter-label"><b>${identity.name}</b><span>${identity.variant ? `${identity.variant} · ` : ''}LV ${fighterLevel(baseFighter.id)} · ${baseFighter.special.replace('-', ' ')}</span></div>
      <div class="special-wrap"><button id="dojo-special" class="special-button" aria-label="${specialLabel}" title="${specialLabel}"><span class="legacy-icon">${legacyActionIcon('spin')}</span></button><small class="special-name">${specialLabel}</small><div class="meter"><i id="dojo-meter"></i></div></div>
      <div class="joystick" id="dojo-joystick"><div class="joystick-ring"><span id="dojo-stick"></span></div></div>
      <div class="action-cluster dojo-actions">
        <button class="action-button jump" data-dojo-action="jump" aria-label="Jump"><span class="legacy-icon">${legacyActionIcon('jump')}</span></button>
        <button class="action-button block" id="dojo-block" aria-label="Block"><span class="legacy-icon">${legacyActionIcon('block')}</span></button>
        <button class="action-button grab" data-dojo-action="grab" aria-label="Grab"><span class="legacy-icon">${legacyActionIcon('grab')}</span></button>
        <button class="action-button attack punch" data-dojo-action="punch" aria-label="Punch"><span class="legacy-icon">${legacyActionIcon('punch')}</span></button>
        <button class="action-button kick elemental-kick" data-dojo-action="kick" aria-label="${baseFighter.power ?? baseFighter.element} elemental kick" title="${baseFighter.power ?? baseFighter.element} power kick" style="--element-color:${elementColor};--element-accent:${elementAccent}"><span class="legacy-icon">${legacyActionIcon('kick')}</span><span class="element-badge" aria-hidden="true">${elementTheme.icon}</span><small>${baseFighter.element}</small></button>
      </div>
      <div class="keyboard-hint-bar">MOVE ${formatKeyLabel(keys.moveUp)}/${formatKeyLabel(keys.moveLeft)}/${formatKeyLabel(keys.moveDown)}/${formatKeyLabel(keys.moveRight)} · BOX ${formatKeyLabel(keys.punch)} · KICK ${formatKeyLabel(keys.kick)} · GRAB ${formatKeyLabel(keys.grab)} · SPINJITZU ${formatKeyLabel(keys.special)}</div>
      <div class="dodge-hint">SWIPE DOJO TO DODGE · ${formatKeyLabel(keys.dodge)} ON DESKTOP</div>
      <div id="dojo-complete" class="game-over hidden"></div>
    </main>`;

  const host = document.querySelector<HTMLElement>('#dojo-host')!;
  const tutorial = new DojoGame(host, fighter, {
    onStep: updateDojoStep,
    onMeter: (value) => {
      const meter = document.querySelector<HTMLElement>('#dojo-meter');
      if (meter) meter.style.width = `${value}%`;
      document.querySelector('#dojo-special')?.classList.toggle('ready', value >= 100);
    },
    onComplete: () => {
      const overlay = document.querySelector<HTMLElement>('#dojo-complete');
      if (!overlay) return;
      overlay.classList.remove('hidden');
      overlay.innerHTML = `<section><small>SENSEI'S DOJO</small><h2>Training Complete</h2><p>You are ready for the Tournament of Elements.</p><div class="menu-actions"><button class="gold-button primary" id="dojo-enter-tournament">ENTER TOURNAMENT</button><button class="gold-button" id="dojo-menu">MAIN MENU</button></div></section>`;
      document.querySelector('#dojo-enter-tournament')?.addEventListener('click', startTournament);
      document.querySelector('#dojo-menu')?.addEventListener('click', showHome);
    }
  });
  activeDojo = tutorial;

  wireJoystick(tutorial, '#dojo-joystick', '#dojo-stick');
  wireArenaSwipe(tutorial, host);
  document.querySelectorAll<HTMLButtonElement>('[data-dojo-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      tutorial.action(button.dataset.dojoAction as DojoAction);
    });
  });
  document.querySelector('#dojo-special')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    tutorial.action('special');
  });
  const block = document.querySelector<HTMLButtonElement>('#dojo-block')!;
  const releaseBlock = () => { block.classList.remove('held'); tutorial.setBlock(false); };
  block.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    block.setPointerCapture(event.pointerId);
    block.classList.add('held');
    tutorial.setBlock(true);
  });
  block.addEventListener('pointerup', releaseBlock);
  block.addEventListener('pointercancel', releaseBlock);
  block.addEventListener('lostpointercapture', releaseBlock);
  document.querySelector('#dojo-exit')?.addEventListener('click', showHome);
}

function updateDojoStep(step: DojoStep, title: string, copy: string, progress: number) {
  const indexMap: Record<DojoStep, number> = { move: 1, attack: 2, jump: 3, block: 4, grab: 5, dodge: 6, special: 7, complete: 7 };
  const number = document.querySelector('#dojo-step-number');
  const titleEl = document.querySelector('#dojo-step-title');
  const copyEl = document.querySelector('#dojo-step-copy');
  const bar = document.querySelector<HTMLElement>('#dojo-progress');
  if (number) number.textContent = String(indexMap[step]);
  if (titleEl) titleEl.textContent = title;
  if (copyEl) copyEl.textContent = copy;
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
}

function startTournament() {
  freePlayMode = false;
  bossRushMode = false;
  startGame();
}

function startBossRush() {
  freePlayMode = false;
  bossRushMode = true;
  startGame();
}

function startFreePlay() {
  freePlayMode = true;
  bossRushMode = false;
  startGame();
}

function startGame() {
  cleanupGame();
  continueUsedThisRun = false;
  lastHudWave = 0;
  lastHudEnemies = 0;
  const baseFighter = findCharacter(save.selected);
  const keys = getKeyBindings();
  const fighter = upgradedCharacter(baseFighter);
  if (freePlayMode) fighter.special = 'spinjitzu';
  const identity = getCharacterIdentity(baseFighter);
  const elementTheme = getElementCombatTheme(baseFighter.element);
  const elementColor = `#${elementTheme.color.toString(16).padStart(6, '0')}`;
  const elementAccent = `#${elementTheme.accent.toString(16).padStart(6, '0')}`;
  const specialLabel = freePlayMode
    ? 'SPINJITZU ∞'
    : (baseFighter.specialAttack ?? (baseFighter.special === 'spinjitzu' ? baseFighter.spinjitzu ?? 'Spinjitzu' : baseFighter.special.replace('-', ' '))).toUpperCase();
  app.innerHTML = `
    <main class="game-screen ${freePlayMode ? 'freeplay-mode' : ''} ${bossRushMode ? 'boss-rush-mode' : ''}">
      <div id="game-host"></div>
      <div class="hud hud-left">
        <div class="portrait-ring" style="--fighter:#${baseFighter.color.toString(16).padStart(6, '0')};--accent:#${baseFighter.accent.toString(16).padStart(6, '0')}">
          <img id="player-face-render" src="${getCachedCharacterPortrait(baseFighter.id) ?? getCharacterSvgIcon(baseFighter)}" alt="" aria-hidden="true" />
          <span class="portrait-element" aria-hidden="true">${elementTheme.icon}</span>
        </div>
        <div class="player-hud-copy">
          <b>${identity.name}</b><small>${identity.variant ?? baseFighter.power ?? baseFighter.element}</small>
          <div id="hearts" class="hearts"></div>
          <div id="studs" class="studs"><span class="stud-icon" aria-hidden="true"></span><span class="stud-copy"><b id="stud-count">0</b><small>RUN STUDS · BANK ${formatStuds(save.bankStuds)} · LV ${fighterLevel(baseFighter.id)}</small></span></div>
        </div>
      </div>
      <div class="hud hud-center legacy-score-plate">
        <i class="production-hud-mark" aria-hidden="true"></i>
        <small>${bossRushMode ? 'ELEMENTAL MASTER GAUNTLET' : 'TOURNAMENT'}</small><b id="wave-label">${bossRushMode ? 'CHALLENGER 0' : 'WAVE 0'}</b><span id="enemy-label">GET READY</span>
        <div id="boss-health" class="boss-health hidden"><span><i id="boss-health-fill"></i></span><em id="boss-health-copy"></em></div>
      </div>
      <div class="hud hud-right">
        <div id="boss-portrait" class="boss-portrait hidden"><div class="boss-face"><img id="boss-face-render" alt="" aria-hidden="true" /><i></i></div><span id="boss-portrait-name">ELEMENTAL MASTER</span></div>
        <b id="multiplier">1×</b><small id="combo">0 HIT COMBO</small>
      </div>
      <button class="pause-button" id="exit-btn" aria-label="Exit">Ⅱ</button>
      <button class="camera-view-button" id="camera-view-btn" type="button" aria-label="Switch to overhead camera" aria-pressed="false"><b>VIEW</b><span>CLASSIC</span></button>
      <div id="stage-banner" class="stage-banner" aria-live="polite"><small></small><b></b></div>
      <div id="message" class="arena-message"></div>
      <div class="special-wrap"><button id="special-btn" class="special-button" aria-label="${specialLabel}" title="${specialLabel}"><span class="legacy-icon">${legacyActionIcon('spin')}</span></button><small class="special-name">${specialLabel}</small><div class="meter"><i id="special-meter"></i></div></div>
      ${freePlayMode ? `<button id="ultimate-btn" class="ultimate-spinjitzu-button" aria-label="Tornado of Creation ultimate"><b>∞ TEAM ULTIMATE</b><span>TORNADO OF CREATION · ${formatKeyLabel(keys.ultimate)}</span></button>` : ''}
      <div class="joystick" id="joystick"><div class="joystick-ring"><span id="stick"></span></div></div>
      <div class="action-cluster">
        <button class="action-button jump" data-action="jump" aria-label="Jump"><span class="legacy-icon">${legacyActionIcon('jump')}</span></button>
        <button class="action-button block" id="block-btn" aria-label="Block"><span class="legacy-icon">${legacyActionIcon('block')}</span></button>
        <button class="action-button grab" data-action="grab" aria-label="Grab"><span class="legacy-icon">${legacyActionIcon('grab')}</span></button>
        <button class="action-button attack punch" data-action="punch" aria-label="Punch"><span class="legacy-icon">${legacyActionIcon('punch')}</span></button>
        <button class="action-button kick elemental-kick" data-action="kick" aria-label="${baseFighter.power ?? baseFighter.element} elemental kick" title="${baseFighter.power ?? baseFighter.element} power kick" style="--element-color:${elementColor};--element-accent:${elementAccent}"><span class="legacy-icon">${legacyActionIcon('kick')}</span><span class="element-badge" aria-hidden="true">${elementTheme.icon}</span><small>${baseFighter.element}</small></button>
      </div>
      <div class="keyboard-hint-bar">MOVE ${formatKeyLabel(keys.moveUp)}/${formatKeyLabel(keys.moveLeft)}/${formatKeyLabel(keys.moveDown)}/${formatKeyLabel(keys.moveRight)} · BOX ${formatKeyLabel(keys.punch)} · KICK ${formatKeyLabel(keys.kick)} · GRAB ${formatKeyLabel(keys.grab)} · BLOCK ${formatKeyLabel(keys.block)} · SPECIAL ${formatKeyLabel(keys.special)} · VIEW V${freePlayMode ? ` · CREATION ${formatKeyLabel(keys.ultimate)}` : ''}</div>
      <div class="dodge-hint">SWIPE ARENA TO DODGE · ${formatKeyLabel(keys.dodge)}</div>
      <div id="game-over" class="game-over hidden"></div>
    </main>`;

  const host = document.querySelector<HTMLElement>('#game-host')!;
  const syncCameraButton = (mode: 'classic' | 'overhead') => {
    const cameraButton = document.querySelector<HTMLButtonElement>('#camera-view-btn');
    if (!cameraButton) return;
    cameraButton.setAttribute('aria-pressed', String(mode === 'overhead'));
    cameraButton.setAttribute('aria-label', mode === 'overhead' ? 'Switch to classic camera' : 'Switch to overhead camera');
    const label = cameraButton.querySelector('span');
    if (label) label.textContent = mode === 'overhead' ? 'OVERHEAD' : 'CLASSIC';
    cameraButton.classList.toggle('overhead', mode === 'overhead');
  };

  const game = new TournamentGame(host, fighter, {
    onHud: updateHud,
    onMessage: showArenaMessage,
    onGameOver: (runStuds, wave) => showDefeatScreen(game, runStuds, wave, baseFighter.id),
    onVictory: (runStuds, fights) => finalizeRun(runStuds, fights, baseFighter.id, true),
    onCameraModeChange: syncCameraButton
  }, { bossRush: bossRushMode });
  activeGame = game;

  const playerFace = document.querySelector<HTMLImageElement>('#player-face-render');
  if (playerFace && !getCachedCharacterPortrait(baseFighter.id)) {
    void renderCharacterPortraits([baseFighter]).then((cache) => {
      const portrait = cache.get(baseFighter.id);
      if (portrait && playerFace.isConnected) {
        playerFace.src = portrait;
        playerFace.classList.add('ready');
      }
    }).catch(() => {
      // Generated SVG remains the clean-room fallback.
    });
  } else {
    playerFace?.classList.add('ready');
  }

  game.setUnlimitedSpecial(freePlayMode);
  game.setCreationUltimateEnabled(freePlayMode);
  showStageBanner(
    freePlayMode ? 'FREE PLAY MODE' : bossRushMode ? 'MASTER CHEN PRESENTS' : 'MASTER CHEN PRESENTS',
    freePlayMode
      ? 'UNLIMITED SPINJITZU · TORNADO OF CREATION'
      : bossRushMode
        ? 'ELEMENTAL MASTER GAUNTLET'
        : 'TOURNAMENT OF ELEMENTS'
  );

  wireJoystick(game);
  wireArenaSwipe(game, host);
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      game.action(button.dataset.action as 'punch' | 'kick' | 'jump' | 'grab');
    });
  });
  const special = document.querySelector<HTMLButtonElement>('#special-btn')!;
  special.addEventListener('pointerdown', (event) => { event.preventDefault(); game.action('special'); });
  document.querySelector<HTMLButtonElement>('#ultimate-btn')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    game.action('ultimate');
  });

  document.querySelector<HTMLButtonElement>('#camera-view-btn')?.addEventListener('click', () => {
    game.toggleCameraView();
  });

  const block = document.querySelector<HTMLButtonElement>('#block-btn')!;
  const releaseBlock = () => { block.classList.remove('held'); game.setBlock(false); };
  block.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    block.setPointerCapture(event.pointerId);
    block.classList.add('held');
    game.setBlock(true);
  });
  block.addEventListener('pointerup', releaseBlock);
  block.addEventListener('pointercancel', releaseBlock);
  block.addEventListener('lostpointercapture', releaseBlock);

  document.querySelector('#exit-btn')?.addEventListener('click', () => {
    if (confirm('Leave this tournament run?')) showHome();
  });
}

function updateHud(state: HudState) {
  const hearts = document.querySelector('#hearts');
  const studCount = document.querySelector('#stud-count');
  const multiplier = document.querySelector('#multiplier');
  const combo = document.querySelector('#combo');
  const wave = document.querySelector('#wave-label');
  const enemies = document.querySelector('#enemy-label');
  const bossHealth = document.querySelector<HTMLElement>('#boss-health');
  const bossHealthFill = document.querySelector<HTMLElement>('#boss-health-fill');
  const bossHealthCopy = document.querySelector<HTMLElement>('#boss-health-copy');
  const bossPortrait = document.querySelector<HTMLElement>('#boss-portrait');
  const bossPortraitName = document.querySelector<HTMLElement>('#boss-portrait-name');
  const bossFaceRender = document.querySelector<HTMLImageElement>('#boss-face-render');
  const meter = document.querySelector<HTMLElement>('#special-meter');
  if (hearts) {
    hearts.innerHTML = Array.from({ length: state.maxHealth }, (_, index) => {
      const remaining = state.health - index;
      const kind = remaining >= 1 ? 'full' : remaining >= 0.5 ? 'half' : 'empty';
      return `<span class="heart ${kind}" aria-hidden="true">♥</span>`;
    }).join('');
    hearts.setAttribute('aria-label', `${state.health} of ${state.maxHealth} hearts`);
  }
  if (studCount) studCount.textContent = formatStuds(state.studs);
  if (multiplier) multiplier.textContent = `${state.multiplier}×`;

  const screen = document.querySelector<HTMLElement>('.game-screen');
  const healthRatio = state.maxHealth > 0 ? state.health / state.maxHealth : 0;
  screen?.classList.toggle('low-health', healthRatio > 0 && healthRatio <= 0.5);
  screen?.classList.toggle('critical-health', healthRatio > 0 && healthRatio <= 0.25);
  if (combo) combo.textContent = `${state.combo} HIT COMBO`;
  if (wave) wave.textContent = state.bossName
    ? bossRushMode ? `CHALLENGER ${state.wave} · ${state.bossName}` : `BOSS · ${state.bossName}`
    : `WAVE ${state.wave}`;
  if (enemies) enemies.textContent = bossRushMode && state.bossName ? 'ELEMENTAL MASTER' : `${state.enemies} ENEMIES`;
  if (bossHealth && bossHealthFill && bossHealthCopy) {
    const visible = Boolean(state.bossName && state.bossMaxHealth);
    bossHealth.classList.toggle('hidden', !visible);
    bossPortrait?.classList.toggle('hidden', !visible);
    if (visible) {
      const ratio = Math.max(0, Math.min(1, (state.bossHealth ?? 0) / (state.bossMaxHealth ?? 1)));
      bossHealthFill.style.width = `${Math.round(ratio * 100)}%`;
      bossHealthCopy.textContent = `${state.bossName} · ${Math.ceil(state.bossHealth ?? 0)}/${Math.ceil(state.bossMaxHealth ?? 0)}`;
      if (bossPortrait) {
        const bossColor = state.bossColor ?? 0x7a261f;
        const bossAccent = state.bossAccent ?? 0xd7a841;
        bossPortrait.style.setProperty('--boss-color', `#${bossColor.toString(16).padStart(6, '0')}`);
        bossPortrait.style.setProperty('--boss-accent', `#${bossAccent.toString(16).padStart(6, '0')}`);
      }
      if (bossPortraitName) bossPortraitName.textContent = state.bossElement
        ? `${state.bossName} · ${state.bossElement}`
        : state.bossName ?? 'ELEMENTAL MASTER';

      if (bossFaceRender && state.bossId) {
        const cachedPortrait = getCachedCharacterPortrait(state.bossId);
        if (cachedPortrait) {
          bossFaceRender.src = cachedPortrait;
          bossFaceRender.classList.add('ready');
          delete bossFaceRender.dataset.loadingBoss;
        } else if (bossFaceRender.dataset.loadingBoss !== state.bossId) {
          bossFaceRender.dataset.loadingBoss = state.bossId;
          const bossCharacter = findCharacter(state.bossId);
          void renderCharacterPortraits([bossCharacter]).then((cache) => {
            const currentBossId = bossFaceRender.dataset.loadingBoss;
            if (currentBossId !== state.bossId) return;
            const portrait = cache.get(state.bossId!);
            if (!portrait) return;
            bossFaceRender.src = portrait;
            bossFaceRender.classList.add('ready');
            delete bossFaceRender.dataset.loadingBoss;
          }).catch(() => {
            delete bossFaceRender.dataset.loadingBoss;
          });
        }
      }
    }
  }
  if (meter) meter.style.width = `${Math.round(state.special)}%`;
  document.querySelector('#special-btn')?.classList.toggle('ready', state.special >= 100);

  if (state.wave > 0 && state.wave !== lastHudWave) {
    showStageBanner(
      state.bossName ? bossRushMode ? `CHALLENGER ${state.wave}` : 'ELEMENTAL MASTER' : 'TOURNAMENT STAGE',
      state.bossName ? state.bossName : `WAVE ${state.wave}`
    );
    lastHudWave = state.wave;
  } else if (lastHudEnemies > 0 && state.enemies === 0 && state.wave > 0) {
    showStageBanner('STAGE COMPLETE', `WAVE ${state.wave} CLEARED`);
  }
  lastHudEnemies = state.enemies;
}

function showStageBanner(kicker: string, title: string) {
  const banner = document.querySelector<HTMLElement>('#stage-banner');
  if (!banner) return;
  const small = banner.querySelector('small');
  const heading = banner.querySelector('b');
  if (small) small.textContent = kicker;
  if (heading) heading.textContent = title;
  banner.classList.add('show');
  window.clearTimeout(stageBannerTimer);
  stageBannerTimer = window.setTimeout(() => banner.classList.remove('show'), 1350);
}

let messageTimer = 0;
function showArenaMessage(text: string) {
  const el = document.querySelector<HTMLElement>('#message');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => el.classList.remove('show'), 1900);
}

function showDefeatScreen(game: TournamentGame, runStuds: number, wave: number, fighterId: string) {
  const continueCost = 2000;
  const overlay = document.querySelector<HTMLElement>('#game-over');
  if (!overlay) return;

  if (!continueUsedThisRun && save.bankStuds >= continueCost) {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <section>
        <small>CURRENT SCORE · ${formatStuds(runStuds)}</small>
        <h2>Continue?</h2>
        <p class="legacy-continue-copy">Continuing will cost <b>2,000 Studs</b>.<br/>Do you want to continue?</p>
        <p>Bank balance: ◉ ${formatStuds(save.bankStuds)}</p>
        <div class="continue-actions">
          <button class="legacy-choice decline" id="finish-run-btn" aria-label="End run">✕</button>
          <button class="legacy-choice accept" id="continue-btn" aria-label="Continue for 2,000 studs">✓</button>
        </div>
      </section>`;

    document.querySelector('#continue-btn')?.addEventListener('click', () => {
      if (continueUsedThisRun || save.bankStuds < continueCost) return;
      save.bankStuds -= continueCost;
      continueUsedThisRun = true;
      persist();
      if (game.continueRun()) {
        overlay.classList.add('hidden');
        overlay.replaceChildren();
      }
    });

    document.querySelector('#finish-run-btn')?.addEventListener('click', () => finalizeRun(runStuds, wave, fighterId));
    return;
  }

  finalizeRun(runStuds, wave, fighterId);
}

function finalizeRun(runStuds: number, wave: number, fighterId: string, victory = false) {
  const beforeLevel = fighterLevel(fighterId);
  const previousBestRun = save.bestRun;
  const previousBestWave = save.bestWave;
  const roundedRun = Math.floor(runStuds);
  const newStudRecord = roundedRun > previousBestRun;
  const newWaveRecord = wave > previousBestWave;
  const xpEarned = Math.floor(250 + wave * 120 + Math.min(2000, runStuds * 0.03));
  save.bankStuds += roundedRun;
  save.bestWave = Math.max(save.bestWave, wave);
  save.bestRun = Math.max(save.bestRun, roundedRun);
  save.totalRuns += 1;
  save.fighterXp[fighterId] = (save.fighterXp[fighterId] ?? 0) + xpEarned;
  save.daily.runs += 1;
  save.daily.studs += Math.floor(runStuds);
  save.daily.bestWave = Math.max(save.daily.bestWave, wave);
  persist();
  const afterLevel = fighterLevel(fighterId);

  const overlay = document.querySelector<HTMLElement>('#game-over');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <section class="legacy-result-card">
      <small>${victory ? 'GAUNTLET COMPLETE!' : newStudRecord || newWaveRecord ? 'NEW RECORD!' : 'CURRENT SCORE'}</small>
      <h2>${victory ? 'ALL CHALLENGERS DEFEATED' : formatStuds(runStuds)}</h2>
      <div class="result-stud-line"><span class="stud-icon"></span><b>STUDS</b></div>
      <div class="result-score-grid">
        <span><small>${victory ? 'FIGHTS' : 'WAVE'}</small><b>${wave}</b>${newWaveRecord ? '<em>NEW</em>' : ''}</span>
        <span><small>BEST SCORE</small><b>${formatStuds(save.bestRun)}</b>${newStudRecord ? '<em>NEW</em>' : ''}</span>
      </div>
      <p class="xp-award">+${formatStuds(xpEarned)} FIGHTER XP · LEVEL ${afterLevel}${afterLevel > beforeLevel ? ' · TRUE POTENTIAL RISING!' : ''}</p>
      <div class="menu-actions"><button class="gold-button primary" id="retry-btn">RETRY</button><button class="gold-button" id="rewards-btn">DAILY REWARDS</button><button class="gold-button" id="menu-btn">MAIN MENU</button></div>
    </section>`;
  document.querySelector('#retry-btn')?.addEventListener('click', bossRushMode ? startBossRush : freePlayMode ? startFreePlay : startTournament);
  document.querySelector('#rewards-btn')?.addEventListener('click', showRewards);
  document.querySelector('#menu-btn')?.addEventListener('click', showHome);
}

function wireJoystick(game: MoveController, zoneSelector = '#joystick', stickSelector = '#stick') {
  const zone = document.querySelector<HTMLElement>(zoneSelector)!;
  const stick = document.querySelector<HTMLElement>(stickSelector)!;
  let pointerId: number | null = null;
  const radius = 42;

  const move = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    const rect = zone.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) {
      dx = dx / length * radius;
      dy = dy / length * radius;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    game.setMove(dx / radius, dy / radius);
  };

  zone.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pointerId = event.pointerId;
    zone.setPointerCapture(event.pointerId);
    move(event);
  });
  zone.addEventListener('pointermove', move);
  const release = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    stick.style.transform = 'translate(0, 0)';
    game.setMove(0, 0);
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
  zone.addEventListener('lostpointercapture', release);
}

function wireArenaSwipe(game: DodgeController, host: HTMLElement) {
  let start: { id: number; x: number; y: number; time: number } | null = null;
  host.addEventListener('pointerdown', (event) => {
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
  });
  host.addEventListener('pointerup', (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const duration = performance.now() - start.time;
    start = null;
    if (Math.hypot(dx, dy) >= 44 && duration <= 480) game.dodge(dx, dy);
  });
  host.addEventListener('pointercancel', () => { start = null; });
}

window.addEventListener('ninja-save-updated', () => {
  refreshSaveFromStorage();
  if (document.querySelector('main.menu-screen')) showHome();
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === SAVE_CACHE_KEY) refreshSaveFromStorage();
});
// Every user-visible save mutation is persisted at the mutation site. Do not
// blindly write the in-memory snapshot again during pagehide/visibilitychange:
// a newer save may have been written by another tab, an integration, or the
// recovery/loadout layer immediately before navigation or reload.
persist();
showHome();
