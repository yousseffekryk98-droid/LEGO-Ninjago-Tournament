import './styles.css';
import { TournamentGame, type HudState } from './game';
import { ROSTER, findCharacter, type CharacterDef } from './roster';

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
}

function showHome() {
  cleanupGame();
  const selected = findCharacter(save.selected);
  const level = fighterLevel(selected.id);
  app.innerHTML = `
    <main class="menu-screen">
      <div class="dragon-pattern"></div>
      <section class="title-card">
        <p class="eyebrow">CLEAN-ROOM FAN REMAKE</p>
        <h1><span>NINJA</span><strong>TOURNAMENT</strong></h1>
        <p class="subtitle">Playable reconstruction of the discontinued 2015 mobile arena loop, built from public gameplay references with original procedural placeholder art.</p>
        <div class="selected-fighter">
          <span class="fighter-dot" style="--fighter:#${selected.color.toString(16).padStart(6, '0')}"></span>
          <div><small>SELECTED FIGHTER · LEVEL ${level}</small><b>${selected.name}</b><em>${selected.element} · ${selected.style}</em></div>
        </div>
        <div class="menu-actions">
          <button class="gold-button primary" id="play-btn">▶ ENTER TOURNAMENT</button>
          <button class="gold-button" id="fighters-btn">◉ FIGHTERS</button>
          <button class="gold-button" id="rewards-btn">✦ DAILY DRAW & CHALLENGES ${save.daily.draws > 0 ? `(${save.daily.draws})` : ''}</button>
          <button class="gold-button" id="dojo-btn">◇ DOJO / CONTROLS</button>
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
    return `
      <article class="fighter-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-id="${fighter.id}">
        <div class="fighter-avatar" style="--fighter:#${fighter.color.toString(16).padStart(6, '0')};--accent:#${fighter.accent.toString(16).padStart(6, '0')}"><span></span><i></i></div>
        <div class="fighter-copy">
          <h3>${fighter.name} <small>LV ${progress.level}</small></h3>
          <p>${fighter.element} · ${fighter.style}</p>
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
      <header class="top-bar"><button class="back-button" id="back-btn">‹</button><div><small>TOURNAMENT ARCHIVES</small><h2>Fighters</h2></div><strong>◉ ${formatStuds(save.bankStuds)}</strong></header>
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
  app.innerHTML = `
    <main class="panel-screen dojo-screen">
      <header class="top-bar"><button class="back-button" id="back-btn">‹</button><div><small>SENSEI'S TRAINING NOTES</small><h2>Dojo Controls</h2></div><span></span></header>
      <section class="dojo-grid">
        <article><b>Move</b><p>Touch joystick or WASD / arrow keys.</p></article>
        <article><b>Attack</b><p>Red sword button, Space, or J. Chain hits to raise the stud multiplier.</p></article>
        <article><b>Jump + Slam</b><p>Arrow button or K to jump. Press attack while airborne to slam down and damage nearby enemies.</p></article>
        <article><b>Dodge</b><p>Swipe across the arena on mobile or press Q. Dodge grants a short invulnerability window.</p></article>
        <article><b>Block</b><p>Shield button or Shift. Damage is heavily reduced while blocking.</p></article>
        <article><b>Grab / Throw</b><p>Hand button or L. Throw regular enemies toward either gong for an instant KO.</p></article>
        <article><b>Spinjitzu</b><p>Land attacks to fill the lower-left meter. Press the spiral or E at 100% for temporary invulnerability and area damage.</p></article>
        <article><b>Arena Events</b><p>Watch for Boulder Basher targets, Titanium Dragon ice balls, Condrai reinforcements, and floor spikes.</p></article>
        <article><b>Boss Powers</b><p>Boss waves now include special behavior such as Karlof tremors, Ash teleports, Mr. Pale invisibility, Neuro bursts, and Griffin speed charges.</p></article>
        <article><b>True Potential</b><p>Each fighter earns XP after a run and grows through five potential levels, improving combat stats.</p></article>
      </section>
      <button class="gold-button primary dojo-play" id="play-btn">START PRACTICE RUN</button>
    </main>`;
  document.querySelector('#back-btn')?.addEventListener('click', showHome);
  document.querySelector('#play-btn')?.addEventListener('click', startGame);
}

function startGame() {
  cleanupGame();
  const baseFighter = findCharacter(save.selected);
  const fighter = upgradedCharacter(baseFighter);
  app.innerHTML = `
    <main class="game-screen">
      <div id="game-host"></div>
      <div class="hud hud-left"><div class="portrait-ring"><span style="--fighter:#${baseFighter.color.toString(16).padStart(6, '0')}"></span></div><div><div id="hearts" class="hearts"></div><div id="studs" class="studs">◉ 0 · LV ${fighterLevel(baseFighter.id)}</div></div></div>
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
  const studs = document.querySelector('#studs');
  const multiplier = document.querySelector('#multiplier');
  const combo = document.querySelector('#combo');
  const wave = document.querySelector('#wave-label');
  const enemies = document.querySelector('#enemy-label');
  const meter = document.querySelector<HTMLElement>('#special-meter');
  if (hearts) hearts.textContent = Array.from({ length: state.maxHealth }, (_, i) => i < state.health ? '♥' : '♡').join('');
  if (studs) studs.textContent = `◉ ${formatStuds(state.studs)} · LV ${fighterLevel(save.selected)}`;
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

function wireArenaSwipe(game: TournamentGame, host: HTMLElement) {
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
