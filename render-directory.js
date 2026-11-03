// PROTOTYPE ONLY. Builds the location directory cards from the same locations
// list the map uses. In WordPress this markup is printed by PHP instead and this
// file is removed. The markup produced here is the contract CRGDirectory expects.
(function (window) {
  'use strict';

  // Static SVG icons only. Data text is always inserted with textContent.
  const ICON = {
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    marker: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.3 7-12A7 7 0 0 0 5 9c0 5.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  };

  function iconSpan(className, svg) {
    const span = document.createElement('span');
    span.className = className;
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = svg; // Our control string only; location text never passes through here.
    return span;
  }

  function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
  }

  // Groups locations by state, then sorts states and cities by name. The data file
  // is never assumed to be in order.
  function groupByState(locations) {
    const groups = new Map();
    for (const loc of locations) {
      const name = String(loc.state_name);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(loc);
    }
    return groups;
  }

  function buildCityRow(loc) {
    const row = document.createElement('li');
    row.dataset.locId = String(loc.id);
    row.appendChild(iconSpan('crg-dir__rowicon', ICON.marker));

    if (isHttpUrl(loc.url)) {
      const link = document.createElement('a');
      link.className = 'crg-dir__city';
      link.href = loc.url;
      link.textContent = String(loc.city); // Text only, so names can never inject markup.
      link.target = '_blank';
      link.rel = 'noopener';
      row.appendChild(link);
    } else {
      const name = document.createElement('span');
      name.className = 'crg-dir__city';
      name.textContent = String(loc.city);
      row.appendChild(name);
    }

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'crg-dir__action';
    action.dataset.action = 'show-location';
    action.dataset.locId = String(loc.id);
    action.appendChild(iconSpan('crg-dir__action-icon', ICON.target));
    const actionText = document.createElement('span');
    actionText.textContent = 'Show on map';
    action.appendChild(actionText);
    row.appendChild(action);

    return row;
  }

  function buildStateCard(name, items) {
    const card = document.createElement('article');
    card.className = 'crg-dir__state';
    card.dataset.stateName = name;

    // The state name itself is the control that selects the state on the map.
    const heading = document.createElement('h3');
    heading.className = 'crg-dir__title';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'crg-dir__head';
    head.dataset.action = 'select-state';
    head.dataset.stateName = name;
    head.setAttribute('aria-pressed', 'false');
    head.setAttribute('aria-label', name + ', ' + items.length + ' location' + (items.length === 1 ? '' : 's'));
    head.appendChild(iconSpan('crg-dir__icon', ICON.pin));
    const label = document.createElement('span');
    label.className = 'crg-dir__name';
    label.textContent = name;
    head.appendChild(label);
    const count = document.createElement('span');
    count.className = 'crg-dir__count';
    count.textContent = String(items.length);
    head.appendChild(count);
    heading.appendChild(head);
    card.appendChild(heading);

    // Always visible: the cards are not collapsible.
    const list = document.createElement('ul');
    for (const loc of items) list.appendChild(buildCityRow(loc));
    card.appendChild(list);

    return card;
  }

  function render(root, locations) {
    if (!root) return;
    root.textContent = '';

    const groups = groupByState(locations);
    const stateNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    for (const name of stateNames) {
      const items = groups.get(name).slice().sort((a, b) =>
        String(a.city).localeCompare(String(b.city)) || Number(a.id) - Number(b.id));
      root.appendChild(buildStateCard(name, items));
    }
  }

  window.CRGRender = { render: render };
})(window);
