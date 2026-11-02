# CRG Franchise Website: Phase 4 Master Plan
## Interactive United States Location Map and Location Directory

**Project:** crgfranchise.com redesign for EPIC Vision (Tommy Quinn)
**Developer:** Ahmad
**Platform:** WordPress with Elementor and Elementor Pro
**Staging site:** novacoreeng.com (search engine indexing disabled)
**Status of Phases 1 to 3:** complete
**This file covers:** Phase 4 only (requirement sections 5 and 6 of the project brief)

---

## 0. How to use this file

**For Ahmad:** read sections 1 to 4 once. Then work through the stage you are in. Each stage ends with a gate (a list of pass or fail checks). You do not start the next stage until the gate is passed.

**For the Claude Code agent:** this file is the specification. Follow section 8 (Agent Rules) exactly. Work on one stage at a time. At the end of each stage, write a results file (`STAGE<number>_RESULTS.md`) listing every criterion with Pass, Fail or Waived, and the evidence (command output, screenshot name). Stop and report. Do not start the next stage until Ahmad confirms.

### Verification status of this file (read this before trusting the code)

**Verified in a sandbox:**
- The four libraries install at exactly these versions: Leaflet 1.9.4, Leaflet.markercluster 1.5.3, topojson-client 3.1.0, us-atlas 3.0.1.
- The file paths used by the copy script exist, and the file sizes quoted in this plan were measured.
- The state boundary file contains 56 features: 50 states, the District of Columbia, and 5 territories (American Samoa, Guam, Northern Mariana Islands, Puerto Rico, US Virgin Islands). The plan therefore excludes territories by code, not only Alaska and Hawaii.
- All JavaScript and JSON in this file passes a syntax check (`node --check`).

**NOT verified (expect small fixes):**
- Nothing has been run in a browser. The map behaviour is unproven until Stage 1 passes.
- The PHP has not been linted or run (no PHP interpreter was available).
- The automated tests (Playwright) have not been run.
- Behaviour with Elementor, the Customify theme and the optimization plugins on staging is unknown.

---

## 1. Goal

### 1.1 Intended outcome

A visitor to crgfranchise.com can see where Cleanest Restaurant Group (CRG) operates today, on an interactive map of the United States, and can browse the same information as a list underneath. The CRG team can add, edit or switch off a location in the WordPress dashboard, and the map and the list both update with no code edits.

### 1.2 What the visitor experiences

1. The map shows the lower 48 states and the District of Columbia. States where CRG operates are darker gray. All other states are lighter gray. No markers are visible yet.
2. Moving the mouse over a darker state highlights it in brand blue, shows its name and number of locations, and reveals its markers.
3. Clicking (or tapping on a phone) a darker state zooms to it and keeps its markers visible. Markers that sit close together merge into one numbered circle.
4. Clicking a marker opens a small popup with the city, the state and a link to that location's website (when one exists).
5. Zoom in, zoom out and Reset buttons are always available. Zooming in far enough shows markers even without selecting a state.
6. Underneath, a list groups cities by state, alphabetically. Buttons in the list move the map. Clicking a marker highlights the matching city in the list.
7. On a phone, a one-finger swipe over the map scrolls the page normally until the visitor taps a state.

### 1.3 In scope

- Interactive map, state hover and click, zoom, markers, popups, clustering
- Location directory below the map
- WordPress dashboard management of locations (one shared data source)
- Mobile, keyboard and reduced-motion behaviour
- Admin documentation for updating locations

### 1.4 Out of scope for Phase 4

