import { ROSTER } from '../characters';

const SAVE_KEY = 'ninja-tournament-fan-remake-v1';
const SAVE_CACHE_KEY = `${SAVE_KEY}:cache`;
export const POWERUP_KEY = 'ninja-tournament-powerups-v1';

export type PowerupId = 'iron-heart' | 'charged-scroll' | 'battle-focus';

export interface PowerupState {
  inventory: Record<PowerupId, number>;
  active: PowerupId | null;
}

export const POWERUPS: Array<{ id: PowerupId; name: string; description: string; cost: number; icon: string }> = [
  { id: 'iron-heart', name: 'Iron Heart', description: '+1 maximum heart for the next run.', cost: 1800, icon: '♥' },
  { id: 'charged-scroll', name: 'Charged Scroll', description: '+22% damage for the next run.', cost: 1600, icon: '↻' },
  { id: 'battle-focus', name: 'Battle Focus', description: '+12% damage and +12% speed for the next run.', cost: 2400, icon: '⚔' }
];

function defaultState(): PowerupState {
  return { inventory: { 'iron-heart': 0, 'charged-scroll': 0, 'battle-focus': 0 }, active: null };
}

export function readPowerups(): PowerupState {
  try {
    const raw = JSON.parse(localStorage.getItem(POWERUP_KEY) ?? 'null') as Partial<PowerupState> | null;
    const base = defaultState();
    if (!raw) return base;
    return {
      inventory: {
        'iron-heart': Math.max(0, Number(raw.inventory?.['iron-heart'] ?? 0)),
        'charged-scroll': Math.max(0, Number(raw.inventory?.['charged-scroll'] ?? 0)),
        'battle-focus': Math.max(0, Number(raw.inventory?.['battle-focus'] ?? 0))
      },
      active: POWERUPS.some((item) => item.id === raw.active) ? raw.active as PowerupId : null
    };
  } catch {
    return defaultState();
  }
}

export function writePowerups(state: PowerupState) {
  localStorage.setItem(POWERUP_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('ninja-powerups-updated'));
}

function readMainSave() {
  for (const key of [SAVE_KEY, SAVE_CACHE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { bankStuds?: number; selected?: string } & Record<string, unknown>;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fall through to the mirrored cache.
    }
  }
  return { bankStuds: 0 } as { bankStuds?: number; selected?: string } & Record<string, unknown>;
}

function writeMainSave(save: Record<string, unknown>) {
  const payload = JSON.stringify(save);
  localStorage.setItem(SAVE_KEY, payload);
  localStorage.setItem(SAVE_CACHE_KEY, payload);
  window.dispatchEvent(new CustomEvent('ninja-save-updated'));
}

function awardRandomPowerup() {
  const state = readPowerups();
  const weights: PowerupId[] = ['charged-scroll', 'charged-scroll', 'iron-heart', 'battle-focus'];
  const id = weights[Math.floor(Math.random() * weights.length)];
  state.inventory[id] += 1;
  writePowerups(state);
  return POWERUPS.find((item) => item.id === id)!;
}

function consumeActivePowerupForLaunch() {
  const state = readPowerups();
  const id = state.active;
  if (!id) return;
  if (state.inventory[id] <= 0) {
    state.active = null;
    writePowerups(state);
    return;
  }

  const save = readMainSave();
  const fighter = ROSTER.find((entry) => entry.id === save.selected) ?? ROSTER[0];
  const original = { maxHealth: fighter.maxHealth, damage: fighter.damage, speed: fighter.speed };

  if (id === 'iron-heart') fighter.maxHealth += 1;
  if (id === 'charged-scroll') fighter.damage = Math.round(fighter.damage * 1.22);
  if (id === 'battle-focus') {
    fighter.damage = Math.round(fighter.damage * 1.12);
    fighter.speed *= 1.12;
  }

  state.inventory[id] -= 1;
  state.active = null;
  writePowerups(state);

  // startGame/startChallenge clone the selected definition synchronously during
  // the click event. Restore the shared roster on the next task so the boost is
  // consumable rather than permanently changing clean-room balance data.
  window.setTimeout(() => {
    fighter.maxHealth = original.maxHealth;
    fighter.damage = original.damage;
    fighter.speed = original.speed;
  }, 0);
}

