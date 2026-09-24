import { ROSTER, getCharacterIdentity } from '../characters';

function readUnlocked() {
  // This build intentionally exposes the complete playable collection.
  return new Set(ROSTER.map((fighter) => fighter.id));
}

function showGallery() {
  document.querySelector('#temple-gallery-overlay')?.remove();
  const unlocked = readUnlocked();
  const elements = Array.from(new Set(ROSTER.map((fighter) => fighter.element))).sort();
  const specials = Array.from(new Set(ROSTER.map((fighter) => fighter.special))).sort();
  const overlay = document.createElement('div');
  overlay.id = 'temple-gallery-overlay';
  overlay.className = 'temple-gallery-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Temple Gallery');
  overlay.innerHTML = `
    <section class="temple-gallery-panel">
      <header><div><small>COLLECTION ARCHIVE</small><h2>Temple Gallery</h2><p><span id="gallery-visible-count">${unlocked.size}</span>/${ROSTER.length} fighters shown · ${elements.length} elements · ${specials.length} special families</p></div><button id="gallery-close" aria-label="Close">×</button></header>
      <div class="gallery-toolbar">
        <label for="gallery-search">Find a fighter</label>
        <input id="gallery-search" type="search" autocomplete="off" placeholder="Search fighter, element, style, or special..." />
      </div>
      <nav class="gallery-filters"><button class="active" data-gallery-filter="all">ALL</button><button data-gallery-filter="unlocked">UNLOCKED</button><button data-gallery-filter="locked">LOCKED</button>${elements.map((element) => `<button data-gallery-filter="${element}">${element.toUpperCase()}</button>`).join('')}</nav>
      <div class="gallery-grid">
        ${ROSTER.map((fighter) => {
          const open = unlocked.has(fighter.id) || fighter.unlockedByDefault;
          const identity = getCharacterIdentity(fighter);
          const searchText = [fighter.name, fighter.element, fighter.style, fighter.special, identity.name, identity.variant ?? ''].join(' ').toLowerCase();
          return `<article class="gallery-card ${open ? 'unlocked' : 'locked'}" data-element="${fighter.element}" data-state="${open ? 'unlocked' : 'locked'}" data-search="${searchText}">
            <div class="gallery-figure" style="--fighter:#${fighter.color.toString(16).padStart(6,'0')};--accent:#${fighter.accent.toString(16).padStart(6,'0')}"><span></span><i></i><b></b></div>
            <small>${open ? fighter.element : 'UNDISCOVERED'}</small>
            <h3>${open ? identity.name : '???'}</h3>
            ${open && identity.variant ? `<em>${identity.variant}</em>` : ''}
            <p>${open ? `${fighter.style} · ${fighter.special.replace('-', ' ')}` : 'Unlock this fighter in the tournament archive.'}</p>
            ${open ? `<div><span>SPD ${fighter.speed.toFixed(1)}</span><span>DMG ${fighter.damage}</span><span>♥ ${fighter.maxHealth}</span></div>` : ''}
          </article>`;
        }).join('')}
      </div>
      <section class="gallery-codex"><small>ENEMY CODEX</small><h3>Faction Behaviors</h3><div>
        <article><b>Anacondrai Cultists</b><p>Close-range flankers that circle and burst toward the player.</p></article>
        <article><b>Anacondrai Forms</b><p>Higher-health transformed cultists that cannot be grabbed or thrown.</p></article>
        <article><b>Nindroids</b><p>Spawn cloaked, reveal, then strafe and pressure from range.</p></article>
        <article><b>Serpentines</b><p>Slithering flankers with quick lunges and lateral movement.</p></article>
        <article><b>Stone Warriors</b><p>Heavy armored fighters that resist knockback pressure.</p></article>
        <article><b>Skulkins</b><p>Fast, erratic attackers that constantly change their angle.</p></article>
        <article><b>Shade's Clones</b><p>Phase between visible and shadowed states while repositioning.</p></article>
        <article><b>Bombers</b><p>Heavy enemies that telegraph explosive throws with arena warning rings.</p></article>
      </div></section>
    </section>`;
  document.body.appendChild(overlay);

  let activeFilter = 'all';
  const search = overlay.querySelector<HTMLInputElement>('#gallery-search');
  const count = overlay.querySelector<HTMLElement>('#gallery-visible-count');
  const applyFilters = () => {
    const query = search?.value.trim().toLowerCase() ?? '';
    let visibleCount = 0;
    overlay.querySelectorAll<HTMLElement>('.gallery-card').forEach((card) => {
      const matchesFilter = activeFilter === 'all' || card.dataset.state === activeFilter || card.dataset.element === activeFilter;
      const matchesSearch = !query || (card.dataset.search ?? '').includes(query);
      card.hidden = !(matchesFilter && matchesSearch);
      if (!card.hidden) visibleCount += 1;
    });
    if (count) count.textContent = String(visibleCount);
  };

  const close = () => {
    window.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };

  overlay.querySelector('#gallery-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener('keydown', onKeyDown);
  search?.addEventListener('input', applyFilters);
  overlay.querySelectorAll<HTMLButtonElement>('[data-gallery-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.galleryFilter!;
      overlay.querySelectorAll('[data-gallery-filter]').forEach((node) => node.classList.toggle('active', node === button));
      applyFilters();
    });
  });
  window.setTimeout(() => search?.focus(), 0);
}

function ensureGalleryButton() {
  const menu = document.querySelector<HTMLElement>('main.menu-screen .menu-actions');
  if (!menu || menu.querySelector('#temple-gallery-btn')) return;
  const button = document.createElement('button');
  button.className = 'gold-button';
  button.id = 'temple-gallery-btn';
  button.textContent = '▣ TEMPLE GALLERY';
  button.addEventListener('click', showGallery);
  menu.appendChild(button);
}

const observer = new MutationObserver(ensureGalleryButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', ensureGalleryButton);
