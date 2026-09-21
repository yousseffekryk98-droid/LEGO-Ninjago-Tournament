import './styles.css';
import { TournamentGame, type HudState } from '../features/combat';
import { DojoGame, type DojoAction, type DojoStep } from '../features/dojo/DojoGame';
import {
  ROSTER,
  CharacterPreview,
  characterSearchText,
  findCharacter,
  getCharacterIdentity,
  type CharacterDef
} from '../features/characters';

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
const LEVEL_THRESHOLDS = [0, 800, 2200, 4500, 8000];

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
  unlocked: ROSTER.filter((c) => c.unlockedByDefault).map((c) => c.id),
  selected: ROSTER[0].id,
  bestWave: 0,
  bestRun: 0,
  totalRuns: 0,
  fighterXp: {},
  daily: freshDaily()
});

function loadSave(): SaveData {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SaveData> | null;
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
      unlocked: Array.from(new Set([...(saved.unlocked ?? []), ...base.unlocked])),
      selected: saved.selected && ROSTER.some((c) => c.id === saved.selected) ? saved.selected : base.selected,
      bestWave: Math.max(0, saved.bestWave ?? 0),
      bestRun: Math.max(0, saved.bestRun ?? 0),
      totalRuns: Math.max(0, saved.totalRuns ?? 0),
      fighterXp: saved.fighterXp && typeof saved.fighterXp === 'object' ? saved.fighterXp : {},
      daily
    };
  } catch {
    return defaults();
  }
}

let save = loadSave();
let activeGame: TournamentGame | null = null;
let activeDojo: DojoGame | null = null;
let activeCharacterPreview: CharacterPreview | null = null;
const app = document.querySelector<HTMLDivElement>('#app')!;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function formatStuds(value: number) {
  return Math.floor(value).toLocaleString();
}

function fighterLevel(id: string) {
  const xp = Math.max(0, save.fighterXp[id] ?? 0);
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(5, level);
}

function xpProgress(id: string) {
  const xp = Math.max(0, save.fighterXp[id] ?? 0);
  const level = fighterLevel(id);
  if (level >= 5) return { xp, level, current: 1, target: 1, percent: 100 };
  const floor = LEVEL_THRESHOLDS[level - 1];
  const target = LEVEL_THRESHOLDS[level];
  const current = xp - floor;
  return { xp, level, current, target: target - floor, percent: Math.max(0, Math.min(100, current / (target - floor) * 100)) };
}

function upgradedCharacter(base: CharacterDef): CharacterDef {
  const level = fighterLevel(base.id);
  const bonus = level - 1;
  return {
    ...base,
    speed: base.speed + bonus * 0.12,
    damage: Math.round(base.damage * (1 + bonus * 0.07)),
    maxHealth: base.maxHealth + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0)
  };
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
  const selected = findCharacter(save.selected);
  const selectedIdentity = getCharacterIdentity(selected);
  const level = fighterLevel(selected.id);
  app.innerHTML = `
    <main class="menu-screen">
      <div class="dragon-pattern"></div>
      <section class="title-card">
        <p class="eyebrow">CLEAN-ROOM FAN REMAKE</p>
        <h1><span>NINJA</span><strong>TOURNAMENT</strong></h1>
        <p class="subtitle">Clean-room reconstruction of the discontinued 2015 arena loop with original procedural 3D minifigure models and data-driven fighters.</p>
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
          <button class="gold-button" id="fighters-btn">◉ FIGHTERS (${ROSTER.length})</button>
          <button class="gold-button" id="rewards-btn">✦ DAILY DRAW & CHALLENGES ${save.daily.draws > 0 ? `(${save.daily.draws})` : ''}</button>
          <button class="gold-button" id="dojo-btn">◇ PLAY DOJO TUTORIAL</button>
        </div>
        <div class="save-stats">
          <span>◉ ${formatStuds(save.bankStuds)} banked studs</span>
          <span>Best wave ${save.bestWave}</span>
          <span>Best run ${formatStuds(save.bestRun)}</span>
          <span>${save.totalRuns} runs</span>
        </div>
        <p class="legal-note">Fan project only. No extracted APK/OBB assets, official logos, audio, models, textures, animations, or source code are included.</p>
      </section>
    </main>`;

  document.querySelector('#play-btn')?.addEventListener('click', startGame);
  document.querySelector('#fighters-btn')?.addEventListener('click', showRoster);
  document.querySelector('#rewards-btn')?.addEventListener('click', showRewards);
  document.querySelector('#dojo-btn')?.addEventListener('click', showDojo);
}