function showPowerups() {
  document.querySelector('#powerup-overlay')?.remove();
  const state = readPowerups();
  const save = readMainSave();
  const bank = Math.max(0, Number(save.bankStuds ?? 0));
  const overlay = document.createElement('div');
  overlay.id = 'powerup-overlay';
  overlay.className = 'powerup-overlay';
  overlay.innerHTML = `
    <section class="powerup-panel">
      <header><div><small>PRE-FIGHT LOADOUT</small><h2>Power-Ups</h2></div><button id="powerup-close" aria-label="Close">×</button></header>
      <p>Choose one consumable for your next tournament or challenge run. Prize draws also award a bonus power-up.</p>
      <strong class="powerup-bank">◉ ${bank.toLocaleString()} banked studs</strong>
      <div class="powerup-grid">
        ${POWERUPS.map((item) => {
          const count = state.inventory[item.id];
          const active = state.active === item.id;
          return `<article class="${active ? 'active' : ''}" data-powerup-card="${item.id}">
            <i>${item.icon}</i><small>${active ? 'EQUIPPED FOR NEXT RUN' : 'CONSUMABLE'}</small><h3>${item.name}</h3><p>${item.description}</p><b>Owned ×${count}</b>
            <div><button class="gold-button" data-buy-powerup="${item.id}" ${bank >= item.cost ? '' : 'disabled'}>BUY ◉ ${item.cost.toLocaleString()}</button><button class="gold-button primary" data-equip-powerup="${item.id}" ${count > 0 ? '' : 'disabled'}>${active ? 'UNEQUIP' : 'EQUIP'}</button></div>
          </article>`;
        }).join('')}
      </div>
      <p class="powerup-note">A selected power-up is consumed when a new arena instance starts.</p>
    </section>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#powerup-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelectorAll<HTMLButtonElement>('[data-buy-powerup]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.buyPowerup as PowerupId;
      const item = POWERUPS.find((entry) => entry.id === id)!;
      const mainSave = readMainSave();
      const currentBank = Math.max(0, Number(mainSave.bankStuds ?? 0));
      if (currentBank < item.cost) return;
      mainSave.bankStuds = currentBank - item.cost;
      writeMainSave(mainSave);
      const next = readPowerups();
      next.inventory[id] += 1;
      writePowerups(next);
      showPowerups();
    });
  });
  overlay.querySelectorAll<HTMLButtonElement>('[data-equip-powerup]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.equipPowerup as PowerupId;
      const next = readPowerups();
      if (next.inventory[id] <= 0) return;
      next.active = next.active === id ? null : id;
      writePowerups(next);
      showPowerups();
    });
  });
}

function ensurePowerupButton() {
  const menu = document.querySelector<HTMLElement>('main.menu-screen .menu-actions');
  if (!menu || menu.querySelector('#powerup-menu-btn')) return;
  const button = document.createElement('button');
  button.className = 'gold-button';
  button.id = 'powerup-menu-btn';
  const state = readPowerups();
  const active = POWERUPS.find((item) => item.id === state.active);
  button.textContent = active ? `⚡ POWER-UPS · ${active.name.toUpperCase()}` : '⚡ POWER-UPS';
  button.addEventListener('click', showPowerups);
  menu.appendChild(button);
}

function wirePrizeDrawBonus() {
  const draw = document.querySelector<HTMLButtonElement>('#draw-btn');
  if (!draw || draw.dataset.powerupWired === 'true') return;
  draw.dataset.powerupWired = 'true';
  draw.addEventListener('click', () => {
    if (draw.disabled) return;
    window.setTimeout(() => {
      const result = document.querySelector<HTMLElement>('#draw-result');
      if (!result || !result.textContent?.includes('STUD PRIZE')) return;
      const item = awardRandomPowerup();
      result.insertAdjacentHTML('beforeend', `<em class="powerup-bonus">BONUS POWER-UP · ${item.icon} ${item.name}</em>`);
    }, 0);
  });
}

function enhance() {
  ensurePowerupButton();
  wirePrizeDrawBonus();
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('#play-btn, #retry-btn, #dojo-enter-tournament, [data-challenge]') : null;
  if (target) consumeActivePowerupForLaunch();
}, { capture: true });

const observer = new MutationObserver(enhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('ninja-save-updated', enhance);
window.addEventListener('ninja-powerups-updated', enhance);
window.addEventListener('DOMContentLoaded', enhance);
