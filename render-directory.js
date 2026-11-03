// PROTOTYPE ONLY. Builds the location directory cards from the same locations
// list the map uses. In WordPress this markup is printed by PHP instead and this
// file is removed. The markup produced here is the contract CRGDirectory expects.
(function (window) {
  'use strict';

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
    action.textContent = 'Show on map';
    row.appendChild(action);

    return row;
  }

  function buildStateCard(name, items) {
    const card = document.createElement('details');
    card.className = 'crg-dir__state';
    card.dataset.stateName = name;
    // Cards start collapsed (the details element's default).

    const summary = document.createElement('summary');
    summary.appendChild(document.createTextNode(name + ' '));
    const count = document.createElement('span');
    count.className = 'crg-dir__count';
    count.textContent = '(' + items.length + ')';
    summary.appendChild(count);
    card.appendChild(summary);

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