function showRoster() {
  cleanupGame();
  const cards = ROSTER.map((fighter) => {
    const unlocked = save.unlocked.includes(fighter.id);
    const selected = fighter.id === save.selected;
    const canBuy = save.bankStuds >= fighter.cost;
    const progress = xpProgress(fighter.id);
    const upgraded = upgradedCharacter(fighter);
    const identity = getCharacterIdentity(fighter);
    return `
      <article class="fighter-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-id="${fighter.id}" data-search="${characterSearchText(fighter)}">
        <button class="fighter-avatar preview-character-btn" type="button" data-preview="${fighter.id}" aria-label="View ${identity.name} ${identity.variant ?? ''} 3D model" style="--fighter:#${fighter.color.toString(16).padStart(6, '0')};--accent:#${fighter.accent.toString(16).padStart(6, '0')}"><span></span><i></i><small>3D</small></button>
        <div class="fighter-copy">
          <h3><span class="fighter-primary-name">${identity.name}</span> <small>LV ${progress.level}</small></h3>
          ${identity.variant ? `<span class="fighter-variant">${identity.variant}</span>` : ''}
          <p>${fighter.element} · ${fighter.style} · ${fighter.special.replace('-', ' ')}</p>
          <div class="stat-row"><span>SPD ${upgraded.speed.toFixed(1)}</span><span>DMG ${upgraded.damage}</span><span>♥ ${upgraded.maxHealth}</span></div>
          ${unlocked ? `<div class="xp-line"><i style="width:${progress.percent}%"></i></div><em>${progress.level >= 5 ? 'MAX POTENTIAL' : `${progress.current}/${progress.target} XP`}</em>` : ''}
        </div>
        ${unlocked
          ? `<button class="mini-button select-btn" data-select="${fighter.id}">${selected ? 'SELECTED' : 'SELECT'}</button>`
          : `<button class="mini-button unlock-btn" data-unlock="${fighter.id}" ${canBuy ? '' : 'disabled'}>◉ ${formatStuds(fighter.cost)}</button>`}
      </article>`;
  }).join('');

  app.innerHTML = `
    <main class="panel-screen">
      <header class="top-bar"><button class="back-button" id="back-btn">‹</button><div><small>TOURNAMENT ARCHIVES</small><h2>Fighters · ${ROSTER.length}</h2></div><strong>◉ ${formatStuds(save.bankStuds)}</strong></header>
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
    previewMeta.textContent = `${fighter.element} · ${fighter.style.toUpperCase()} · ${fighter.special.replace('-', ' ').toUpperCase()}`;
    if (activeCharacterPreview) activeCharacterPreview.setCharacter(fighter);
    else activeCharacterPreview = new CharacterPreview(previewHost, fighter);

    document.querySelectorAll<HTMLElement>('[data-preview]').forEach((button) => {
      button.classList.toggle('active-preview', button.dataset.preview === fighter.id);
    });
  };

  setPreview(findCharacter(save.selected));

  document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const fighter = findCharacter(button.dataset.preview!);
      setPreview(fighter);
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
        <article class="draw-card">
          <div class="draw-orb">${save.daily.draws}</div>
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
  const baseFighter = findCharacter(save.selected);
  const fighter = upgradedCharacter(baseFighter);
  const identity = getCharacterIdentity(baseFighter);
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
      <div class="special-wrap"><button id="dojo-special" class="special-button" aria-label="${specialLabel}" title="${specialLabel}">↻</button><small class="special-name">${specialLabel}</small><div class="meter"><i id="dojo-meter"></i></div></div>
      <div class="joystick" id="dojo-joystick"><div class="joystick-ring"><span id="dojo-stick"></span></div></div>
      <div class="action-cluster dojo-actions">
        <button class="action-button jump" data-dojo-action="jump" aria-label="Jump">↑</button>
        <button class="action-button block" id="dojo-block" aria-label="Block">◆</button>
        <button class="action-button grab" data-dojo-action="grab" aria-label="Grab">✦</button>
        <button class="action-button attack" data-dojo-action="attack" aria-label="Attack">⚔</button>
      </div>
      <div class="dodge-hint">SWIPE DOJO TO DODGE · Q ON DESKTOP</div>
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
      document.querySelector('#dojo-enter-tournament')?.addEventListener('click', startGame);
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

function startGame() {
  cleanupGame();
  const baseFighter = findCharacter(save.selected);
  const fighter = upgradedCharacter(baseFighter);
  const identity = getCharacterIdentity(baseFighter);
  const specialLabel = baseFighter.special === 'spinjitzu' ? 'SPINJITZU' : baseFighter.special.replace('-', ' ').toUpperCase();
  app.innerHTML = `
    <main class="game-screen">
      <div id="game-host"></div>
      <div class="hud hud-left"><div class="portrait-ring"><span style="--fighter:#${baseFighter.color.toString(16).padStart(6, '0')}"></span></div><div class="player-hud-copy"><b>${identity.name}</b><small>${identity.variant ?? baseFighter.element}</small><div id="hearts" class="hearts"></div><div id="studs" class="studs"><span class="stud-icon" aria-hidden="true"></span><span class="stud-copy"><b id="stud-count">0</b><small>RUN STUDS · BANK ${formatStuds(save.bankStuds)} · LV ${fighterLevel(baseFighter.id)}</small></span></div></div></div>
      <div class="hud hud-center"><b id="wave-label">WAVE 0</b><small id="enemy-label">GET READY</small></div>
      <div class="hud hud-right"><b id="multiplier">1×</b><small id="combo">0 HIT COMBO</small></div>
      <button class="pause-button" id="exit-btn" aria-label="Exit">Ⅱ</button>
      <div id="message" class="arena-message"></div>
      <div class="special-wrap"><button id="special-btn" class="special-button" aria-label="${specialLabel}" title="${specialLabel}">↻</button><small class="special-name">${specialLabel}</small><div class="meter"><i id="special-meter"></i></div></div>
      <div class="joystick" id="joystick"><div class="joystick-ring"><span id="stick"></span></div></div>
      <div class="action-cluster">
        <button class="action-button jump" data-action="jump" aria-label="Jump">↑</button>
        <button class="action-button block" id="block-btn" aria-label="Block">◆</button>
        <button class="action-button grab" data-action="grab" aria-label="Grab">✦</button>
        <button class="action-button attack" data-action="attack" aria-label="Attack">⚔</button>
      </div>
      <div class="dodge-hint">SWIPE ARENA TO DODGE</div>
      <div id="game-over" class="game-over hidden"></div>
    </main>`;

  const host = document.querySelector<HTMLElement>('#game-host')!;
  const game = new TournamentGame(host, fighter, {
    onHud: updateHud,
    onMessage: showArenaMessage,
    onGameOver: (runStuds, wave) => showGameOver(runStuds, wave, baseFighter.id)
  });
  activeGame = game;

  wireJoystick(game);
  wireArenaSwipe(game, host);
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      game.action(button.dataset.action as 'attack' | 'jump' | 'grab');
    });
  });
  const special = document.querySelector<HTMLButtonElement>('#special-btn')!;
  special.addEventListener('pointerdown', (event) => { event.preventDefault(); game.action('special'); });

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
  const meter = document.querySelector<HTMLElement>('#special-meter');
  if (hearts) hearts.textContent = Array.from({ length: state.maxHealth }, (_, i) => i < state.health ? '♥' : '♡').join('');
  if (studCount) studCount.textContent = formatStuds(state.studs);
  if (multiplier) multiplier.textContent = `${state.multiplier}×`;

  const screen = document.querySelector<HTMLElement>('.game-screen');
  const healthRatio = state.maxHealth > 0 ? state.health / state.maxHealth : 0;
  screen?.classList.toggle('low-health', healthRatio > 0 && healthRatio <= 0.5);
  screen?.classList.toggle('critical-health', healthRatio > 0 && healthRatio <= 0.25);
  if (combo) combo.textContent = `${state.combo} HIT COMBO`;
  if (wave) wave.textContent = state.bossName ? `BOSS · ${state.bossName}` : `WAVE ${state.wave}`;
  if (enemies) enemies.textContent = `${state.enemies} ENEMIES`;
  if (meter) meter.style.width = `${Math.round(state.special)}%`;
  document.querySelector('#special-btn')?.classList.toggle('ready', state.special >= 100);
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

function showGameOver(runStuds: number, wave: number, fighterId: string) {
  const beforeLevel = fighterLevel(fighterId);
  const xpEarned = Math.floor(250 + wave * 120 + Math.min(2000, runStuds * 0.03));
  save.bankStuds += Math.floor(runStuds);
  save.bestWave = Math.max(save.bestWave, wave);
  save.bestRun = Math.max(save.bestRun, Math.floor(runStuds));
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
    <section>
      <small>TOURNAMENT RUN COMPLETE</small>
      <h2>Wave ${wave}</h2>
      <p>◉ ${formatStuds(runStuds)} studs banked</p>
      <p class="xp-award">+${formatStuds(xpEarned)} fighter XP · Level ${afterLevel}${afterLevel > beforeLevel ? ' — POTENTIAL UP!' : ''}</p>
      <div class="menu-actions"><button class="gold-button primary" id="retry-btn">RETRY</button><button class="gold-button" id="rewards-btn">DAILY REWARDS</button><button class="gold-button" id="menu-btn">MAIN MENU</button></div>
    </section>`;
  document.querySelector('#retry-btn')?.addEventListener('click', startGame);
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

showHome();
