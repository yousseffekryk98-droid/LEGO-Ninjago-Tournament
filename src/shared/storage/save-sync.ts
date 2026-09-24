const SAVE_KEY = 'ninja-tournament-fan-remake-v1';
const SAVE_CACHE_KEY = `${SAVE_KEY}:cache`;

function mirrorPrimarySave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    JSON.parse(raw);
    localStorage.setItem(SAVE_CACHE_KEY, raw);
  } catch {
    // Keep the last known-good mirrored cache when the primary payload is damaged.
  }
}

window.addEventListener('ninja-save-updated', mirrorPrimarySave);
window.addEventListener('pagehide', mirrorPrimarySave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') mirrorPrimarySave();
});
window.addEventListener('DOMContentLoaded', mirrorPrimarySave);
