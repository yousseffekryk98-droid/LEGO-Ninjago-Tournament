const MUTE_KEY = 'ninja-tournament-sfx-muted-v1';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = localStorage.getItem(MUTE_KEY) === 'true';
let lastMessage = '';
let lastMessageAt = 0;

function ensureAudio() {
  if (muted || typeof AudioContext === 'undefined') return null;
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.14;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);
  return audioContext;
}

function tone(startFrequency: number, endFrequency: number, duration: number, gain = 0.16, type: OscillatorType = 'sine', delay = 0) {
  const ctx = ensureAudio();
  if (!ctx || !masterGain) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration * 0.2));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(duration = 0.08, gain = 0.13) {
  const ctx = ensureAudio();
  if (!ctx || !masterGain) return;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  const source = ctx.createBufferSource();
  const envelope = ctx.createGain();
  source.buffer = buffer;
  envelope.gain.setValueAtTime(gain, ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  source.connect(envelope);
  envelope.connect(masterGain);
  source.start();
}

function playImpact(strength = 1) {
  noise(0.065 + strength * 0.025, 0.09 + strength * 0.035);
  tone(120, 52, 0.11 + strength * 0.025, 0.16, 'triangle');
}

function playReward() {
  tone(620, 720, 0.12, 0.11, 'triangle');
  tone(820, 1020, 0.16, 0.1, 'triangle', 0.08);
  tone(1080, 1320, 0.18, 0.08, 'sine', 0.17);
}

function playSpecial() {
  tone(170, 680, 0.34, 0.11, 'sawtooth');
  tone(330, 980, 0.3, 0.07, 'triangle', 0.06);
}

function playUi() {
  tone(430, 510, 0.055, 0.05, 'triangle');
}

function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function shake(strength: 'light' | 'heavy' = 'light') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.querySelector<HTMLElement>('#game-host canvas, #dojo-host canvas');
  const screen = document.querySelector<HTMLElement>('.game-screen');
  if (!canvas) return;
  canvas.classList.remove('impact-shake', 'impact-shake-heavy');
  void canvas.offsetWidth;
  canvas.classList.add(strength === 'heavy' ? 'impact-shake-heavy' : 'impact-shake');
  if (screen) {
    screen.classList.remove('feedback-flash');
    void screen.offsetWidth;
    screen.classList.add('feedback-flash');
  }
  window.setTimeout(() => {
    canvas.classList.remove('impact-shake', 'impact-shake-heavy');
    screen?.classList.remove('feedback-flash');
  }, strength === 'heavy' ? 300 : 190);
}

function reactToMessage(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return;
  const now = performance.now();
  if (normalized === lastMessage && now - lastMessageAt < 250) return;
  lastMessage = normalized;
  lastMessageAt = now;

  if (/missile|bomb|tremor|slam|shock|hit!|gong ko|speed charge/.test(normalized)) {
    playImpact(/missile|bomb|tremor|slam|gong ko/.test(normalized) ? 1.35 : 0.9);
    shake(/missile|bomb|tremor|slam|gong ko/.test(normalized) ? 'heavy' : 'light');
    vibrate(/missile|bomb|tremor|slam/.test(normalized) ? [18, 24, 26] : 18);
    return;
  }

  if (/spinjitzu|overload|toxic cloud|air strike|boost!|charge attack|shout!|special/.test(normalized)) {
    playSpecial();
    shake('light');
    vibrate(14);
    return;
  }

  if (/defeated|studs|prize|training complete|challenge complete|potential up|heart \+/.test(normalized)) {
    playReward();
  }
}

function mountAudioToggle() {
  if (document.querySelector('#sfx-toggle')) return;
  const button = document.createElement('button');
  button.id = 'sfx-toggle';
  button.className = 'sfx-toggle';
  button.type = 'button';
  const render = () => {
    button.textContent = muted ? '🔇 SFX OFF' : '🔊 SFX ON';
    button.setAttribute('aria-pressed', String(!muted));
  };
  render();
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    muted = !muted;
    localStorage.setItem(MUTE_KEY, String(muted));
    render();
    if (!muted) {
      ensureAudio();
      playReward();
    }
  });
  document.body.appendChild(button);
}

function inspectMessages() {
  const message = document.querySelector<HTMLElement>('#message');
  if (message?.textContent) reactToMessage(message.textContent);
  const draw = document.querySelector<HTMLElement>('#draw-result');
  if (draw?.textContent?.includes('STUD PRIZE')) reactToMessage('prize');
  const complete = document.querySelector<HTMLElement>('#dojo-complete:not(.hidden)');
  if (complete) reactToMessage('training complete');
}

document.addEventListener('pointerdown', (event) => {
  ensureAudio();
  const target = event.target as HTMLElement | null;
  if (target?.closest('button') && !target.closest('#sfx-toggle')) playUi();
}, { passive: true });

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (['Space', 'Enter', 'KeyJ', 'KeyK', 'KeyL', 'KeyE', 'KeyQ'].includes(event.code)) ensureAudio();
});

const observer = new MutationObserver(inspectMessages);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('DOMContentLoaded', () => {
  mountAudioToggle();
  inspectMessages();
});