- Street-level base map (needs a paid or rate-limited tile service; requires Tommy's approval)
- Alaska, Hawaii and territories (not displayed in version 1)
- The "Available Franchise Territories" map or section. **Existing locations and available territories are different things.** Do not touch the existing territories content, and do not use wording that suggests a mapped market is available for purchase.
- Final location list (must be confirmed with EPIC Vision before publication)
- Page design around the map (headings, intro copy). That is normal Elementor work using the approved homepage design direction.

### 1.5 Hard constraints from the project brief

- No paid plugin and no paid map or geocoding service without Tommy's approval.
- All work happens on staging. No changes to the live site.
- No manual JavaScript or HTML edits when a location changes.
- Map and directory read from one shared data source.
- Keyboard-accessible map controls or an equivalent accessible directory.
- Usable without hover. Respect the visitor's reduced-motion setting.
- Good performance. Avoid unnecessary plugins.

---

## 2. Glossary (plain language)

| Term | Meaning |
|---|---|
| **Leaflet** | A free JavaScript library for interactive maps (zoom, drag, popups, markers). It normally draws street-map pictures underneath. We use it without those pictures, drawing only state shapes. |
| **Leaflet.markercluster** | A free add-on for Leaflet that merges nearby markers into one numbered circle. |
| **Latitude** | North-south position in degrees. All US locations are positive (about 25 to 49 for the lower 48 states). |
| **Longitude** | East-west position in degrees. All US locations are **negative** (about -125 to -67). A missing minus sign puts a marker in the wrong country. |
| **GeoJSON** | A text format that describes shapes (such as a state outline) as lists of latitude and longitude points. |
| **TopoJSON** | A smaller, compressed form of GeoJSON. The state boundary file (`us-atlas`, built from US Census Bureau data) uses it. The `topojson-client` library converts it to GeoJSON in the browser. |
| **FIPS code** | A two-digit number the US Census Bureau gives each state and territory (for example 02 is Alaska). The boundary file uses it as an identifier. |
| **District of Columbia (DC)** | The capital city's area. Maps treat it like a state. It is tiny on a national map, so it needs a clickable circle. |
| **Custom Post Type** | A WordPress content type we define ourselves, like Posts or Pages. Here: "Locations". |
| **Advanced Custom Fields (ACF)** | A WordPress plugin that adds named input fields (city, state, latitude) to an editing screen. |
| **Shortcode** | A bracketed tag such as `[crg_locations]` that WordPress replaces with real output. |
| **Transient** | A WordPress temporary cache entry stored in the database with an expiry time. |
| **Web Mercator** | The map projection Leaflet uses. It makes the United States look slightly wider than the familiar curved-top shape. |
| **Playwright** | A free tool that drives a real browser automatically, used here to run the automated checks. |
| **Staging site** | A private copy of the website used for testing: novacoreeng.com. |
| **Gate** | A list of pass or fail checks that must pass before the next stage starts. |

---

## 3. Architecture

### 3.1 Data flow

```
WordPress dashboard (Locations, edited by CRG staff)
        |
        v
Custom Post Type "crg_location" + Advanced Custom Fields
        |
        v
crg_get_locations()  (PHP, one function, cached in a transient)
        |
        +--> Directory HTML   (server-rendered, works without JavaScript)
        |
        +--> JSON data block  (<script type="application/json">)
                  |
                  v
          crg-map-init.js  --->  CRGMap.init()  (crg-map.js, the reusable map module)
                  ^                    ^
                  |                    |
        directory buttons        us-atlas boundary file (local copy)
```

### 3.2 Final plugin layout

```
crg-locations/
  crg-locations.php                 (Stage 2: data, shortcode, assets)
  assets/
    css/crg-locations.css           (Stage 1 file style.css, renamed)
    js/crg-map.js                   (Stage 1 file, copied unchanged)
    js/crg-map-init.js              (Stage 3)
    vendor/leaflet/leaflet.js, leaflet.css
    vendor/markercluster/leaflet.markercluster.js, MarkerCluster.css, MarkerCluster.Default.css
    vendor/topojson-client.min.js
    data/states-10m.json
  tools/                            (development only, not deployed)
    seed-locations.php, seed-locations.json
```

### 3.3 Data contract

Every location is an object with exactly these fields. The prototype's JSON file and the WordPress output use the same shape, which is what lets one map module serve both.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | WordPress post ID in production, any unique number in the prototype |
| `city` | string | Display name, may be a service area such as "Brooklyn & Queens" |
| `state_code` | string | Two letters, for example `CO` |
| `state_name` | string | Full name exactly as in the boundary file, for example `District of Columbia` |
| `lat` | number | Positive for the US |
| `lng` | number | Negative for the US |
| `url` | string | Empty string if none. Only `http` and `https` links are used. |

### 3.4 Technology decisions and reasons

| Decision | Reason |
|---|---|
| Leaflet without a base map | Provides zoom, pan, popups, keyboard-reachable markers and clustering for free. No tile service, no cost, no external requests. |
| Local copies of all libraries and the boundary file | No external requests (speed, privacy, no outage dependency). |
| Plain HTML prototype first, no React | WordPress loads plain JavaScript files. React would add build tooling that would be removed later. The prototype separates map problems from WordPress problems. |
| One reusable module (`crg-map.js`) | The prototype and WordPress run the same file, so Stage 1 results carry over. |
| Custom Post Type registered in code (not the Custom Post Type UI plugin) | One plugin fewer, and the data model is version controlled and portable between Local, staging and live. |
| Custom Post Type is non-public | Location records get no web address and cannot be indexed. |
| ACF number fields for coordinates | ACF's map field needs a paid Google Maps key. |
| Directory rendered by PHP | Works without JavaScript and doubles as the accessible equivalent of the map. |
| Markers shown per state, on demand | Meets "no clutter at first load" in the brief. |
| Scripts enqueued from inside the shortcode | Elementor stores page content outside the normal post content, so checking the content for the shortcode does not work. |
| Territories excluded by FIPS code | Keeps place names out of the map module and avoids drawing islands thousands of miles away. |
| Tiny states get a clickable circle, chosen by size | Keeps place names out of the module and covers the District of Columbia and Rhode Island automatically. |

---

## 4. Plan overview

| Stage | Name | Where | Gate (summary) |
|---|---|---|---|
| 0 | Preparation | Your computer | Tools installed, repository created |
| **1** | **Plain HTML prototype of the map** | Your computer, not WordPress | All MUST criteria in section 5.4 pass, including on a real phone |
| 2 | WordPress data layer | Local by Flywheel | Admin can add, edit and switch off locations; directory is correct |
| 3 | Map inside Elementor | Local, then staging | Same map behaviour as Stage 1 on a WordPress page |
| 4 | Directory and map linking | Local, then staging | Buttons, markers and list stay in sync |
| 5 | Hardening | Staging | Accessibility, speed, browsers, optimization plugins |
| 6 | Staging release, documentation, report | Staging | Real data confirmed, admin guide written, Tommy reviewed |

After Stage 1, re-estimate the remaining stages and report the estimate to Tommy. The Phase 1 plan promised this.

---

## 5. Stage 1: Plain HTML prototype

### 5.1 What Stage 1 must prove

Stage 1 proves that **the entire visitor experience in section 1.2 works from a data file alone, on a desktop browser and on a real phone, with a map module that can be reused inside WordPress unchanged.**

It deliberately does not involve WordPress. If something breaks here, the cause is the map code, not WordPress, Elementor or a plugin.

### 5.2 Tasks

**Task 1.1. Create the project and install the libraries**

```bash
mkdir crg-map-prototype
cd crg-map-prototype
git init
npm init -y
npm install --save-exact leaflet@1.9.4 leaflet.markercluster@1.5.3 topojson-client@3.1.0 us-atlas@3.0.1
npm install --save-dev --save-exact serve @playwright/test
npx playwright install chromium
printf "node_modules\ntest-results\n" > .gitignore
```

Why exact versions: a library update must never silently change behaviour between Stage 1 and the release.

**Task 1.2. Create the files below**, then run the copy script.

```bash
node copy-vendor.js
```

This copies the browser-ready files out of `node_modules` into `vendor/` and `data/`. Commit `vendor/` and `data/`.

**Task 1.3. Start the server and open the page**

```bash
npx serve . -l 3000
```

Open `http://localhost:3000`. (Opening `index.html` by double-clicking will not work: browsers block file loading from `file://` addresses.)

**Task 1.4. Run the automated checks**

```bash
npx playwright test
```

**Task 1.5. Run the manual checks** in section 5.4 (desktop, then Chrome DevTools phone emulation, then a real phone).

**Task 1.6. Write `STAGE1_RESULTS.md`** (template in section 5.5), take the three screenshots, commit, and tag:

```bash
git add -A
git commit -m "Stage 1: map prototype passes gate"
git tag stage-1-passed
```

### 5.3 Files

#### `crg-map.js` (the reusable map module)

```javascript
/**
 * crg-map.js
 *
 * Reusable map module. It knows nothing about where its data comes from:
 * the Stage 1 prototype and the WordPress plugin both call CRGMap.init()
 * with data that has already been loaded. That is what lets the same file
 * move from the prototype into WordPress unchanged.
 *
 * Requires (loaded before this file): Leaflet, Leaflet.markercluster, topojson-client.
 *
 * Rule: this file must never contain a place name. Everything about which
 * states are active comes from the `locations` array.
 */
(function (window) {
  'use strict';

  // The boundary file identifies each feature by its FIPS code (a two-digit
  // number the US Census Bureau assigns to each state or territory).
  // Excluded: Alaska 02, Hawaii 15, American Samoa 60, Guam 66,
  // Northern Mariana Islands 69, Puerto Rico 72, US Virgin Islands 78.
  // Excluding by code, not by name, keeps place names out of this file.
  const EXCLUDED_FIPS = new Set(['02', '15', '60', '66', '69', '72', '78']);

  // Rough rectangle around the lower 48 states: [[south, west], [north, east]].
  const NATIONAL_BOUNDS = [[24.4, -125.0], [49.6, -66.9]];

  // A state whose outline spans less than this many degrees in BOTH directions
  // gets a clickable circle on top, because the shape itself is only a few
  // pixels wide at national zoom. Decided by size, not by name.
  const SMALL_STATE_SPAN_DEGREES = 1.0;

  // Markers appear for every active state once the visitor has zoomed this many
  // levels in from the national view, even without selecting a state.
  const REVEAL_ZOOM_STEPS = 1.5;

  const COLORS = {
    activeFill: '#7b828c',   // darker gray: state has locations
    inactiveFill: '#dfe2e6', // lighter gray: state has none
    border: '#ffffff',
    highlight: '#23447F',    // brand blue for hover and selection
  };

  // Only http and https links are accepted. This blocks "javascript:" links.
  function safeHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function init(options) {
    const container = options.container;
    const resetButton = options.resetButton || null;
    const topology = options.topology;
    const locations = options.locations;
    const onStateChange = options.onStateChange || null;
    const onMarkerSelect = options.onMarkerSelect || null;

    // Visitor's "reduce motion" system setting, read once at start.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // True on phones and tablets: one-finger drag must scroll the page, not the map.
    const isTouchDevice = L.Browser.mobile;

    const map = L.map(container, {
      zoomSnap: 0.25,
      maxZoom: 12,
      scrollWheelZoom: false,       // enabled only after a state is selected
      dragging: !isTouchDevice,     // on touch devices, enabled only after a state is selected
      zoomAnimation: !reduceMotion,
      fadeAnimation: !reduceMotion,
      markerZoomAnimation: !reduceMotion,
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('State boundaries: US Census Bureau');

    // ---------- Data preparation ----------
    // Convert compressed TopoJSON to GeoJSON, then drop territories and non-contiguous states.
    const states = topojson.feature(topology, topology.objects.states);
    states.features = states.features.filter((feature) => !EXCLUDED_FIPS.has(String(feature.id)));

    // Group locations by state name. A state is "active" if it has at least one location.
    const locationsByState = new Map();
    for (const location of locations) {
      if (!locationsByState.has(location.state_name)) locationsByState.set(location.state_name, []);
      locationsByState.get(location.state_name).push(location);
    }
    const isActive = (feature) => locationsByState.has(feature.properties.name);

    // ---------- Interaction state ----------
    // Hover is only a preview. selectedState is the real selection.
    let selectedState = null;
    let nationalZoom = 0;
    let revealZoom = 0;
    const stateLayers = new Map();   // state name -> drawn shape
    const hotspots = new Map();      // state name -> clickable circle for tiny states
    const markerGroups = new Map();  // state name -> cluster group of that state's markers
    const markersById = new Map();   // location id -> { marker, group, location }

    // ---------- Views ----------
    function applyNationalView(animate) {
      // Reset the minimum zoom first, otherwise a previous (larger) minimum would
      // clamp the calculation after the container has been resized smaller.
      map.setMinZoom(0);
      nationalZoom = map.getBoundsZoom(NATIONAL_BOUNDS);
      map.setMinZoom(nationalZoom); // visitor can never zoom out past the national view
      revealZoom = nationalZoom + REVEAL_ZOOM_STEPS;
      map.fitBounds(NATIONAL_BOUNDS, { animate: animate });
    }

    // ---------- Markers ----------
    function buildPopup(location) {
      // Built with textContent, never an HTML string, so location text cannot inject HTML.
      const wrapper = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = location.city + ', ' + location.state_name;
      wrapper.appendChild(title);
      const href = safeHttpUrl(location.url);
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = 'Visit location website';
        link.target = '_blank';
        link.rel = 'noopener';
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(link);
      }
      return wrapper;
    }

    function buildMarker(location) {
      const marker = L.marker([location.lat, location.lng], {
        // A CSS circle instead of Leaflet's default image pin: no image files to go missing.
        icon: L.divIcon({ className: 'crg-pin', iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: location.city + ', ' + location.state_code, // hover text and screen readers
        keyboard: true,                                    // reachable with the Tab key
      });
      marker.bindPopup(buildPopup(location));
      marker.on('popupopen', function () {
        if (onMarkerSelect) onMarkerSelect(location.id);
      });
      return marker;
    }

    // One cluster group per state, created once, added to the map only when needed.
    // That is how "no markers at first load" is achieved.
    locationsByState.forEach(function (items, stateName) {
      const group = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        animate: !reduceMotion,
      });
      items.forEach(function (location) {
        const marker = buildMarker(location);
        markersById.set(location.id, { marker: marker, group: group, location: location });
        group.addLayer(marker);
      });
      markerGroups.set(stateName, group);
    });

    function showMarkers(name) {
      const group = markerGroups.get(name);
      if (group && !map.hasLayer(group)) map.addLayer(group);
    }

    function hideMarkers(name) {
      // The selected state, and every state once zoomed in far enough, keep their markers.
      if (name === selectedState || map.getZoom() >= revealZoom) return;
      const group = markerGroups.get(name);
      if (group && map.hasLayer(group)) map.removeLayer(group);
    }

    // Runs after every zoom, and manually after a reset (zoomend does not fire
    // when the view did not actually change).
    function syncMarkersToZoom() {
      const reveal = map.getZoom() >= revealZoom;
      markerGroups.forEach(function (group, name) {
        if (reveal || name === selectedState) showMarkers(name);
        else hideMarkers(name);
      });
    }

    // ---------- State shapes ----------
    function baseStyle(feature) {
      return {
        color: COLORS.border,
        weight: 1,
        fillOpacity: 1,
        fillColor: isActive(feature) ? COLORS.activeFill : COLORS.inactiveFill,
      };
    }

    // Inactive states: their own layer with interactivity off. No hover, no click,
    // no pointer cursor, and dragging passes straight through to the map.
    L.geoJSON(states, {
      filter: function (feature) { return !isActive(feature); },
      style: baseStyle,
      interactive: false,
    }).addTo(map);

    let activeLayer = null; // assigned below; unhighlight() needs it

    function highlight(layer, name) {
      layer.setStyle({ fillColor: COLORS.highlight });
      layer.bringToFront(); // draw its border above neighbours
      const hotspot = hotspots.get(name);
      if (hotspot) hotspot.bringToFront(); // keep the clickable circle above the shape
    }

    function unhighlight(layer) {
      activeLayer.resetStyle(layer);
    }

    function attachInteractions(target, name, layer) {
      const count = locationsByState.get(name).length;
      target.bindTooltip(name + ': ' + count + (count === 1 ? ' location' : ' locations'), { sticky: true });
      target.on({
        mouseover: function () { highlight(layer, name); showMarkers(name); },
        mouseout: function () {
          if (name !== selectedState) { unhighlight(layer); hideMarkers(name); }
        },
        click: function () { selectState(name); }, // on phones a tap triggers this same handler
      });
    }

    activeLayer = L.geoJSON(states, {
      filter: isActive,
      style: baseStyle,
      onEachFeature: function (feature, layer) {
        stateLayers.set(feature.properties.name, layer);
        attachInteractions(layer, feature.properties.name, layer);
      },
    }).addTo(map);

    // Clickable circles for states too small to hit at national zoom.
    stateLayers.forEach(function (layer, name) {
      const bounds = layer.getBounds();
      const small = (bounds.getNorth() - bounds.getSouth()) < SMALL_STATE_SPAN_DEGREES &&
                    (bounds.getEast() - bounds.getWest()) < SMALL_STATE_SPAN_DEGREES;
      if (!small) return;
      const circle = L.circleMarker(bounds.getCenter(), {
        radius: 10, weight: 2, color: COLORS.border, fillColor: COLORS.activeFill, fillOpacity: 1,
      }).addTo(map);
      hotspots.set(name, circle);
      attachInteractions(circle, name, layer);
    });

    // ---------- Public actions ----------
    function selectState(name, settings) {
      const layer = stateLayers.get(name);
      if (!layer) return;
      const animate = settings && settings.animate === false ? false : !reduceMotion;
      if (selectedState && selectedState !== name) {
        const previous = selectedState;
        selectedState = null; // cleared first, otherwise the guard in hideMarkers blocks hiding
        unhighlight(stateLayers.get(previous));
        hideMarkers(previous);
      }
      selectedState = name;
      highlight(layer, name);
      showMarkers(name);
      // maxZoom stops tiny shapes from zooming absurdly far.
      map.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 9, animate: animate });
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      if (onStateChange) onStateChange(name);
    }

    function resetView() {
      const previous = selectedState;
      selectedState = null;
      if (previous) unhighlight(stateLayers.get(previous));
      map.closePopup();
      map.scrollWheelZoom.disable();
      if (isTouchDevice) map.dragging.disable();
      applyNationalView(!reduceMotion);
      syncMarkersToZoom();
    }

    function focusLocation(id) {
      const entry = markersById.get(id);
      if (!entry) return;
      selectState(entry.location.state_name, { animate: false }); // no animation: zoomToShowLayer moves the map next
      entry.group.zoomToShowLayer(entry.marker, function () { entry.marker.openPopup(); });
    }

    // Read-only snapshot used by automated tests.
    function debug() {
      const visibleGroups = [];
      markerGroups.forEach(function (group, name) { if (map.hasLayer(group)) visibleGroups.push(name); });
      return {
        selectedState: selectedState,
        zoom: map.getZoom(),
        nationalZoom: nationalZoom,
        revealZoom: revealZoom,
        activeStates: Array.from(stateLayers.keys()).sort(),
        hotspotStates: Array.from(hotspots.keys()).sort(),
        visibleGroups: visibleGroups.sort(),
      };
    }

    // ---------- Wiring ----------
    map.on('zoomend', syncMarkersToZoom);
    if (resetButton) resetButton.addEventListener('click', resetView);

    // Container size can change (phone rotation, window resize): recompute the national view.
    let resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        map.invalidateSize();
        if (!selectedState) applyNationalView(false);
      }, 150);
    }
    window.addEventListener('resize', onResize);

    function destroy() {
      window.removeEventListener('resize', onResize);
      if (resetButton) resetButton.removeEventListener('click', resetView);
      map.remove();
    }

    applyNationalView(false);

    return { selectState: selectState, focusLocation: focusLocation, reset: resetView, debug: debug, destroy: destroy };
  }

  window.CRGMap = { init: init };
})(window);
```

#### `main.js` (prototype only)

```javascript
/**
 * main.js (Stage 1 prototype only)
 *
 * In WordPress this file is replaced by crg-map-init.js, which reads the same
 * kind of data from the page instead of from files. The map module
 * (crg-map.js) is identical in both places.
 */
(async function () {
  'use strict';

  const container = document.querySelector('.crg-map');

  function readJson(response) {
    if (!response.ok) throw new Error(response.url + ' returned ' + response.status);
    return response.json();
  }

  // ?data=hostile loads the XSS test data (see Stage 1 criterion S1-F14).
  const params = new URLSearchParams(window.location.search);
  const locationsFile = params.get('data') === 'hostile' ? 'data/locations.hostile.json' : 'data/locations.json';

  try {
    const results = await Promise.all([
      fetch('data/states-10m.json').then(readJson),
      fetch(locationsFile).then(readJson),
    ]);
    // Exposed on window so it can be driven from the browser console and from automated tests.
    window.crgMap = CRGMap.init({
      container: container,
      resetButton: document.querySelector('.crg-map-reset'),
      topology: results[0],
      locations: results[1],
    });
  } catch (error) {
    container.textContent = 'The map could not be loaded.';
    console.error(error);
  }
})();
```

#### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CRG Map Prototype</title>
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css">
  <link rel="stylesheet" href="vendor/markercluster/MarkerCluster.css">
  <link rel="stylesheet" href="vendor/markercluster/MarkerCluster.Default.css">
  <!-- Our stylesheet loads last so it can override the library defaults. -->
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Same markup structure the WordPress shortcode will output, so style.css works in both places. -->
  <div class="crg-locations">
    <div class="crg-map-wrap">
      <button type="button" class="crg-map-reset" aria-label="Reset map to national view">Reset map</button>
      <div class="crg-map" role="region" aria-label="Map of CRG operating locations"></div>
    </div>
  </div>

  <!-- Order matters: Leaflet first, then the add-on that needs it, then our code. -->
  <script src="vendor/leaflet/leaflet.js"></script>
  <script src="vendor/markercluster/leaflet.markercluster.js"></script>
  <script src="vendor/topojson-client.min.js"></script>
  <script src="crg-map.js"></script>
  <script src="main.js"></script>
</body>
</html>
```

#### `style.css` (becomes `assets/css/crg-locations.css` in WordPress)

```css
/* Map and directory styles. Scoped under .crg-locations so they cannot leak into the rest of a WordPress theme. */

.crg-locations .crg-map-wrap { position: relative; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }

/* Leaflet needs an explicit height. Without it the map collapses to zero height and nothing appears.
   A fixed height also prevents layout shift while the map loads. */
.crg-locations .crg-map { height: 560px; background: #f4f5f7; border-radius: 12px; }
@media (max-width: 640px) { .crg-locations .crg-map { height: 380px; } }

.crg-locations .crg-map-reset {
  position: absolute; top: 12px; right: 28px;
  z-index: 1000; /* above Leaflet's own layers, which top out around 700 */
  padding: 8px 14px; border: 0; border-radius: 6px;
  background: #002E4D; color: #fff; font: 600 14px/1 sans-serif; cursor: pointer;
  transition: background-color .2s ease;
}
.crg-locations .crg-map-reset:hover { background: #23447F; }
.crg-locations .crg-map-reset:focus-visible { outline: 3px solid #D6C5A8; outline-offset: 2px; }

/* Marker: a CSS circle instead of an image, so no image file can go missing. */
.crg-locations .crg-pin {
  box-sizing: border-box; border-radius: 50%;
  background: #002E4D; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .4);
}
.crg-locations .crg-pin:focus-visible { outline: 3px solid #D6C5A8; outline-offset: 2px; }

/* Cluster circles: replace the library's green, yellow and orange with brand blue. */
.crg-locations .marker-cluster-small,
.crg-locations .marker-cluster-medium,
.crg-locations .marker-cluster-large { background-color: rgba(35, 68, 127, .35); }
.crg-locations .marker-cluster-small div,
.crg-locations .marker-cluster-medium div,
.crg-locations .marker-cluster-large div { background-color: #23447F; color: #fff; }

/* Visually hidden but read by screen readers (used for the live status message). */
.crg-locations .crg-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* ----- Directory (used from Stage 2 onward) ----- */
.crg-locations .crg-dir {
  max-width: 1100px; margin: 2rem auto; padding: 0 1rem;
  display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); align-items: start;
}
.crg-locations .crg-dir__state { border: 1px solid #d9dde3; border-radius: 10px; background: #fff; }
.crg-locations .crg-dir__state > summary { cursor: pointer; padding: 14px 16px; font-weight: 700; color: #002E4D; }
.crg-locations .crg-dir__state > summary:focus-visible { outline: 3px solid #D6C5A8; outline-offset: 2px; }
.crg-locations .crg-dir__count { font-weight: 400; color: #4a5260; }
.crg-locations .crg-dir__state ul { margin: 0; padding: 0 16px 12px; list-style: none; }
.crg-locations .crg-dir__state li { display: flex; justify-content: space-between; gap: .5rem; align-items: center; padding: 8px 0; border-top: 1px solid #eef0f3; }
.crg-locations .crg-dir__state li.is-current { background: #f1efe8; margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 6px; }
.crg-locations .crg-dir__action {
  border: 1px solid #23447F; background: transparent; color: #23447F; border-radius: 6px;
  padding: 4px 10px; font: 600 13px/1.2 sans-serif; cursor: pointer;
}
.crg-locations .crg-dir__action:hover { background: #23447F; color: #fff; }
.crg-locations .crg-dir__action:focus-visible { outline: 3px solid #D6C5A8; outline-offset: 2px; }
.crg-locations .crg-dir__zoom { margin: 0 16px 8px; }

/* Directory buttons only make sense when the map script is running. */
.crg-locations:not(.crg-js) .crg-dir__action,
.crg-locations:not(.crg-js) .crg-dir__zoom { display: none; }

/* Reduced-motion requirement from the project brief. */
@media (prefers-reduced-motion: reduce) {
  .crg-locations .crg-map-reset { transition: none; }
}
```

#### `copy-vendor.js`

```javascript
// Copies only the files the browser needs out of node_modules into plain folders.
// Reason: index.html loads them with ordinary <script> and <link> tags and no bundler,
// which is exactly how WordPress will load them later.
const fs = require('fs');
const path = require('path');

const copies = [
  ['node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js'],
  ['node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css'],
  ['node_modules/leaflet.markercluster/dist/leaflet.markercluster.js', 'vendor/markercluster/leaflet.markercluster.js'],
  ['node_modules/leaflet.markercluster/dist/MarkerCluster.css', 'vendor/markercluster/MarkerCluster.css'],
  ['node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css', 'vendor/markercluster/MarkerCluster.Default.css'],
  ['node_modules/topojson-client/dist/topojson-client.min.js', 'vendor/topojson-client.min.js'],
  ['node_modules/us-atlas/states-10m.json', 'data/states-10m.json'],
];

for (const [from, to] of copies) {
  fs.mkdirSync(path.dirname(to), { recursive: true }); // create the target folder if missing
  fs.copyFileSync(from, to);
  console.log('copied', to);
}
```

#### `data/locations.json` (test data, not CRG's real list)

The three New York entries sit close together to test clustering. The District of Columbia entry tests the tiny-shape problem. Florida has three entries, two of which (Miami and Fort Lauderdale) are close enough to cluster.

```json
[
  { "id": 1, "city": "Denver", "state_code": "CO", "state_name": "Colorado", "lat": 39.7392, "lng": -104.9903, "url": "https://example.com/denver" },
  { "id": 2, "city": "Miami", "state_code": "FL", "state_name": "Florida", "lat": 25.7617, "lng": -80.1918, "url": "https://example.com/miami" },
  { "id": 3, "city": "Orlando", "state_code": "FL", "state_name": "Florida", "lat": 28.5383, "lng": -81.3792, "url": "" },
  { "id": 4, "city": "Fort Lauderdale", "state_code": "FL", "state_name": "Florida", "lat": 26.1224, "lng": -80.1373, "url": "" },
  { "id": 5, "city": "Manhattan", "state_code": "NY", "state_name": "New York", "lat": 40.7831, "lng": -73.9712, "url": "" },
  { "id": 6, "city": "Brooklyn", "state_code": "NY", "state_name": "New York", "lat": 40.6782, "lng": -73.9442, "url": "" },
  { "id": 7, "city": "Bronx", "state_code": "NY", "state_name": "New York", "lat": 40.8448, "lng": -73.8648, "url": "" },
  { "id": 8, "city": "Washington", "state_code": "DC", "state_name": "District of Columbia", "lat": 38.9072, "lng": -77.0369, "url": "" },
  { "id": 9, "city": "Austin", "state_code": "TX", "state_name": "Texas", "lat": 30.2672, "lng": -97.7431, "url": "" },
  { "id": 10, "city": "Dallas", "state_code": "TX", "state_name": "Texas", "lat": 32.7767, "lng": -96.7970, "url": "" },
  { "id": 11, "city": "Houston", "state_code": "TX", "state_name": "Texas", "lat": 29.7604, "lng": -95.3698, "url": "" }
]
```

#### `data/locations.hostile.json` (security test)

```json
[
  { "id": 901, "city": "<img src=x onerror=alert(1)>", "state_code": "UT", "state_name": "Utah", "lat": 40.7608, "lng": -111.8910, "url": "javascript:alert(1)" }
]
```

#### `playwright.config.js`

```javascript
// Starts the static server automatically and points the tests at it.
module.exports = {
  testDir: './tests',
  timeout: 30000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npx serve . -l 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // reuse the server if one is already running
  },
};
```

#### `tests/stage1.spec.js`

```javascript
// Automated checks for the Stage 1 criteria marked "Auto". Manual criteria are not covered here.
const { test, expect } = require('@playwright/test');
const locations = require('../data/locations.json');

// Waits until the map module has finished starting.
async function openPrototype(page, query) {
  await page.goto('/' + (query || ''));
  await page.waitForFunction(() => window.crgMap && window.crgMap.debug);
}

test('S1-F01: loads with no console errors, no failed requests, no external hosts', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  page.on('requestfailed', (request) => problems.push('failed: ' + request.url()));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://localhost:3000')) problems.push('external: ' + request.url());
  });
  await openPrototype(page);
  expect(problems).toEqual([]);
});

test('S1-F03: active states come from the data file only', async ({ page }) => {
  await openPrototype(page);
  const expected = [...new Set(locations.map((l) => l.state_name))].sort();
  const state = await page.evaluate(() => window.crgMap.debug());
  expect(state.activeStates).toEqual(expected);
});

test('S1-F04: no markers visible on first load', async ({ page }) => {
  await openPrototype(page);
  const state = await page.evaluate(() => window.crgMap.debug());
  expect(state.visibleGroups).toEqual([]);
  expect(await page.locator('.crg-pin, .marker-cluster').count()).toBe(0);
});

test('S1-F06 and S1-F08: selecting a state shows markers, reset hides them', async ({ page }) => {
  await openPrototype(page);
  await page.evaluate(() => window.crgMap.selectState('Florida'));
  await expect(page.locator('.crg-pin, .marker-cluster').first()).toBeVisible();
  expect((await page.evaluate(() => window.crgMap.debug())).selectedState).toBe('Florida');

  await page.click('.crg-map-reset');
  await page.waitForFunction(() => window.crgMap.debug().visibleGroups.length === 0);
  expect((await page.evaluate(() => window.crgMap.debug())).selectedState).toBe(null);
});

test('S1-F13: small states get a clickable circle', async ({ page }) => {
  await openPrototype(page);
  const state = await page.evaluate(() => window.crgMap.debug());
  expect(state.hotspotStates).toContain('District of Columbia');
});

test('S1-F14: hostile data is shown as plain text, never executed', async ({ page }) => {
  let dialogSeen = false;
  page.on('dialog', async (dialog) => { dialogSeen = true; await dialog.dismiss(); });
  await openPrototype(page, '?data=hostile');
  await page.evaluate(() => window.crgMap.focusLocation(901));
  await page.waitForSelector('.leaflet-popup-content');
  expect(await page.locator('.leaflet-popup-content img').count()).toBe(0);  // no injected element
  expect(await page.locator('.leaflet-popup-content a').count()).toBe(0);    // "javascript:" link rejected
  expect(await page.locator('.leaflet-popup-content').innerText()).toContain('<img src=x onerror=alert(1)>');
  expect(dialogSeen).toBe(false);
});

test('S1-M04: no horizontal page overflow at 390 pixels wide', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openPrototype(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

### 5.4 Success criteria (the Stage 1 gate)

**Levels:** MUST = the gate cannot pass without it. SHOULD = log the result; a failure does not block the gate.
**Methods:** Auto = covered by `npx playwright test`. Manual = follow the steps.

#### Functional

| ID | Level | Method | How to test | Pass condition |
|---|---|---|---|---|
| S1-F01 | MUST | Auto | Load the page with DevTools open | Zero console errors, zero failed requests, zero requests to any address other than localhost |
| S1-F02 | MUST | Manual | Open at 1280 pixels wide, then at 390 pixels wide (DevTools device toolbar) | The lower 48 states and the District of Columbia are fully visible and not cut off. No Alaska, Hawaii or island territories. |
| S1-F03 | MUST | Auto + Manual | Run the automated test. Then edit `locations.json`: delete all Texas entries and add one Utah entry, reload | Before: Colorado, District of Columbia, Florida, New York, Texas are dark. After: Texas is light, Utah is dark. Shading follows the data. |
| S1-F04 | MUST | Auto | Load the page, do not touch it | No markers and no clusters visible |
| S1-F05 | MUST | Manual (desktop mouse) | Hover Florida, then move away. Hover a light gray state such as Ohio | Florida turns brand blue, tooltip reads exactly "Florida: 3 locations", its markers appear; moving away restores gray and hides them. Ohio: nothing changes, no tooltip, normal arrow cursor. |
| S1-F06 | MUST | Auto + Manual | Click Texas | Map zooms to fit Texas (within one second, instantly under reduced motion). Texas stays blue after the pointer leaves. Its three markers stay visible. Mouse wheel now zooms the map. |
| S1-F07 | MUST | Manual | With Texas selected, zoom out with the minus button until Florida is visible, click Florida | Texas returns to gray and its markers disappear. Florida becomes the selection. |
| S1-F08 | MUST | Auto + Manual | Select any state, open a popup, press Reset map | National view returns, all markers hidden, highlight cleared, popup closed, mouse wheel scrolls the page again |
| S1-F09 | MUST | Manual | Use the plus and minus buttons from the national view | Minus cannot zoom out beyond the national view. Plus can reach a level where Manhattan, Brooklyn and Bronx show as three separate pins. |
| S1-F10 | MUST | Manual | From the national view with no state selected, press plus twice, then zoom back out | After two presses, markers or clusters appear for active states in view. Zooming back out to the national view hides them. |
| S1-F11 | MUST | Manual | Select Colorado, click the Denver pin. Select Florida, click the Orlando pin | Denver popup: "Denver, Colorado" plus a "Visit location website" link that opens the example address in a new tab. Orlando popup: "Orlando, Florida" and no link. |
| S1-F12 | MUST | Manual | Select New York. Select Florida | New York: one circle numbered 3 that splits when clicked or zoomed. Florida: Miami and Fort Lauderdale merge into one circle numbered 2 at the state view and split on zoom. |
| S1-F13 | MUST | Auto + Manual | At the national view, hover then click the small circle on the District of Columbia | Hover highlights it and shows "District of Columbia: 1 location". Click zooms in and shows the Washington pin. Works at the first attempt without precise aiming. |
| S1-F14 | MUST | Auto | Open `http://localhost:3000/?data=hostile` and run the automated test | The text `<img src=x onerror=alert(1)>` appears as plain text in the popup, no image element is created, the `javascript:` link is not rendered, and no alert box appears |
| S1-F15 | MUST | Manual | Run: `grep -n -i -e colorado -e florida -e texas -e "new york" -e columbia -e denver -e miami crg-map.js` | No output (the command exits with code 1). The module contains no place names. |

#### Mobile

| ID | Level | Method | How to test | Pass condition |
|---|---|---|---|---|
| S1-M01 | MUST | Manual | Chrome DevTools device toolbar, choose a phone, touch emulation on. Swipe one finger up and down starting on the map before selecting anything | The page scrolls. The map does not move. |
| S1-M02 | MUST | Manual | Same setup. Tap Florida | Florida selects: zoom, highlight, markers |
| S1-M03 | MUST | Manual | Same setup, after selecting. Drag with one finger, then press Reset map, then swipe over the map again | After selecting, one-finger drag pans the map. After Reset, swiping over the map scrolls the page again. |
| S1-M04 | MUST | Auto | Run the automated test (390 pixel viewport) | The page does not scroll sideways |
| S1-M05 | MUST | Manual, real phone | Run `npx serve . -l 3000`. Note the "Network" address it prints. On a phone on the same Wi-Fi, open that address. Repeat S1-M01 to S1-M03 | All three pass on a real iPhone or Android phone. (If a firewall prompt appears on the computer, allow Node.js.) Device emulation does not reproduce touch scrolling faithfully, which is why this is a MUST. |

#### Accessibility

| ID | Level | Method | How to test | Pass condition |
|---|---|---|---|---|
| S1-A01 | MUST | Manual | Press Tab until the Reset map button is focused; press Enter and Space | A visible outline shows on focus. Both keys reset the map. |
| S1-A02 | MUST | Manual | Chrome DevTools, Rendering tab, set "Emulate CSS media feature prefers-reduced-motion" to reduce. Repeat S1-F06 and S1-F08 | Zoom and cluster changes happen without animation. All results are identical. |
| S1-A03 | MUST | Manual | Select Florida. Press Tab until a pin is focused. Press Enter | The pin shows a visible outline. Enter opens its popup. |
| S1-A04 | SHOULD | Manual | DevTools contrast checker on the Reset button and the popup text | Contrast ratio at least 4.5 to 1 |

#### Performance

| ID | Level | Method | How to test | Pass condition |
|---|---|---|---|---|
| S1-P01 | SHOULD | Manual | DevTools Network tab, "Disable cache" ticked, reload | Total transferred under 450 KB. (Measured library and data files total about 313 KB uncompressed; the page's own code adds roughly 20 KB.) |
| S1-P02 | SHOULD | Manual | Lighthouse (Chrome DevTools), desktop mode | Performance score at least 90 and Cumulative Layout Shift below 0.1 |
| S1-P03 | SHOULD | Manual | Sweep the pointer quickly across all dark states | No visible lag or flicker on a mid-range laptop |

#### Review

| ID | Level | Method | How to test | Pass condition |
|---|---|---|---|---|
| S1-R01 | MUST | Manual | Run: `node --check crg-map.js` | No output (no syntax errors) |
| S1-R02 | SHOULD | Manual | Send Tommy three screenshots: national view, a selected state, the phone view | Written feedback on the look (especially the Web Mercator shape of the country) before Stage 3 |

### 5.5 Gate rule and results template

**Gate:** Stage 1 passes when every MUST criterion is Pass. A MUST can only be Waived by Ahmad, in writing, with a reason recorded in the results file. Every failed SHOULD is logged with a note.

**Fallback trigger:** if S1-F05, S1-F06, S1-F08, S1-M01, S1-M02 or S1-M03 still cannot pass after two further working days of debugging, stop. Write a short note with evidence and review the fallback: drawing the map with D3 and plain SVG (better-looking US projection, but zoom, pan, popups and clustering must then be built by hand). Do not continue to Stage 2 with a map that fails these.

**What Stage 1 does NOT prove:** WordPress or Elementor integration, behaviour with caching and optimization plugins, the dashboard workflow, and directory linking. Those are Stage 2 to 5 gates.

**Deliverables:** the repository, `STAGE1_RESULTS.md`, three screenshots, git tag `stage-1-passed`.

`STAGE1_RESULTS.md` template:

```markdown
# Stage 1 Results
Date: 
Tested by: 
Browser and version: 
Phone model and browser: 

| ID | Result (Pass, Fail, Waived) | Evidence or note |
|---|---|---|
| S1-F01 | | |
(one row for every ID in section 5.4)

## Deviations from the plan
## Problems found and how they were fixed
## Open questions for Tommy
```

---

## 6. Stages 2 to 6

### Stage 2: WordPress data layer (on Local by Flywheel)

**Goal:** locations live in the WordPress dashboard and the shortcode outputs a correct directory plus a data block.

**Tasks**
1. Create the plugin folder `crg-locations` inside `wp-content/plugins/` of the Local site. Add `crg-locations.php` (below).
2. Turn on error logging in `wp-config.php`: `define('WP_DEBUG', true); define('WP_DEBUG_LOG', true); define('WP_DEBUG_DISPLAY', false);` (errors go to `wp-content/debug.log`, not onto the page).
3. Install and activate the free Advanced Custom Fields plugin if it is not already active. Check whether Phase 1 already identified a version in use.
4. Activate CRG Locations. A "Locations" item appears in the dashboard menu.
5. Create `tools/seed-locations.php` and `tools/seed-locations.json` (the same JSON as Stage 1 `locations.json`). Run: `wp eval-file wp-content/plugins/crg-locations/tools/seed-locations.php` (from the WordPress folder; Local's "Open site shell" button provides a terminal with WP-CLI).
6. Create a test page with a Shortcode widget containing `[crg_locations]` and view it.

**Files**

#### `crg-locations.php`

```php
<?php
/**
 * Plugin Name: CRG Locations
 * Description: Location data, directory and map shortcode for crgfranchise.com
 * Version: 0.1.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Block direct access to this file.
}

const CRG_LOC_CPT     = 'crg_location';
const CRG_LOC_CACHE   = 'crg_locations_v1';
const CRG_LOC_VERSION = '0.1.0';

/**
 * State code => full name. The full name is sent to the browser because it is
 * matched against the "name" property of the boundary file. DC is included on purpose.
 */
function crg_us_states(): array {
	return [
		'AL' => 'Alabama', 'AK' => 'Alaska', 'AZ' => 'Arizona', 'AR' => 'Arkansas',
		'CA' => 'California', 'CO' => 'Colorado', 'CT' => 'Connecticut', 'DE' => 'Delaware',
		'DC' => 'District of Columbia', 'FL' => 'Florida', 'GA' => 'Georgia', 'HI' => 'Hawaii',
		'ID' => 'Idaho', 'IL' => 'Illinois', 'IN' => 'Indiana', 'IA' => 'Iowa',
		'KS' => 'Kansas', 'KY' => 'Kentucky', 'LA' => 'Louisiana', 'ME' => 'Maine',
		'MD' => 'Maryland', 'MA' => 'Massachusetts', 'MI' => 'Michigan', 'MN' => 'Minnesota',
		'MS' => 'Mississippi', 'MO' => 'Missouri', 'MT' => 'Montana', 'NE' => 'Nebraska',
		'NV' => 'Nevada', 'NH' => 'New Hampshire', 'NJ' => 'New Jersey', 'NM' => 'New Mexico',
		'NY' => 'New York', 'NC' => 'North Carolina', 'ND' => 'North Dakota', 'OH' => 'Ohio',
		'OK' => 'Oklahoma', 'OR' => 'Oregon', 'PA' => 'Pennsylvania', 'RI' => 'Rhode Island',
		'SC' => 'South Carolina', 'SD' => 'South Dakota', 'TN' => 'Tennessee', 'TX' => 'Texas',
		'UT' => 'Utah', 'VT' => 'Vermont', 'VA' => 'Virginia', 'WA' => 'Washington',
		'WV' => 'West Virginia', 'WI' => 'Wisconsin', 'WY' => 'Wyoming',
	];
}

/**
 * Custom Post Type registered in code so it travels with the plugin.
 * public=false: no front-end address, no archive page, nothing for search engines to index.
 */
add_action( 'init', function () {
	register_post_type( CRG_LOC_CPT, [
		'labels'              => [
			'name'          => 'Locations',
			'singular_name' => 'Location',
			'add_new_item'  => 'Add Location',
			'edit_item'     => 'Edit Location',
			'all_items'     => 'All Locations',
		],
		'public'              => false,
		'show_ui'             => true,
		'show_in_rest'        => false,
		'exclude_from_search' => true,
		'has_archive'         => false,
		'menu_icon'           => 'dashicons-location-alt',
		'supports'            => [ 'title' ],
	] );
} );

/**
 * Advanced Custom Fields group registered in code, so it is identical on Local,
 * staging and live. Plain number fields hold coordinates: ACF's own map field
 * would need a paid Google Maps key.
 */
add_action( 'acf/init', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}
	acf_add_local_field_group( [
		'key'      => 'group_crg_location',
		'title'    => 'Location Details',
		'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => CRG_LOC_CPT ] ] ],
		'fields'   => [
			[ 'key' => 'field_crg_city', 'label' => 'City or Market', 'name' => 'city', 'type' => 'text', 'required' => 1,
			  'instructions' => 'Display name. For service areas use the area name, for example "Brooklyn & Queens".' ],
			[ 'key' => 'field_crg_state', 'label' => 'State', 'name' => 'state', 'type' => 'select', 'required' => 1,
			  'choices' => crg_us_states(), 'ui' => 1, 'return_format' => 'value' ],
			// min and max are bound to US territory so a missing minus sign is rejected at entry.
			[ 'key' => 'field_crg_lat', 'label' => 'Latitude', 'name' => 'latitude', 'type' => 'number', 'required' => 1,
			  'min' => 15, 'max' => 72, 'step' => 'any', 'instructions' => 'Positive number, for example 39.7392.' ],
			[ 'key' => 'field_crg_lng', 'label' => 'Longitude', 'name' => 'longitude', 'type' => 'number', 'required' => 1,
			  'min' => -180, 'max' => -60, 'step' => 'any', 'instructions' => 'Negative number, for example -104.9903.' ],
			[ 'key' => 'field_crg_url', 'label' => 'Location Website', 'name' => 'website_url', 'type' => 'url' ],
			[ 'key' => 'field_crg_active', 'label' => 'Active', 'name' => 'is_active', 'type' => 'true_false',
			  'default_value' => 1, 'ui' => 1 ],
		],
	] );
} );

/**
 * The single read path for both the map and the directory.
 * Cached in a transient because the data changes rarely and is read on every page view.
 */
function crg_get_locations(): array {
	$cached = get_transient( CRG_LOC_CACHE );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$states = crg_us_states();
	$query  = new WP_Query( [
		'post_type'      => CRG_LOC_CPT,
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'no_found_rows'  => true, // skip the COUNT query: pagination is not used
		'meta_query'     => [ [ 'key' => 'is_active', 'value' => '1' ] ],
	] );

	$out = [];
	foreach ( $query->posts as $post ) {
		$code = get_field( 'state', $post->ID );
		$lat  = get_field( 'latitude', $post->ID );
		$lng  = get_field( 'longitude', $post->ID );

		// An incomplete record must never break the map: skip it silently.
		if ( ! is_string( $code ) || ! isset( $states[ $code ] ) || ! is_numeric( $lat ) || ! is_numeric( $lng ) ) {
			continue;
		}

		$out[] = [
			'id'         => (int) $post->ID,
			'city'       => (string) get_field( 'city', $post->ID ),
			'state_code' => $code,
			'state_name' => $states[ $code ],
			'lat'        => (float) $lat,
			'lng'        => (float) $lng,
			'url'        => (string) get_field( 'website_url', $post->ID ),
		];
	}

	// Alphabetical by state, then by city, as the project brief requires.
	usort( $out, function ( $a, $b ) {
		return [ $a['state_name'], $a['city'] ] <=> [ $b['state_name'], $b['city'] ];
	} );

	set_transient( CRG_LOC_CACHE, $out, DAY_IN_SECONDS );
	return $out;
}

/**
 * Cache invalidation. ACF writes its fields during the save, so hook acf/save_post
 * at priority 20 to run after the fields are stored. Trash, restore and delete do
 * not go through ACF, so they get their own hooks.
 */
function crg_flush_locations_cache( $post_id ): void {
	if ( CRG_LOC_CPT === get_post_type( $post_id ) ) {
		delete_transient( CRG_LOC_CACHE );
	}
}
add_action( 'acf/save_post', 'crg_flush_locations_cache', 20 );
add_action( 'trashed_post', 'crg_flush_locations_cache' );
add_action( 'untrashed_post', 'crg_flush_locations_cache' );
add_action( 'before_delete_post', 'crg_flush_locations_cache' );

/** True while an administrator is inside the Elementor editor or its preview frame. */
function crg_is_elementor_editor(): bool {
	if ( ! class_exists( '\Elementor\Plugin' ) ) {
		return false;
	}
	$elementor = \Elementor\Plugin::$instance;
	return ( isset( $elementor->editor ) && $elementor->editor->is_edit_mode() )
		|| ( isset( $elementor->preview ) && $elementor->preview->is_preview_mode() );
}

/**
 * Loads map assets. Called from inside the shortcode, not from a global hook, because
 * Elementor stores page content outside post_content, so has_shortcode() cannot detect it.
 */
function crg_enqueue_map_assets(): void {
	$base = plugin_dir_url( __FILE__ ) . 'assets/';

	wp_enqueue_style( 'crg-leaflet', $base . 'vendor/leaflet/leaflet.css', [], '1.9.4' );
	wp_enqueue_style( 'crg-markercluster', $base . 'vendor/markercluster/MarkerCluster.css', [ 'crg-leaflet' ], '1.5.3' );
	wp_enqueue_style( 'crg-markercluster-default', $base . 'vendor/markercluster/MarkerCluster.Default.css', [ 'crg-markercluster' ], '1.5.3' );
	wp_enqueue_style( 'crg-locations', $base . 'css/crg-locations.css', [ 'crg-markercluster-default' ], CRG_LOC_VERSION );

	// Last argument true = print in the footer so the page content renders first.
	wp_enqueue_script( 'crg-leaflet', $base . 'vendor/leaflet/leaflet.js', [], '1.9.4', true );
	wp_enqueue_script( 'crg-markercluster', $base . 'vendor/markercluster/leaflet.markercluster.js', [ 'crg-leaflet' ], '1.5.3', true );
	wp_enqueue_script( 'crg-topojson', $base . 'vendor/topojson-client.min.js', [], '3.1.0', true );
	wp_enqueue_script( 'crg-map', $base . 'js/crg-map.js', [ 'crg-leaflet', 'crg-markercluster', 'crg-topojson' ], CRG_LOC_VERSION, true );
	wp_enqueue_script( 'crg-map-init', $base . 'js/crg-map-init.js', [ 'crg-map' ], CRG_LOC_VERSION, true );

	// Tells the init script where the boundary file lives.
	wp_add_inline_script(
		'crg-map-init',
		'window.CRG_MAP_CONFIG = ' . wp_json_encode( [ 'topologyUrl' => $base . 'data/states-10m.json' ] ) . ';',
		'before'
	);
}

/**
 * [crg_locations] outputs the map, the directory (works with JavaScript off) and the
 * JSON the map script reads. Limit: one instance per page, because of the fixed JSON element id.
 */
add_shortcode( 'crg_locations', function () {
	$locations = crg_get_locations();
	if ( empty( $locations ) ) {
		return '';
	}

	$in_editor = crg_is_elementor_editor();
	if ( ! $in_editor ) {
		crg_enqueue_map_assets();
	}

	// Group by state. Order is already alphabetical from crg_get_locations().
	$grouped = [];
	foreach ( $locations as $location ) {
		$grouped[ $location['state_name'] ]['items'][] = $location;
	}

	ob_start();
	?>
	<div class="crg-locations">
		<div class="crg-map-wrap">
			<?php if ( $in_editor ) : ?>
				<div class="crg-map" role="img" aria-label="Map placeholder">
					<p style="padding:1rem">The interactive map is hidden inside the Elementor editor. View the page to see it.</p>
				</div>
			<?php else : ?>
				<button type="button" class="crg-map-reset" aria-label="Reset map to national view">Reset map</button>
				<div class="crg-map" role="region" aria-label="Map of CRG operating locations"></div>
			<?php endif; ?>
		</div>
		<p class="crg-map-status crg-visually-hidden" aria-live="polite"></p>

		<section class="crg-dir" aria-label="CRG locations by state">
			<?php foreach ( $grouped as $state_name => $state ) : ?>
				<details class="crg-dir__state" data-state-name="<?php echo esc_attr( $state_name ); ?>">
					<summary>
						<?php echo esc_html( $state_name ); ?>
						<span class="crg-dir__count">(<?php echo count( $state['items'] ); ?>)</span>
					</summary>
					<p class="crg-dir__zoom">
						<button type="button" class="crg-dir__action" data-action="zoom-state" data-state-name="<?php echo esc_attr( $state_name ); ?>">
							Zoom map to <?php echo esc_html( $state_name ); ?>
						</button>
					</p>
					<ul>
						<?php foreach ( $state['items'] as $location ) : ?>
							<li data-loc-id="<?php echo esc_attr( $location['id'] ); ?>">
								<?php if ( $location['url'] ) : ?>
									<a href="<?php echo esc_url( $location['url'] ); ?>" rel="noopener"><?php echo esc_html( $location['city'] ); ?></a>
								<?php else : ?>
									<span><?php echo esc_html( $location['city'] ); ?></span>
								<?php endif; ?>
								<button type="button" class="crg-dir__action" data-action="show-location" data-loc-id="<?php echo esc_attr( $location['id'] ); ?>"
									aria-label="Show <?php echo esc_attr( $location['city'] . ', ' . $location['state_name'] ); ?> on the map">
									Show on map
								</button>
							</li>
						<?php endforeach; ?>
					</ul>
				</details>
			<?php endforeach; ?>
		</section>

		<?php if ( ! $in_editor ) : ?>
			<?php // The HEX flags escape <, > and & so location text can never close this script tag. ?>
			<script type="application/json" id="crg-locations-data"><?php echo wp_json_encode( $locations, JSON_HEX_TAG | JSON_HEX_AMP ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></script>
		<?php endif; ?>
	</div>
	<?php
	return ob_get_clean();
} );
```

#### `tools/seed-locations.php` (development only)

```php
<?php
/**
 * One-off development tool. NOT shipped to staging or live.
 * Run on Local only, from the WordPress folder:
 *   wp eval-file wp-content/plugins/crg-locations/tools/seed-locations.php
 * Reads tools/seed-locations.json (same shape as the Stage 1 data/locations.json).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Refuse to run twice so test data is never duplicated.
if ( (int) wp_count_posts( CRG_LOC_CPT )->publish > 0 ) {
	WP_CLI::error( 'Locations already exist. Delete them first if you want to reseed.' );
}

$rows = json_decode( file_get_contents( __DIR__ . '/seed-locations.json' ), true );
if ( ! is_array( $rows ) ) {
	WP_CLI::error( 'seed-locations.json is missing or is not valid JSON.' );
}

foreach ( $rows as $row ) {
	$post_id = wp_insert_post( [
		'post_type'   => CRG_LOC_CPT,
		'post_status' => 'publish',
		'post_title'  => $row['city'] . ', ' . $row['state_code'],
	] );
	// Field KEYS (not names) are used so ACF also stores its internal field reference.
	update_field( 'field_crg_city', $row['city'], $post_id );
	update_field( 'field_crg_state', $row['state_code'], $post_id );
	update_field( 'field_crg_lat', $row['lat'], $post_id );
	update_field( 'field_crg_lng', $row['lng'], $post_id );
	update_field( 'field_crg_url', $row['url'], $post_id );
	update_field( 'field_crg_active', 1, $post_id );
}

// update_field() does not trigger the cache flush hook, so flush by hand.
delete_transient( CRG_LOC_CACHE );
WP_CLI::success( count( $rows ) . ' locations created.' );
```

**Gate**

| ID | Level | How to test | Pass condition |
|---|---|---|---|
| S2-01 | MUST | Activate the plugin with debugging on, then open `debug.log` | No PHP warnings or notices from `crg-locations` |
| S2-02 | MUST | Open Locations, Add Location | Fields: City or Market, State, Latitude, Longitude, Location Website, Active. State list has 51 entries (50 states and DC). Latitude 99 and longitude 104 are rejected. |
| S2-03 | MUST | View the test page | Directory shows states alphabetically with cities alphabetically inside, counts correct, website links present only where a link exists |
| S2-04 | MUST | Switch a location off, then trash it, then restore it, then delete it permanently. Reload the page each time | The directory and the JSON block (View Source, search `crg-locations-data`) match each change on the next reload |
| S2-05 | MUST | Visit `/?post_type=crg_location` and check the XML sitemap if one exists | No public page and no sitemap entry for location records |
| S2-06 | MUST | Compare the JSON block with Stage 1 `locations.json` after seeding | Same cities, states and coordinates (ids differ) |
| S2-07 | MUST | Create a location named `<script>alert(1)</script>` | Shown as plain text in the directory, no alert, the JSON block still parses |
| S2-08 | MUST | Add a location with no latitude (leave it blank if the field allows, or edit the database value) | The record is skipped silently, nothing breaks |

### Stage 3: Map inside Elementor

**Goal:** the Stage 1 map runs on a WordPress page with the same behaviour.

**Tasks**
1. Copy the Stage 1 files into the plugin (run from the prototype folder, adjust the destination path):

```bash
PLUGIN=/path/to/local-site/app/public/wp-content/plugins/crg-locations
mkdir -p "$PLUGIN/assets/css" "$PLUGIN/assets/js" "$PLUGIN/assets/data" "$PLUGIN/assets/vendor"
cp style.css "$PLUGIN/assets/css/crg-locations.css"
cp crg-map.js "$PLUGIN/assets/js/crg-map.js"
cp -r vendor/* "$PLUGIN/assets/vendor/"
cp data/states-10m.json "$PLUGIN/assets/data/states-10m.json"
```

2. Add `assets/js/crg-map-init.js` (below).
3. Reload the Elementor test page logged out (private window).
4. Open the page in the Elementor editor.
5. Repeat the whole Stage 1 functional, mobile and accessibility checklist on this page (a regression run).

#### `assets/js/crg-map-init.js`

```javascript
/**
 * crg-map-init.js (WordPress only)
 *
 * Connects three things: the map module (crg-map.js), the server-rendered
 * directory, and the JSON data block the shortcode prints.
 * Replaces main.js from the Stage 1 prototype.
 */
(function () {
  'use strict';

  const root = document.querySelector('.crg-locations');
  const dataNode = document.getElementById('crg-locations-data');
  if (!root || !dataNode || !window.CRGMap || !window.CRG_MAP_CONFIG) return;

  // Directory buttons are hidden by CSS until this class is present, so visitors
  // without working JavaScript never see buttons that do nothing.
  root.classList.add('crg-js');

  const mapNode = root.querySelector('.crg-map');
  const resetButton = root.querySelector('.crg-map-reset');
  const statusNode = root.querySelector('.crg-map-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let locations;
  try {
    locations = JSON.parse(dataNode.textContent);
  } catch (error) {
    console.error('CRG map: location data is not valid JSON', error);
    return;
  }

  // ---------- Directory helpers ----------
  function openStateSection(name) {
    const section = root.querySelector('.crg-dir__state[data-state-name="' + CSS.escape(name) + '"]');
    if (section) section.open = true;
  }

  function setCurrentCity(id) {
    root.querySelectorAll('.crg-dir li.is-current').forEach(function (item) {
      item.classList.remove('is-current');
      item.removeAttribute('aria-current');
    });
    if (id === null) return;
    const item = root.querySelector('.crg-dir li[data-loc-id="' + id + '"]');
    if (!item) return;
    item.classList.add('is-current');
    item.setAttribute('aria-current', 'true');
    const section = item.closest('details');
    if (section) section.open = true;
  }

  function announce(message) {
    if (statusNode) statusNode.textContent = message; // read aloud by screen readers
  }

  // ---------- Start ----------
  fetch(window.CRG_MAP_CONFIG.topologyUrl)
    .then(function (response) {
      if (!response.ok) throw new Error('Boundary file returned ' + response.status);
      return response.json();
    })
    .then(function (topology) {
      const api = CRGMap.init({
        container: mapNode,
        resetButton: resetButton,
        topology: topology,
        locations: locations,
        onStateChange: function (name) {
          openStateSection(name);
          setCurrentCity(null);
          const count = locations.filter(function (l) { return l.state_name === name; }).length;
          announce(name + ' selected, ' + count + (count === 1 ? ' location' : ' locations'));
        },
        onMarkerSelect: function (id) {
          setCurrentCity(id);
        },
      });

      // One listener for every directory button (event delegation).
      root.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        if (button.dataset.action === 'zoom-state') api.selectState(button.dataset.stateName);
        if (button.dataset.action === 'show-location') api.focusLocation(Number(button.dataset.locId));
        // The directory sits below the map, so bring the map into view after a directory click.
        mapNode.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    })
    .catch(function (error) {
      root.classList.remove('crg-js');
      mapNode.textContent = 'The map could not be loaded. The directory below lists every location.';
      console.error('CRG map:', error);
    });
})();
```

**Gate**

| ID | Level | How to test | Pass condition |
|---|---|---|---|
| S3-01 | MUST | View the page logged out | Map renders, zero console errors |
| S3-02 | MUST | Open the page in the Elementor editor | Editor loads, the widget shows the placeholder text, no JavaScript errors in the console |
| S3-03 | MUST | Open a page without the shortcode, check the Network tab | No Leaflet, marker cluster, topojson or map files requested |
| S3-04 | MUST | Re-run S1-F01, S1-F02, S1-F04 to S1-F13, S1-M01 to S1-M03 and S1-A01 to S1-A03 on the WordPress page (S1-F03 and S1-F14 are replaced by S2-04 and S2-07, because data now comes from the dashboard) | All pass |
| S3-05 | MUST | Switch off every active location | The shortcode prints nothing and nothing errors |
| S3-06 | SHOULD | Network tab | Total weight within 450 KB plus the theme's normal weight |

### Stage 4: Directory and map linking

The code for linking is already in `crg-map-init.js` and the shortcode markup. This stage is a testing and fixing stage.

**Design decisions:** a button inside each state section ("Zoom map to Florida") and a "Show on map" button beside each city. The state name and city name themselves are not buttons, so website links stay normal links. The page does not scroll by itself when a marker is clicked, because that would fight the visitor on a phone. It does scroll the map into view after a directory button is pressed, because the map sits above the directory.

**Gate**

| ID | Level | How to test | Pass condition |
|---|---|---|---|
| S4-01 | MUST | Press "Zoom map to Florida" | Map zooms to Florida with markers, the state section is open, the hidden status line reads "Florida selected, 3 locations" (check in DevTools) |
| S4-02 | MUST | Press "Show on map" beside Orlando | Map moves to Florida, Orlando's popup opens |
| S4-03 | MUST | Click a marker on the map | Its city in the directory is highlighted, has `aria-current="true"`, and its state section opens |
| S4-04 | MUST | Phone: press "Show on map" far down the directory | The map scrolls into view |
| S4-05 | MUST | Turn JavaScript off (DevTools, Command menu, "Disable JavaScript"), reload | Directory fully readable, website links work, no dead buttons visible |
| S4-06 | MUST | Keyboard only | Every directory button reachable with Tab, activates with Enter, focus stays on the pressed button |
| S4-07 | MUST | Add a location in the dashboard, reload the page | New city appears in the directory and on the map with no code edits |

### Stage 5: Hardening on staging

**Tasks:** install the plugin on novacoreeng.com, then:

- Test with the caching and optimization plugins active on staging (see the Phase 1 audit for the list). If the map breaks, exclude `crg-map.js`, `crg-map-init.js` and the vendor files from JavaScript minify, combine, delay and defer settings.
- Test in the latest Chrome, Firefox, Edge, Safari (desktop), Safari on iPhone and Chrome on Android.
- Test with 0, 1 and 100 locations (generate 100 with the seed script and random US coordinates, then delete them).

**Gate**

| ID | Level | Pass condition |
|---|---|---|
| S5-01 | MUST | All S3 and S4 checks pass on staging with optimization plugins enabled |
| S5-02 | MUST | All S1-M checks pass on a real phone against the staging address |
| S5-03 | MUST | Zero console errors on every tested browser |
| S5-04 | MUST | Lighthouse accessibility score at least 90 on the page, with no failed contrast checks in the map area |
| S5-05 | MUST | With 100 locations, hover and click stay smooth and the directory stays usable |
| S5-06 | SHOULD | Lighthouse performance not more than 5 points below the same page without the shortcode |
| S5-07 | MUST | Staging still has indexing disabled |

### Stage 6: Staging release, documentation and report

**Tasks**
1. Build the real location list in a sheet with these columns: display name, state, latitude, longitude, location website, source address, confirmed by EPIC Vision (yes or no). Start from cleanestrestaurant.com/locations. That site has known inconsistencies (a wrong link, a location missing from the menu, typos), so **nothing is published until EPIC Vision confirms the list.**
2. Find coordinates for free: open Google Maps, right-click the place, click the coordinates at the top of the menu to copy them. Latitude is the first number and is positive. Longitude is the second and is negative. Service areas (for example Brooklyn & Queens) get one representative point.
3. Enter confirmed locations in the dashboard.
4. Place the map and directory on the Territories page or a new Our Locations page (Tommy decides, section 7). Add the heading wording that states these are current operating locations, and check the page does not imply that mapped markets are available for purchase. Leave the existing Available Territories content untouched.
5. Write the admin guide: add, edit, switch off, delete a location; finding coordinates; what to do if the map is blank. Include screenshots.
6. Send Tommy: the staging link, the Stage 1 and Stage 5 results, the admin guide, the location list for confirmation, and the re-estimate for Phases 5 and 6.

**Gate**

| ID | Level | Pass condition |
|---|---|---|
| S6-01 | MUST | EPIC Vision has confirmed the location list in writing |
| S6-02 | MUST | A person who has never seen the plugin can add, edit and switch off a location using only the admin guide |
| S6-03 | MUST | The page wording does not imply that mapped markets are available franchise territories |
| S6-04 | MUST | Tommy has reviewed the staging page and his feedback is recorded |
| S6-05 | MUST | The plugin and the location data have a documented path to the live site at launch (plugin upload, then export and import of Locations; verify the export includes Location records and their field values before relying on it) |

---

## 7. Open decisions (defaults chosen so work is not blocked)

| # | Decision | Default used | Who decides |
|---|---|---|---|
| 1 | Marker visibility on manual zoom | The brief says markers appear when a visitor interacts with a state "or zooms in". Implemented: markers for all active states appear after zooming in 1.5 levels from the national view. | Tommy, if he wants a different level |
| 2 | Look of the country shape (Web Mercator) | Accepted for version 1, shown in S1-R02 screenshots | Tommy |
| 3 | Alaska, Hawaii, territories | Not shown in version 1 | Tommy, only if CRG opens there |
| 4 | Coordinates for service areas | One representative point per area | Tommy to confirm area wording |
| 5 | Final active location list | Stage 6 gate S6-01 | EPIC Vision |
| 6 | Page placement | Territories page or Our Locations page, plus a smaller homepage preview later | Tommy |
| 7 | Street-level base map | Not used | Tommy (any paid tile service needs approval) |

---

## 8. Agent rules

**Process**
- Read this whole file before writing anything. Work one stage at a time. At each gate, write the results file and stop.
- Do not mark a criterion Pass without evidence. Paste command output or name the screenshot.
- If a command fails, report the exact error text. Do not guess a fix silently.
- Commit after every task with the message format `Stage <n>: <what changed>`.
- Do not start the next stage until Ahmad confirms.

**Scope and safety**
- Work only on the prototype folder, Local, and staging (novacoreeng.com). Never touch the live site.
- Do not change the staging site's indexing setting.
- Do not edit the existing Available Territories content.
- Add no dependency beyond the list in Task 1.1 without Ahmad's approval. No paid service, no CDN, no jQuery.
- Add no place names to `crg-map.js`. Keep WordPress code out of `crg-map.js` and map logic out of `crg-map-init.js`.

**Code**
- Browser code: plain JavaScript (ES2018), no build step, no `eval`, no `innerHTML` with data. Build text with `textContent`.
- PHP: WordPress coding standards. Escape every output with `esc_html`, `esc_attr`, `esc_url`. JSON in a script block uses `wp_json_encode` with `JSON_HEX_TAG | JSON_HEX_AMP`. No direct SQL.
- Comment the reason for each non-obvious choice, as the code in this file does.

**Communication with Ahmad**
- Concise and direct. No praise, no filler, no em-dashes.
- Use full names (write Custom Post Type, not an abbreviation) and explain geography and map terms in plain language the first time they appear.
- Give exact steps and exact commands. Logic first, then the steps.
- Separate what was verified from what is assumed.

---

## 9. Risk register

| Risk | Likelihood | Effect | Handling |
|---|---|---|---|
| Hover and click behave badly on touch devices | Medium | Mobile requirement fails | Stage 1 real-phone gate (S1-M05) before any WordPress work |
| Optimization plugins break map scripts | Medium | Blank map on staging | Stage 5 test; exclude map files from script optimization |
| Elementor editor breaks when the map starts inside it | Medium | Page cannot be edited | Placeholder in editor mode; S3-02 |
| Web Mercator shape displeases the client | Low | Rework request | Screenshots to Tommy at Stage 1 (S1-R02); fallback is D3 |
| Tiny states hard to click | Medium | Poor usability | Size-based clickable circles; S1-F13 |
| Location data errors (wrong sign, swapped values) | Medium | Marker in the wrong place | Field limits in ACF; S2-02 |
| Consumer site list is inconsistent | High | Wrong public data | Gate S6-01 before publication |
| Wording implies territories are for sale | Medium | Franchise compliance concern | Wording check S6-03; do not touch Territories content |
| Code in this file has bugs (never run in a browser) | High | Small delays | Stage 1 exists to find them cheaply |

---

## 10. Requirements traceability (project brief to this plan)

| Brief section | Requirement | Covered by |
|---|---|---|
| 5.1 | Initial appearance, active and inactive shading, no clutter | S1-F02, S1-F03, S1-F04 |
| 5.2 | State hover | S1-F05 |
| 5.3 | Click to zoom, reset | S1-F06, S1-F07, S1-F08 |
| 5.4 | Markers, popups, clustering | S1-F11, S1-F12 |
| 5.5 | Zoom controls | S1-F09, S1-F10 |
| 5.6 | Mobile | S1-M01 to S1-M05 |
| 5.7 | WordPress-managed locations | S2-02, S2-04, S4-07 |
| 5.8 | Technology without paid services | Section 3.4 |
| 5.9 | Existing locations versus available territories | Section 1.4, S6-03 |
| 5.10 | Placement | Section 7, decision 6 |
| 6 | Directory design, alphabetical, collapsible, links | S2-03 |
| 6 | Interactive connection between directory and map | S4-01 to S4-03 |
| 6 | One shared data source | Section 3.1, S2-06 |
| 12 | Accessibility | S1-A01 to S1-A04, S4-05, S4-06, S5-04 |
| 12 | Performance | S1-P01 to S1-P03, S3-06, S5-06 |
| 12 | SEO and no indexing of staging | S2-05, S5-07 |
