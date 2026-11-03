// Directory behavior. Reads only the markup contract (section.crg-dir details,
// summary, ul/li, the "Show on map" buttons) and calls the map's actions. This
// file is meant to work unchanged in WordPress, where PHP prints the markup.
(function (window) {
  'use strict';

  function create(root, locations) {
    if (!root) return null;

    const locationsById = new Map();
    for (const loc of locations) locationsById.set(Number(loc.id), loc);

    const cards = new Map(); // state name -> details element
    root.querySelectorAll('details.crg-dir__state').forEach((card) => {
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

    // Opening a card always collapses every other card.
    function openOnly(name) {
      let wanted = null;
      cards.forEach((card, cardName) => {
        if (cardName === name) wanted = card;
        else card.open = false;
      });
      if (wanted) wanted.open = true;
      return wanted;
    }

    function collapseAll() {
      cards.forEach((card) => { card.open = false; });
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
      const card = openOnly(name);
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
      openOnly(String(loc.state_name));
      setCurrentLocation(Number(id));
      announce(String(loc.city) + ', ' + String(loc.state_name) + ' selected');
    }

    function onReset() {
      collapseAll();
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

      cards.forEach((card) => {
        const summary = card.querySelector('summary');
        if (!summary) return;
        summary.addEventListener('click', (event) => {
          // Without preventDefault the browser would toggle the card again after
          // this handler and undo the open/close we just performed.
          event.preventDefault();
          const name = card.dataset.stateName;
          if (card.open) {
            // An open heading only closes its own card and never touches the map.
            card.open = false;
            return;
          }
          openOnly(name);
          if (map) map.selectState(name);
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
