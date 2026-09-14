import './styles.css';
import { TournamentGame, type HudState } from './game';
import { ROSTER, findCharacter } from './roster';

interface SaveData {
  bankStuds: number;
  unlocked: string[];
  selected: string;
  bestWave: number;
  bestRun: number;
}

const STORAGE_KEY = 'ninja-tournament-fan-remake-v1';
const defaults = (): SaveData => ({
  bankStuds: 0,
  unlocked: ROSTER.filter((c) => c.unlockedByDefault).map((c) => c.id),
  selected: ROSTER[0].id,
  bestWave: 0,
  bestRun: 0
});

function loadSave(): SaveData {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SaveData> | null;
    if (!saved) return defaults();
    const base = defaults();
    return {
      bankStuds: Math.max(0, saved.bankStuds ?? base.bankStuds),
      unlocked: Array.from(new Set([...(saved.unlocked ?? []), ...base.unlocked])),
      selected: saved.selected && ROSTER.some((c) => c.id === saved.selected) ? saved.selected : base.selected,
      bestWave: Math.max(0, saved.bestWave ?? 0),
      bestRun: Math.max(0, saved.bestRun ?? 0)
    };
  } catch {
    return defaults();
  }
}

let save = loadSave();
let activeGame: TournamentGame | null = null;
const app = document.querySelector<HTMLDivElement>('#app')!;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function formatStuds(value: number) {
  return Math.floor(value).toLocaleString();
}

function cleanupGame() {
  activeGame?.destroy();
  activeGame = null;
}

function showHome() {
  cleanupGame();
  const selected = findCharacter(save.selected);
  app.innerHTML = `
    <main class="menu-screen">
      <div class="dragon-pattern"></div>
      <section class="title-card">
        <p class="eyebrow">CLEAN-ROOM FAN REMAKE</p>
        <h1><span>NINJA</span><strong>TOURNAMENT</strong></h1>
        <p class="subtitle">Arena combat prototype inspired by the discontinued 2015 mobile game.</p>
        <div class="selected-fighter">
          <span class="fighter-dot" style="--fighter:#${selected.color.toString(16).padStart(6, '0')}"></span>
          <div><small>SELECTED FIGHTER</small><b>${selected.name}</b><em>${selected.element} · ${selected.style}</em></div>
        </div>
        <div class="menu-actions">
          <button class="gold-button primary" id="play-btn">▶ ENTER TOURNAMENT</button>
          <button class="gold-button" id="fighters-btn">◉ FIGHTERS</button>
          <button class="gold-button" id="dojo-btn">◇ DOJO / CONTROLS</button>
        </div>
        <div class="save-stats">
          <span>◉ ${formatStuds(save.bankStuds)} banked studs</span>
          <span>Best wave ${save.bestWave}</span>
          <span>Best run ${formatStuds(save.bestRun)}</span>
        </div>
        <p class="legal-note">Fan project only. No extracted APK/OBB assets, official logos, audio, models, textures, or source code are included.</p>
      </section>
    </main>`;

  document.querySelector('#play-btn')?.addEventListener('click', () => startGame());
  document.querySelector('#fighters-btn')?.addEventListener('click', showRoster);
  document.querySelector('#dojo-btn')?.addEventListener('click', showDojo);
}

