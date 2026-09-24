export type ControlAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'punch'
  | 'kick'
  | 'grab'
  | 'jump'
  | 'block'
  | 'dodge'
  | 'special'
  | 'ultimate';

export type KeyBindings = Record<ControlAction, string>;

export const CONTROLS_STORAGE_KEY = 'ninja-tournament-controls-v1';

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  punch: 'KeyJ',
  kick: 'KeyI',
  grab: 'KeyL',
  jump: 'KeyK',
  block: 'ShiftLeft',
  dodge: 'KeyQ',
  special: 'KeyE',
  ultimate: 'KeyR'
};

export const CONTROL_GROUPS: Array<{
  title: string;
  controls: Array<{ action: ControlAction; label: string; help: string }>;
}> = [
  {
    title: 'Movement',
    controls: [
      { action: 'moveUp', label: 'Move Up', help: 'Move toward the top of the arena.' },
      { action: 'moveDown', label: 'Move Down', help: 'Move toward the bottom of the arena.' },
      { action: 'moveLeft', label: 'Move Left', help: 'Move left.' },
      { action: 'moveRight', label: 'Move Right', help: 'Move right.' }
    ]
  },
  {
    title: 'Combat',
    controls: [
      { action: 'punch', label: 'Punch / Box', help: 'Fast boxing strike. Alternates jab and cross.' },
      { action: 'kick', label: 'Kick', help: 'Dedicated stronger kick attack.' },
      { action: 'grab', label: 'Grab / Throw', help: 'Grab a nearby non-boss enemy and throw it.' },
      { action: 'jump', label: 'Jump', help: 'Jump; attack while airborne for a slam.' },
      { action: 'block', label: 'Block', help: 'Hold to reduce incoming damage.' },
      { action: 'dodge', label: 'Dodge', help: 'Quick evade in your facing or movement direction.' },
      { action: 'special', label: 'Spinjitzu / Special', help: 'Use Spinjitzu or the fighter special when charged.' },
      { action: 'ultimate', label: 'Tornado of Creation', help: 'Free Play team ultimate: call the ninja together into one giant creation tornado.' }
    ]
  }
];

function isValidBindings(value: unknown): value is Partial<KeyBindings> {
  return Boolean(value && typeof value === 'object');
}

export function getKeyBindings(): KeyBindings {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTROLS_STORAGE_KEY) ?? 'null') as unknown;
    if (!isValidBindings(parsed)) return { ...DEFAULT_KEY_BINDINGS };
    const next = { ...DEFAULT_KEY_BINDINGS };
    for (const action of Object.keys(DEFAULT_KEY_BINDINGS) as ControlAction[]) {
      const code = (parsed as Partial<KeyBindings>)[action];
      if (typeof code === 'string' && code.trim()) next[action] = code;
    }
    return next;
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

export function saveKeyBindings(bindings: KeyBindings) {
  localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(bindings));
  window.dispatchEvent(new CustomEvent('ninja-controls-updated', { detail: bindings }));
}

export function resetKeyBindings() {
  const next = { ...DEFAULT_KEY_BINDINGS };
  saveKeyBindings(next);
  return next;
}

export function assignKey(action: ControlAction, code: string) {
  const next = getKeyBindings();
  const previousCode = next[action];
  const conflict = (Object.keys(next) as ControlAction[]).find(
    (candidate) => candidate !== action && next[candidate] === code
  );

  if (conflict) next[conflict] = previousCode;
  next[action] = code;
  saveKeyBindings(next);
  return next;
}

export function formatKeyLabel(code: string) {
  const aliases: Record<string, string> = {
    Space: 'SPACE',
    ShiftLeft: 'L SHIFT',
    ShiftRight: 'R SHIFT',
    ControlLeft: 'L CTRL',
    ControlRight: 'R CTRL',
    AltLeft: 'L ALT',
    AltRight: 'R ALT',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'ESC',
    Backspace: 'BACKSPACE',
    Enter: 'ENTER',
    Tab: 'TAB'
  };
  if (aliases[code]) return aliases[code];
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

export function controlCode(action: ControlAction) {
  return getKeyBindings()[action];
}

export function showControlsPanel() {
  document.querySelector('#controls-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'controls-overlay';
  overlay.className = 'controls-overlay';
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Keyboard controls');

  let bindings = getKeyBindings();
  let capturing: ControlAction | null = null;

  const render = () => {
    overlay.innerHTML = `
      <section class="controls-panel">
        <header>
          <div><small>PLAYER SETTINGS</small><h2>Keyboard Controls</h2><p>Click any key box, then press the keyboard key you want to use. Duplicate keys are automatically swapped.</p></div>
          <button class="controls-close" type="button" aria-label="Close controls">×</button>
        </header>
        <div class="controls-groups">
          ${CONTROL_GROUPS.map((group) => `
            <section class="controls-group">
              <h3>${group.title}</h3>
              <div class="controls-list">
                ${group.controls.map((control) => `
                  <article class="control-row">
                    <div><b>${control.label}</b><span>${control.help}</span></div>
                    <button type="button" class="key-bind-button ${capturing === control.action ? 'capturing' : ''}" data-control-action="${control.action}">
                      ${capturing === control.action ? 'PRESS A KEY…' : formatKeyLabel(bindings[control.action])}
                    </button>
                  </article>
                `).join('')}
              </div>
            </section>
          `).join('')}
        </div>
        <section class="controller-map">
          <small>GAMEPAD DEFAULT</small>
          <p>Left stick / D-pad: move · A: punch · RT: kick · X: grab · RB: jump · LB: block · B: dodge · Y: Spinjitzu / special. The team ultimate uses your keyboard binding.</p>
        </section>
        <div class="controls-actions">
          <button class="gold-button" id="controls-reset" type="button">RESET DEFAULTS</button>
          <button class="gold-button primary" id="controls-done" type="button">DONE</button>
        </div>
      </section>`;

    overlay.querySelectorAll<HTMLButtonElement>('[data-control-action]').forEach((button) => {
      button.addEventListener('click', () => {
        capturing = button.dataset.controlAction as ControlAction;
        render();
        overlay.focus();
      });
    });
    overlay.querySelector('.controls-close')?.addEventListener('click', close);
    overlay.querySelector('#controls-done')?.addEventListener('click', close);
    overlay.querySelector('#controls-reset')?.addEventListener('click', () => {
      bindings = resetKeyBindings();
      capturing = null;
      render();
    });
  };

  const close = () => overlay.remove();

  overlay.addEventListener('keydown', (event) => {
    if (capturing) {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        capturing = null;
        render();
        return;
      }
      bindings = assignKey(capturing, event.code);
      capturing = null;
      render();
      return;
    }
    if (event.code === 'Escape') close();
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  document.body.appendChild(overlay);
  render();
  window.setTimeout(() => overlay.focus(), 0);
}
