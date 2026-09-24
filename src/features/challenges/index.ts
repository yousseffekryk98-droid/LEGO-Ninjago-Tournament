import { TournamentGame, type HudState } from '../combat';
import { findCharacter, getElementCombatTheme } from '../characters';
import { applyFighterXp } from '../progression';

const STORAGE_KEY = 'ninja-tournament-fan-remake-v1';
const SAVE_CACHE_KEY = `${STORAGE_KEY}:cache`;

type ChallengeId = 'first-gate' | 'score-attack' | 'boss-hunt';

interface ChallengeDef {
  id: ChallengeId;
  name: string;
  objective: string;
  reward: number;
  timer?: number;
}

const CHALLENGES: ChallengeDef[] = [
  { id: 'first-gate', name: 'Single Challenge', objective: 'Clear the first arena wave without being knocked out.', reward: 1250 },
  { id: 'score-attack', name: 'Score Attack', objective: 'Survive 75 seconds and bank as many studs as possible.', reward: 1800, timer: 75 },
  { id: 'boss-hunt', name: 'Boss Challenge', objective: 'Reach and defeat the first tournament boss.', reward: 4500 }
];

let activeGame: TournamentGame | null = null;
let challengeTimer = 0;
let timerInterval = 0;
let latestHud: HudState | null = null;
let seenBoss = false;
let finishing = false;

function readSave() {
  for (const key of [STORAGE_KEY, SAVE_CACHE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown> & { selected?: string; bankStuds?: number; fighterXp?: Record<string, number> };
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fall through to the recovery cache.
    }
  }
  return {} as Record<string, unknown> & { selected?: string; bankStuds?: number; fighterXp?: Record<string, number> };
}

function writeReward(reward: number) {
  const save = readSave();
  save.bankStuds = Math.max(0, Number(save.bankStuds ?? 0)) + reward;
  const payload = JSON.stringify(save);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(SAVE_CACHE_KEY, payload);
  window.dispatchEvent(new CustomEvent('ninja-save-updated'));
}

function ensureHubButton() {
  const menu = document.querySelector<HTMLElement>('main.menu-screen .menu-actions');
  if (!menu || menu.querySelector('#challenge-hub-btn')) return;
  const button = document.createElement('button');
  button.className = 'gold-button';
  button.id = 'challenge-hub-btn';
  button.textContent = '◆ CHALLENGE ARENA';
  button.addEventListener('click', showChallengeHub);
  menu.appendChild(button);
}

function showChallengeHub() {
  cleanupChallenge();
  const overlay = document.createElement('div');
  overlay.id = 'challenge-overlay';
  overlay.className = 'challenge-overlay';
  overlay.innerHTML = `
    <section class="challenge-panel">
      <header><div><small>TOURNAMENT SIDE EVENTS</small><h2>Challenge Arena</h2></div><button id="challenge-close" aria-label="Close">×</button></header>
      <p class="challenge-intro">Short-form modes with separate objectives and bonus stud rewards. Your normal tournament save remains intact.</p>
      <div class="challenge-grid">
        ${CHALLENGES.map((challenge) => `<article>
          <small>${challenge.id === 'boss-hunt' ? 'BOSS EVENT' : challenge.id === 'score-attack' ? 'TIMED EVENT' : 'SINGLE EVENT'}</small>
          <h3>${challenge.name}</h3>
          <p>${challenge.objective}</p>
          <b>REWARD ◉ ${challenge.reward.toLocaleString()}</b>
          <button class="gold-button primary" data-challenge="${challenge.id}">START</button>
        </article>`).join('')}
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#challenge-close')?.addEventListener('click', closeChallengeOverlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-challenge]').forEach((button) => {
    button.addEventListener('click', () => startChallenge(button.dataset.challenge as ChallengeId));
  });
}

function startChallenge(id: ChallengeId) {
  const challenge = CHALLENGES.find((entry) => entry.id === id)!;
  const overlay = document.querySelector<HTMLElement>('#challenge-overlay');
  if (!overlay) return;
  const save = readSave();
  const baseFighter = findCharacter(String(save.selected ?? ''));
  const fighterXp = save.fighterXp && typeof save.fighterXp === 'object' ? Number(save.fighterXp[baseFighter.id] ?? 0) : 0;
  const fighter = applyFighterXp(baseFighter, fighterXp);
  const elementTheme = getElementCombatTheme(baseFighter.element);
  const elementColor = `#${elementTheme.color.toString(16).padStart(6, '0')}`;
  const elementAccent = `#${elementTheme.accent.toString(16).padStart(6, '0')}`;
  latestHud = null;
  seenBoss = false;
  finishing = false;
  challengeTimer = challenge.timer ?? 0;

  overlay.innerHTML = `
    <main class="challenge-game" data-mode="${id}">
      <div id="challenge-game-host"></div>
      <header class="challenge-hud">
        <div><small>${challenge.name}</small><b id="challenge-objective">${challenge.objective}</b></div>
        <strong id="challenge-clock">${challenge.timer ? `${challenge.timer}s` : 'ACTIVE'}</strong>
        <button id="challenge-abort">EXIT</button>
      </header>
      <div class="challenge-stats"><span id="challenge-wave">WAVE 0</span><span id="challenge-studs">◉ 0</span><span id="challenge-health">♥</span></div>
      <div class="challenge-controls">
        <div class="challenge-dpad">
          <button data-move="up">▲</button><div><button data-move="left">◀</button><button data-move="down">▼</button><button data-move="right">▶</button></div>
        </div>
        <div class="challenge-actions">
          <button data-action="jump">JUMP</button><button data-block>BLOCK</button><button data-action="grab">GRAB</button><button data-action="punch">PUNCH</button><button class="challenge-element-kick" data-action="kick" style="--element-color:${elementColor};--element-accent:${elementAccent}">${elementTheme.icon} ${baseFighter.element.toUpperCase()}</button><button data-action="special">SPECIAL</button>
        </div>
      </div>
      <div class="challenge-result hidden" id="challenge-result"></div>
    </main>`;

  const host = overlay.querySelector<HTMLElement>('#challenge-game-host')!;
  activeGame = new TournamentGame(host, { ...fighter }, {
    onHud: (hud) => handleChallengeHud(challenge, hud),
    onMessage: (message) => {
      const objective = overlay.querySelector('#challenge-objective');
      if (objective) objective.textContent = message;
    },
    onGameOver: () => finishChallenge(challenge, false)
  });

  wireChallengeControls(activeGame, overlay);
  overlay.querySelector('#challenge-abort')?.addEventListener('click', showChallengeHub);

  if (challenge.timer) {
    timerInterval = window.setInterval(() => {
      challengeTimer = Math.max(0, challengeTimer - 1);
      const clock = overlay.querySelector('#challenge-clock');
      if (clock) clock.textContent = `${challengeTimer}s`;
      if (challengeTimer <= 0) finishChallenge(challenge, true);
    }, 1000);
  }
}