function showRoster() {
  cleanupGame();
  const cards = ROSTER.map((fighter) => {
    const unlocked = save.unlocked.includes(fighter.id);
    const selected = fighter.id === save.selected;
    const canBuy = save.bankStuds >= fighter.cost;
    return `
      <article class="fighter-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-id="${fighter.id}">
        <div class="fighter-avatar" style="--fighter:#${fighter.color.toString(16).padStart(6, '0')};--accent:#${fighter.accent.toString(16).padStart(6, '0')}">
          <span></span><i></i>
        </div>
        <div class="fighter-copy">
          <h3>${fighter.name}</h3>
          <p>${fighter.element} · ${fighter.style}</p>
          <div class="stat-row"><span>SPD ${fighter.speed.toFixed(1)}</span><span>DMG ${fighter.damage}</span><span>♥ ${fighter.maxHealth}</span></div>
        </div>
        ${unlocked
          ? `<button class="mini-button select-btn" data-select="${fighter.id}">${selected ? 'SELECTED' : 'SELECT'}</button>`
          : `<button class="mini-button unlock-btn" data-unlock="${fighter.id}" ${canBuy ? '' : 'disabled'}>◉ ${formatStuds(fighter.cost)}</button>`}
      </article>`;
  }).join('');

  app.innerHTML = `
    <main class="panel-screen">
      <header class="top-bar">
        <button class="back-button" id="back-btn">‹</button>
        <div><small>TOURNAMENT ARCHIVES</small><h2>Fighters</h2></div>
        <strong>◉ ${formatStuds(save.bankStuds)}</strong>
      </header>
      <section class="roster-grid">${cards}</section>
    </main>`;

  document.querySelector('#back-btn')?.addEventListener('click', showHome);
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

function showDojo() {
  cleanupGame();
  app.innerHTML = `
    <main class="panel-screen dojo-screen">
      <header class="top-bar">
        <button class="back-button" id="back-btn">‹</button>
        <div><small>SENSEI'S TRAINING NOTES</small><h2>Dojo Controls</h2></div>
        <span></span>
      </header>
      <section class="dojo-grid">
        <article><b>Move</b><p>Touch joystick or WASD / arrow keys.</p></article>
        <article><b>Attack</b><p>Red sword button, Space, or J. Chain hits to raise the stud multiplier.</p></article>
        <article><b>Jump</b><p>Arrow button or K. Use movement while airborne to avoid arena pressure.</p></article>
        <article><b>Block</b><p>Shield button or Shift. Damage is heavily reduced while blocking.</p></article>
        <article><b>Grab / Throw</b><p>Hand button or L. Throw regular enemies toward either gong for an instant KO.</p></article>
        <article><b>Spinjitzu</b><p>Land attacks to fill the lower-left meter. Press the spiral or E at 100% for temporary invulnerability and area damage.</p></article>
        <article><b>Boulder Basher</b><p>Red floor rings show where rocks will land. Rocks can also damage enemies.</p></article>
        <article><b>Boss Waves</b><p>Every fifth wave brings an Elemental Master-style boss plus support fighters.</p></article>
      </section>
      <button class="gold-button primary dojo-play" id="play-btn">START PRACTICE RUN</button>
    </main>`;
  document.querySelector('#back-btn')?.addEventListener('click', showHome);
  document.querySelector('#play-btn')?.addEventListener('click', () => startGame());
}

function startGame() {
  cleanupGame();
  const fighter = findCharacter(save.selected);
  app.innerHTML = `
    <main class="game-screen">
      <div id="game-host"></div>
      <div class="hud hud-left">
        <div class="portrait-ring"><span style="--fighter:#${fighter.color.toString(16).padStart(6, '0')}"></span></div>
        <div><div id="hearts" class="hearts"></div><div id="studs" class="studs">◉ 0</div></div>
      </div>
      <div class="hud hud-center"><b id="wave-label">WAVE 0</b><small id="enemy-label">GET READY</small></div>
      <div class="hud hud-right"><b id="multiplier">1×</b><small id="combo">0 HIT COMBO</small></div>
      <button class="pause-button" id="exit-btn" aria-label="Exit">Ⅱ</button>
      <div id="message" class="arena-message"></div>
      <div class="special-wrap"><button id="special-btn" class="special-button">↻</button><div class="meter"><i id="special-meter"></i></div></div>
      <div class="joystick" id="joystick"><div class="joystick-ring"><span id="stick"></span></div></div>
      <div class="action-cluster">
        <button class="action-button jump" data-action="jump" aria-label="Jump">↑</button>
        <button class="action-button block" id="block-btn" aria-label="Block">◆</button>
        <button class="action-button grab" data-action="grab" aria-label="Grab">✦</button>
        <button class="action-button attack" data-action="attack" aria-label="Attack">⚔</button>
      </div>
      <div id="game-over" class="game-over hidden"></div>
    </main>`;

  const host = document.querySelector<HTMLElement>('#game-host')!;
  const game = new TournamentGame(host, fighter, {
    onHud: updateHud,
    onMessage: showArenaMessage,
    onGameOver: (runStuds, wave) => showGameOver(runStuds, wave)
  });
  activeGame = game;

  wireJoystick(game);
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
  const studs = document.querySelector('#studs');
  const multiplier = document.querySelector('#multiplier');
  const combo = document.querySelector('#combo');
  const wave = document.querySelector('#wave-label');
  const enemies = document.querySelector('#enemy-label');
  const meter = document.querySelector<HTMLElement>('#special-meter');
  if (hearts) hearts.textContent = Array.from({ length: state.maxHealth }, (_, i) => i < state.health ? '♥' : '♡').join('');
  if (studs) studs.textContent = `◉ ${formatStuds(state.studs)}`;
  if (multiplier) multiplier.textContent = `${state.multiplier}×`;
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
  messageTimer = window.setTimeout(() => el.classList.remove('show'), 1700);
}

function showGameOver(runStuds: number, wave: number) {
  save.bankStuds += Math.floor(runStuds);
  save.bestWave = Math.max(save.bestWave, wave);
  save.bestRun = Math.max(save.bestRun, Math.floor(runStuds));
  persist();
  const overlay = document.querySelector<HTMLElement>('#game-over');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <section>
      <small>TOURNAMENT RUN COMPLETE</small>
      <h2>Wave ${wave}</h2>
      <p>◉ ${formatStuds(runStuds)} studs banked</p>
      <div class="menu-actions">
        <button class="gold-button primary" id="retry-btn">RETRY</button>
        <button class="gold-button" id="menu-btn">MAIN MENU</button>
      </div>
    </section>`;
  document.querySelector('#retry-btn')?.addEventListener('click', startGame);
  document.querySelector('#menu-btn')?.addEventListener('click', showHome);
}

function wireJoystick(game: TournamentGame) {
  const zone = document.querySelector<HTMLElement>('#joystick')!;
  const stick = document.querySelector<HTMLElement>('#stick')!;
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

showHome();
