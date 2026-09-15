export {};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const controllerKeys = new Set<string>();
let installPrompt: InstallPromptEvent | null = null;
let status: HTMLDivElement | null = null;
let installButton: HTMLButtonElement | null = null;

function dispatchKey(code: string, down: boolean) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
    code,
    key: code,
    bubbles: true,
    cancelable: true
  }));
}

function setControllerKey(code: string, down: boolean) {
  const active = controllerKeys.has(code);
  if (down === active) return;
  if (down) controllerKeys.add(code);
  else controllerKeys.delete(code);
  dispatchKey(code, down);
}

function releaseControllerKeys() {
  for (const code of [...controllerKeys]) setControllerKey(code, false);
}

function axisPressed(value: number, direction: -1 | 1, deadzone = 0.28) {
  return direction < 0 ? value < -deadzone : value > deadzone;
}

function updateGamepad() {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = Array.from(pads).find((entry): entry is Gamepad => Boolean(entry && entry.connected));
  if (!pad) {
    releaseControllerKeys();
    if (status) status.dataset.controller = 'off';
    return;
  }

  if (status) status.dataset.controller = 'on';
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  setControllerKey('ArrowLeft', axisPressed(x, -1) || Boolean(pad.buttons[14]?.pressed));
  setControllerKey('ArrowRight', axisPressed(x, 1) || Boolean(pad.buttons[15]?.pressed));
  setControllerKey('ArrowUp', axisPressed(y, -1) || Boolean(pad.buttons[12]?.pressed));
  setControllerKey('ArrowDown', axisPressed(y, 1) || Boolean(pad.buttons[13]?.pressed));

  setControllerKey('KeyJ', Boolean(pad.buttons[0]?.pressed));
  setControllerKey('KeyQ', Boolean(pad.buttons[1]?.pressed));
  setControllerKey('KeyL', Boolean(pad.buttons[2]?.pressed));
  setControllerKey('KeyE', Boolean(pad.buttons[3]?.pressed));
  setControllerKey('ShiftLeft', Boolean(pad.buttons[4]?.pressed));
  setControllerKey('KeyK', Boolean(pad.buttons[5]?.pressed));
}

function mountPlatformUi() {
  status = document.createElement('div');
  status.className = 'platform-status';
  status.dataset.controller = 'off';
  status.innerHTML = '<span class="controller-pill">🎮 Controller</span><span class="offline-pill">↯ Offline ready</span>';
  document.body.appendChild(status);

  installButton = document.createElement('button');
  installButton.className = 'install-app-button';
  installButton.type = 'button';
  installButton.textContent = '＋ INSTALL GAME';
  installButton.hidden = true;
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton!.hidden = true;
  });
  document.body.appendChild(installButton);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  if (installButton) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
});

window.addEventListener('gamepadconnected', () => {
  if (status) status.dataset.controller = 'on';
});
window.addEventListener('gamepaddisconnected', releaseControllerKeys);
window.addEventListener('blur', releaseControllerKeys);

document.addEventListener('DOMContentLoaded', () => {
  mountPlatformUi();
  window.setInterval(updateGamepad, 16);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Offline service worker registration failed:', error);
    });
  });
}
