// Directory behavior. Reads only the markup contract (section.crg-dir cards,
// their header buttons, city rows and the "Show on map" buttons) and calls the
// map's actions. This file is meant to work unchanged in WordPress, where PHP
// prints the markup.
(function (window) {
  'use strict';

  function create(root, locations) {
    if (!root) return null;

    const locationsById = new Map();
    for (const loc of locations) locationsById.set(Number(loc.id), loc);

    const cards = new Map(); // state name -> card element
    root.querySelectorAll('.crg-dir__state').forEach((card) => {
      cards.set(card.dataset.stateName, card);
    });

    let map = null;

    // Selections are announced politely so screen reader users hear what changed.
    const live = document.createElement('p');
    live.className = 'crg-visually-hidden';
    live.setAttribute('aria-live', 'polite');
    root.appendChild(live);

    function announce(text) {
      live.textContent = '';
      live.textContent = text;
    }

    function locationCount(card) {
      return card.querySelectorAll('li[data-loc-id]').length;
    }

    // Exactly one card carries the active (selected state) styling; aria-pressed
    // mirrors it so the highlight is not conveyed by color alone.
    function setActiveCard(name) {
      cards.forEach((card, cardName) => {
        const active = cardName === name;
        card.classList.toggle('is-active', active);
        const head = card.querySelector('.crg-dir__head');
        if (head) head.setAttribute('aria-pressed', String(active));
      });
    }

    // The highlighted row uses aria-current, so the state is not conveyed by color alone.
    function setCurrentLocation(id) {
      const wanted = id === null || id === undefined ? null : Number(id);
      root.querySelectorAll('li[data-loc-id]').forEach((row) => {
        if (wanted !== null && Number(row.dataset.locId) === wanted) {
          row.setAttribute('aria-current', 'true');
        } else {
          row.removeAttribute('aria-current');
        }
      });
    }

    // ---------- Map callbacks (these never call the map back) ----------
    function onStateChange(name) {
      const card = cards.get(name);
      setActiveCard(card ? name : null);
      setCurrentLocation(null);
      if (card) {
        const count = locationCount(card);
        announce(name + ' selected, ' + count + ' location' + (count === 1 ? '' : 's'));
      }
    }

    function onMarkerSelect(id) {
      if (id === null || id === undefined) {
        setCurrentLocation(null);
        return;
      }
      const loc = locationsById.get(Number(id));
      if (!loc) return;
      const stateName = String(loc.state_name);
      setActiveCard(cards.has(stateName) ? stateName : null);
      setCurrentLocation(Number(id));
      announce(String(loc.city) + ', ' + stateName + ' selected');
    }

    function onReset() {
      setActiveCard(null);
      setCurrentLocation(null);
    }

    // ---------- User interaction ----------
    function scrollMapIntoView() {
      if (!map) return;
      const mapEl = map.getContainer();
      if (!mapEl) return;
      const rect = mapEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const fullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
      if (fullyVisible) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // "nearest" moves as little as possible; no smooth scrolling for reduced motion.
      mapEl.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function attach(mapApi) {
      map = mapApi;

      root.querySelectorAll('.crg-dir__head[data-action="select-state"]').forEach((head) => {
        head.addEventListener('click', () => {
          if (!map) return;
          map.selectState(head.dataset.stateName);
          // A directory action moved the map; bring the result into view. Focus
          // stays on the header button because scrollIntoView never moves focus.
          scrollMapIntoView();
        });
      });

      root.querySelectorAll('button.crg-dir__action[data-action="show-location"]').forEach((button) => {
        button.addEventListener('click', () => {
          if (!map) return;
          map.focusLocation(Number(button.dataset.locId));
          scrollMapIntoView();
          // Focus deliberately stays on this button.
        });
      });
    }

    return {
      attach: attach,
      onStateChange: onStateChange,
      onMarkerSelect: onMarkerSelect,
      onReset: onReset,
    };
  }

  window.CRGDirectory = { create: create };
})(window);
