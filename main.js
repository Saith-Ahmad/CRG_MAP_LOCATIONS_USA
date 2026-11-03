(async function main() {
  'use strict';

  const mapContainer = document.getElementById('crg-map');
  const dirRoot = document.getElementById('crg-dir');

  function readJson(response) {
    if (!response.ok) throw new Error(response.url + ' returned ' + response.status);
    return response.json();
  }

  // The hostile fixture is only used by the security test and is not linked anywhere.
  const params = new URLSearchParams(window.location.search);
  const locationsUrl = params.get('data') === 'hostile' ? 'data/locations.hostile.json' : 'data/locations.json';

  let topology, locations;
  try {
    [topology, locations] = await Promise.all([
      fetch('data/states-10m.json').then(readJson),
      fetch(locationsUrl).then(readJson),
    ]);
  } catch (error) {
    if (mapContainer) mapContainer.textContent = 'The map could not be loaded.';
    console.error(error);
    return;
  }

  // The map and the directory feed each other, so the controller is created first
  // (it exposes the callbacks), the map is initialized with those callbacks, and
  // only then is the map object handed back to the directory.
  if (dirRoot) window.CRGRender.render(dirRoot, locations);
  const directory = window.CRGDirectory.create(dirRoot, locations);
  const mapApi = window.CRGMap.init({
    container: mapContainer,
    topology: topology,
    locations: locations,
    resetButton: document.getElementById('crg-map-reset'),
    fullscreenButton: document.getElementById('crg-map-fullscreen'),
    onStateChange: directory.onStateChange,
    onMarkerSelect: directory.onMarkerSelect,
    onReset: directory.onReset,
  });
  directory.attach(mapApi);

  // Exposed for automated tests, per the master plan's module contract tests.
  window.crgMap = mapApi;
  window.crgDirectory = directory;
})();
