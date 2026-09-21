// The legacy menu keeps its save snapshot in module memory. External production
// overlays that directly mutate the same local save must reload the shell after
// a purchase so a stale in-memory bank cannot overwrite the transaction later.
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-buy-powerup]') : null;
  if (!button || button.disabled) return;
  window.setTimeout(() => location.reload(), 0);
});