function handleChallengeHud(challenge: ChallengeDef, hud: HudState) {
  latestHud = hud;
  const overlay = document.querySelector<HTMLElement>('#challenge-overlay');
  if (!overlay || finishing) return;
  const wave = overlay.querySelector('#challenge-wave');
  const studs = overlay.querySelector('#challenge-studs');
  const health = overlay.querySelector('#challenge-health');
  if (wave) wave.textContent = hud.bossName ? `BOSS · ${hud.bossName}` : `WAVE ${hud.wave}`;
  if (studs) studs.textContent = `◉ ${Math.floor(hud.studs).toLocaleString()}`;
  if (health) health.textContent = `♥ ${hud.health}/${hud.maxHealth}`;

  if (challenge.id === 'first-gate' && hud.wave >= 2) finishChallenge(challenge, true);
  if (challenge.id === 'boss-hunt') {
    if (hud.bossName) seenBoss = true;
    if (seenBoss && !hud.bossName && hud.wave >= 6) finishChallenge(challenge, true);
  }
}

function finishChallenge(challenge: ChallengeDef, success: boolean) {
  if (finishing) return;
  finishing = true;
  window.clearInterval(timerInterval);
  timerInterval = 0;
  activeGame?.destroy();
  activeGame = null;

  const earned = success ? challenge.reward : Math.min(500, Math.floor((latestHud?.studs ?? 0) * 0.25));
  if (earned > 0) writeReward(earned);
  const result = document.querySelector<HTMLElement>('#challenge-result');
  if (!result) return;
  result.classList.remove('hidden');
  result.innerHTML = `<section><small>${success ? 'CHALLENGE COMPLETE' : 'CHALLENGE ENDED'}</small><h2>${challenge.name}</h2><p>${success ? 'Objective cleared.' : 'The objective was not completed.'}</p><b>◉ ${earned.toLocaleString()} BONUS STUDS</b><div><button class="gold-button primary" id="challenge-retry">RETRY</button><button class="gold-button" id="challenge-return">CHALLENGE MENU</button><button class="gold-button" id="challenge-home">MAIN MENU</button></div></section>`;
  result.querySelector('#challenge-retry')?.addEventListener('click', () => startChallenge(challenge.id));
  result.querySelector('#challenge-return')?.addEventListener('click', showChallengeHub);
  result.querySelector('#challenge-home')?.addEventListener('click', closeChallengeOverlay);
}

function wireChallengeControls(game: TournamentGame, root: HTMLElement) {
  const moveVectors: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
    const vector = moveVectors[button.dataset.move!];
    const stop = () => game.setMove(0, 0);
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); game.setMove(...vector); });
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', stop);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); game.action(button.dataset.action as 'punch' | 'kick' | 'jump' | 'grab' | 'special'); });
  });
  const block = root.querySelector<HTMLButtonElement>('[data-block]');
  if (block) {
    const stop = () => game.setBlock(false);
    block.addEventListener('pointerdown', (event) => { event.preventDefault(); block.setPointerCapture(event.pointerId); game.setBlock(true); });
    block.addEventListener('pointerup', stop);
    block.addEventListener('pointercancel', stop);
    block.addEventListener('lostpointercapture', stop);
  }
}

function cleanupChallenge() {
  activeGame?.destroy();
  activeGame = null;
  window.clearInterval(timerInterval);
  timerInterval = 0;
  finishing = false;
}

function closeChallengeOverlay() {
  cleanupChallenge();
  document.querySelector('#challenge-overlay')?.remove();
}

const observer = new MutationObserver(ensureHubButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', ensureHubButton);
