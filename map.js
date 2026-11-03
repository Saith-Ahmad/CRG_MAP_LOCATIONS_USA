(function (window) {
  'use strict';

  // Brand colors. Dark gray for states with locations, light gray for the rest.
  const COLORS = { activeFill: '#7b828c', inactiveFill: '#dfe2e6', border: '#ffffff', highlight: '#23447F' };

  // Version 1 shows only the lower 48 states plus DC. The census file also contains
  // outlying areas; they are dropped by coordinates (never by name) using this
  // rectangle around the main map area: [[south, west], [north, east]].
  const CONTINENTAL_BOUNDS = { south: 23, west: -126, north: 50.6, east: -66 };

  // Rough rectangle around the main map area: [[south, west], [north, east]].
  const NATIONAL_BOUNDS = [[24.4, -125.0], [49.6, -66.9]];

  // Accessibility requirement: respect the visitor's "reduce motion" system setting.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // True on phones and tablets. Used so one-finger swiping scrolls the page, not the map.
  const isTouchDevice = L.Browser.mobile;

  // Center of a feature's bounding box, used to decide whether it belongs in view.
  function geometryCenter(feature) {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    const walk = (coords) => {
      if (typeof coords[0] === 'number') {
        const lng = coords[0];
        const lat = coords[1];
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        return;
      }
      for (const part of coords) walk(part);
    };
    walk(feature.geometry.coordinates);
    return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  }

  function isContinental(feature) {
    const center = geometryCenter(feature);
    return center.lat >= CONTINENTAL_BOUNDS.south && center.lat <= CONTINENTAL_BOUNDS.north &&
      center.lng >= CONTINENTAL_BOUNDS.west && center.lng <= CONTINENTAL_BOUNDS.east;
  }

  function init(options) {
    options = options || {};

    const container = options.container || document.getElementById('crg-map');
    const resetButton = options.resetButton || document.getElementById('crg-map-reset');
    const fullscreenButton = options.fullscreenButton || document.getElementById('crg-map-fullscreen');
    const topology = options.topology;
    const locations = options.locations || [];
    const logoUrl = options.logoUrl || 'assets/logo.png';

    // Callbacks let the page react to map activity. The module itself never knows
    // anything about the directory or any other consumer.
    const onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;
    const onMarkerSelect = typeof options.onMarkerSelect === 'function' ? options.onMarkerSelect : null;
    const onReset = typeof options.onReset === 'function' ? options.onReset : null;

    const map = L.map(container, {
      zoomSnap: 0.25,                       // Allows fractional zoom so states fit tightly.
      maxZoom: 14,
      scrollWheelZoom: false,               // Wheel zoom turns on only after a click on the map or selecting a state.
      dragging: !isTouchDevice,             // On touch devices, enabled only after a state is selected.
      zoomAnimation: !reduceMotion,
      fadeAnimation: !reduceMotion,
      markerZoomAnimation: !reduceMotion,
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('State boundaries: US Census Bureau');

    // A provisional view before any layer is added: everything below then renders
    // synchronously instead of through Leaflet's deferred whenReady queue.
    map.setView([39.5, -96.5], 4, { animate: !reduceMotion });

    // Convert the compressed TopoJSON into GeoJSON that Leaflet can draw, then drop
    // areas outside the contiguous view.
    const states = topojson.feature(topology, topology.objects.states);
    states.features = states.features.filter(isContinental);

    // Group locations by state name. A state is "active" if it has at least one location.
    const locationsByState = new Map();
    for (const loc of locations) {
      if (!locationsByState.has(loc.state_name)) locationsByState.set(loc.state_name, []);
      locationsByState.get(loc.state_name).push(loc);
    }
    const isActive = (feature) => locationsByState.has(feature.properties.name);

    // State of the interaction. Hover is only a preview; this variable is the real selection.
    let selectedState = null;
    const stateLayers = new Map();   // state name -> its drawn shape
    const hotspots = new Map();      // state name -> clickable circle for tiny active areas
    const markerGroups = new Map();  // state name -> its cluster group of markers
    const markersById = new Map();   // location id -> { marker, group, stateName }

    // ---------- Markers ----------
    // Static SVG icons for the popup. They never receive data inside them,
    // so building the popup with textContent for all text stays XSS-safe.
    const ICON = {
      pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#c0392b" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
      phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#1e7a46" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
      globe: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#23447F" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>',
    };

    function popupRow(icon, node) {
      const row = document.createElement('div');
      row.className = 'crg-pop__row';
      const iconWrap = document.createElement('span');
      iconWrap.innerHTML = icon; // Our control string only; data is never placed here.
      row.appendChild(iconWrap);
      row.appendChild(node);
      return row;
    }

    function buildPopup(loc) {
      // Built with textContent, never an HTML string, so location text can never inject HTML.
      const wrapper = document.createElement('div');
      wrapper.className = 'crg-pop';

      const head = document.createElement('div');
      head.className = 'crg-pop__head';
      const logo = document.createElement('img');
      logo.className = 'crg-pop__logo';
      logo.src = logoUrl;
      logo.alt = 'CRG logo';
      const title = document.createElement('span');
      title.className = 'crg-pop__title';
      title.textContent = `${loc.city}, ${loc.state_code}`;
      head.appendChild(logo);
      head.appendChild(title);
      wrapper.appendChild(head);

      if (loc.address) {
        const address = document.createElement('p');
        address.className = 'crg-pop__line';
        address.textContent = loc.address;
        wrapper.appendChild(popupRow(ICON.pin, address));
      }
      if (loc.phone) {
        const phone = document.createElement('a');
        const digits = String(loc.phone).replace(/[^\d+]/g, '');
        phone.className = 'crg-pop__phone';
        if (digits) { phone.href = 'tel:' + digits; }
        phone.textContent = loc.phone;
        wrapper.appendChild(popupRow(ICON.phone, phone));
      }
      if (/^https?:\/\//.test(loc.url)) {
        const link = document.createElement('a');
        link.className = 'crg-pop__link';
        link.href = loc.url;
        link.textContent = 'WEBSITE';
        link.target = '_blank';
        link.rel = 'noopener';
        wrapper.appendChild(popupRow(ICON.globe, link));
      }
      return wrapper;
    }

    function buildMarker(loc, stateName) {
      const marker = L.marker([loc.lat, loc.lng], {
        // The CRG logo inside a circular badge, instead of Leaflet's default image pin.
        icon: L.divIcon({
          className: 'crg-pin',
          html: `<img src="${logoUrl}" alt="" draggable="false">`, // Static markup, no data.
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        title: `${loc.city}, ${loc.state_code}`, // Screen readers and hover text.
        keyboard: true,                          // Markers are reachable with the Tab key.
      });
      // Registered before bindPopup so a click selects the state first; Leaflet's
      // own click handler then opens the popup, which reports the marker to the page.
      // No fit: a pin click never moves the map, so the marker cannot be re-clustered
      // (which would close the popup that is opening).
      marker.on('click', () => selectState(stateName, { fit: false }));
      marker.bindPopup(buildPopup(loc));
      marker.locationId = loc.id;
      marker.on('popupopen', () => { if (onMarkerSelect) onMarkerSelect(loc.id); });
      marker.on('popupclose', () => { if (onMarkerSelect) onMarkerSelect(null); });
      return marker;
    }

    // ---------- Marker visibility: built for hover, with a short grace period ----------
    // The pointer can jump between the polygon, a marker and its popup; without a grace
    // period the polygon's mouseout would remove the markers and flicker them away.
    let hoverName = null;      // state whose highlight/markers are currently shown
    let popupState = null;     // state that contains the marker whose popup is open
    const hideTimers = new Map(); // state name -> pending hide timer

    function cancelHide(name) {
      const timer = hideTimers.get(name);
      if (timer) { clearTimeout(timer); hideTimers.delete(name); }
    }

    // Markers and highlight are driven by exactly two values, hoverName (pointer
    // position) and selectedState (last click). Browsers do not always deliver
    // mouseout, so nothing trusts the leave event alone: every hover, click,
    // zoom, pan, cluster click and Reset repaints all active states from here.
    function repaintStates() {
      stateLayers.forEach((layer, name) => {
        const lit = name === selectedState || name === hoverName;
        if (lit && layer.options.fillColor !== COLORS.highlight) {
          layer.setStyle({ fillColor: COLORS.highlight });
        } else if (!lit && layer.options.fillColor !== COLORS.activeFill && activeLayer) {
          activeLayer.resetStyle(layer);
        }
        const spot = hotspots.get(name);
        if (spot) spot.setStyle(lit ? { fillColor: COLORS.highlight, color: COLORS.highlight } : hotspotStyle());
      });
    }

    function deactivate(name) {
      hideTimers.delete(name);
      if (hoverName === name) hoverName = null;
      if (name === selectedState || name === popupState) return; // still wanted: keep its markers
      hideMarkers(name);
      repaintStates();
    }

    function activateHover(name) {
      cancelHide(name);
      if (hoverName && hoverName !== name) deactivate(hoverName);
      hoverName = name;
      repaintStates();
      showMarkers(name);
    }

    function scheduleHide(name) {
      if (hideTimers.has(name)) return;
      const timer = setTimeout(function () {
        hideTimers.delete(name);
        if (hoverName === name) deactivate(name);
      }, 120);
      hideTimers.set(name, timer);
    }

    // After a zoom or pan the pointer's hover is stale (the browser rarely fires
    // mouseout while the map moves), so the hover is dropped and everything repaints.
    // The repaint is deferred because moveend can fire before the SVG re-projection
    // has laid fresh path bounds down; painting during that gap throws.
    function dropStaleHover() {
      const name = hoverName;
      hoverName = null;
      if (name) {
        hideTimers.delete(name);
        if (name !== selectedState && name !== popupState) hideMarkers(name);
      }
      L.Util.requestAnimFrame(repaintStates);
    }

    // Cluster group per state, one instance, added to the map only while shown.
    for (const [stateName, items] of locationsByState) {
      // zoomToBoundsOnClick is off: our clusterclick handler alone zooms, so the
      // built-in zoom and ours never fight over the same animation.
      const group = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        maxClusterRadius: 40,
      });
      items.forEach((loc) => {
        const marker = buildMarker(loc, stateName);
        markersById.set(Number(loc.id), { marker: marker, group: group, stateName: stateName });
        group.addLayer(marker);
      });
      // Clicking a cluster zooms in until its markers separate.
      group.on('clusterclick', (event) => {
        event.layer.zoomToBounds({ padding: [20, 20], animate: !reduceMotion });
      });
      // Hovering a marker or cluster refreshes the same highlight/markers as the polygon.
      group.on('mouseover', () => activateHover(stateName));
      group.on('mouseout', () => scheduleHide(stateName));
      // A marker with an open popup keeps its state visible until the popup closes.
      group.on('popupopen', () => { popupState = stateName; });
      group.on('popupclose', () => { if (popupState === stateName) popupState = null; });
      markerGroups.set(stateName, group);
    }

    // ---------- State shapes ----------
    const baseStyle = (feature) => ({
      color: COLORS.border,
      weight: 1,
      fillOpacity: 1,
      fillColor: isActive(feature) ? COLORS.activeFill : COLORS.inactiveFill,
    });

    // Inactive states live in their own layer with interactivity off: no hover, no click,
    // no pointer cursor, and dragging passes straight through to the map.
    L.geoJSON(states, { filter: (f) => !isActive(f), style: baseStyle, interactive: false }).addTo(map);

    let activeLayer; // The group the highlight repaint resets styles against.
    function onEachActiveState(feature, layer) {
      const name = feature.properties.name;
      const count = locationsByState.get(name).length;
      stateLayers.set(name, layer);
      // Not sticky: a tooltip that follows the cursor sits on top of the clusters it
      // describes, blocking their click. Anchored to the state's center instead.
      layer.bindTooltip(`${name}: ${count} ${count === 1 ? 'location' : 'locations'}`, { direction: 'top', opacity: 1 });
      layer.on({
        mouseover: () => activateHover(name),
        mouseout: () => scheduleHide(name),
        click: () => activateForClick(name), // On phones a tap triggers this same handler.
      });
    }

    activeLayer = L.geoJSON(states, { filter: isActive, style: baseStyle, onEachFeature: onEachActiveState }).addTo(map);

    // ---------- Clickable circles for tiny active areas ----------
    // Tiny areas are a few pixels wide at the national view. Any active area
    // smaller than one degree in BOTH directions
    // (decided by size, never by name) gets a ~20 px clickable circle.
    function hotspotStyle() {
      return { radius: 10, weight: 2, color: COLORS.border, fillColor: COLORS.activeFill, fillOpacity: 1 };
    }
    stateLayers.forEach((layer, name) => {
      const bounds = layer.getBounds();
      if ((bounds.getNorth() - bounds.getSouth()) >= 1 || (bounds.getEast() - bounds.getWest()) >= 1) return;
      const count = locationsByState.get(name).length;
      const spot = L.circleMarker(bounds.getCenter(), Object.assign({ className: 'crg-hotspot' }, hotspotStyle())).addTo(map);
      spot.bindTooltip(`${name}: ${count} ${count === 1 ? 'location' : 'locations'}`, { direction: 'top', opacity: 1 });
      spot.on({
        mouseover: () => activateHover(name),
        mouseout: () => scheduleHide(name),
        click: () => activateForClick(name),
      });
      hotspots.set(name, spot);
    });

    // ---------- Views ----------
    function goNational() {
      map.setMinZoom(0);
      // Markercluster breaks at fractional minZoom levels: single markers stop rendering.
      // The minZoom clamp must be an integer, while the view itself may sit at 4.5.
      map.setMinZoom(Math.floor(map.getBoundsZoom(NATIONAL_BOUNDS))); // Never zoom out past the national view.
      map.fitBounds(NATIONAL_BOUNDS, { animate: !reduceMotion });
    }

    function selectState(name, selectOptions) {
      const fit = !selectOptions || selectOptions.fit !== false;
      cancelHide(name); // A click counts as a hover; never hide right after selecting.
      selectedState = name;
      hoverName = name;
      repaintStates();
      showMarkers(name);
      if (fit) {
        // maxZoom stops tiny shapes such as DC from zooming absurdly far.
        map.fitBounds(stateLayers.get(name).getBounds(), { padding: [30, 30], maxZoom: 9, animate: !reduceMotion });
      }
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      // Reported once per selection, whatever triggered it (map click, directory, popup).
      if (onStateChange) onStateChange(name);
    }

    // Same as a hover, but keeps the markers after the pointer leaves (a click selection).
    function activateForClick(name) {
      activateHover(name);
      selectState(name);
    }

    // ----- Marker visibility: hidden until the state is hovered or selected -----
    function showMarkers(name) {
      const group = markerGroups.get(name);
      if (group && !map.hasLayer(group)) map.addLayer(group);
    }

    function hideMarkers(name) {
      if (name === selectedState) return; // The selected state keeps its markers.
      const group = markerGroups.get(name);
      if (group && map.hasLayer(group)) map.removeLayer(group);
    }

    // Open a location from elsewhere on the page. The state is made active without
    // moving the view to its bounds, so the only zoom is the one that separates the
    // marker from its cluster. The popup then reports itself through onMarkerSelect.
    function focusLocation(id) {
      const entry = markersById.get(Number(id));
      if (!entry) return;
      selectState(entry.stateName, { fit: false });
      entry.group.zoomToShowLayer(entry.marker, function () {
        entry.marker.openPopup();
      });
    }

    function resetView() {
      const previous = selectedState;
      selectedState = null;
      popupState = null;
      hoverName = null;
      for (const timer of hideTimers.values()) clearTimeout(timer);
      hideTimers.clear();
      if (previous) hideMarkers(previous);
      for (const name of markerGroups.keys()) hideMarkers(name);
      repaintStates();
      map.closePopup();
      map.scrollWheelZoom.disable();
      if (isTouchDevice) map.dragging.disable();
      goNational();
      // Called last, after the map is back in its national view.
      if (onReset) onReset();
    }

    // ---------- Input behavior ----------
    // The wheel keeps scrolling the page by default. Wheel zoom turns on after any
    // click on the map (including selecting a state) and turns off again when the
    // pointer leaves the map, unless a state stays selected.
    map.on('click', () => { if (!isTouchDevice) map.scrollWheelZoom.enable(); });
    container.addEventListener('mouseleave', () => {
      if (!selectedState) map.scrollWheelZoom.disable();
      // Safety net: the leave event is the one browsers sometimes skip, so a move
      // and a zoom repaint as well, but leaving the map always ends the hover.
      dropStaleHover();
    });
    map.on('zoomend moveend', dropStaleHover);

    // ---------- Full screen (maximize) button ----------
    const wrap = container.parentElement;
    const canFullscreen = !!(wrap.requestFullscreen || wrap.webkitRequestFullscreen);
    // iOS Safari has no element Fullscreen API; fall back to a fixed overlay that
    // covers the viewport (the browser URL bar unfortunately stays visible there).
    function isFullscreen() {
      return document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
    }
    function syncFullscreen() {
      if (!fullscreenButton) return;
      const on = isFullscreen() || wrap.classList.contains('crg-fs-fallback');
      fullscreenButton.setAttribute('aria-pressed', String(on));
      fullscreenButton.setAttribute('aria-label', on ? 'Exit full screen' : 'View map full screen');
      setTimeout(() => {
        map.invalidateSize();
        if (!selectedState) goNational();
      }, 150);
    }
    function toggleFullscreen() {
      if (canFullscreen) {
        if (isFullscreen()) {
          if (document.exitFullscreen) document.exitFullscreen();
          else document.webkitExitFullscreen();
        } else if (wrap.requestFullscreen) {
          wrap.requestFullscreen();
        } else {
          wrap.webkitRequestFullscreen();
        }
      } else {
        wrap.classList.toggle('crg-fs-fallback');
        syncFullscreen();
      }
    }
    if (fullscreenButton) fullscreenButton.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    // ---------- Keyboard access ----------
    // Leaflet's zoom control uses anchors; real button elements give Tab focus,
    // Enter and Space for free (Space on a button never scrolls the page).
    function buttonizeZoomControls() {
      container.querySelectorAll('.leaflet-control-zoom a').forEach((anchor) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = anchor.className;
        button.innerHTML = anchor.innerHTML;
        button.title = anchor.title;
        button.setAttribute('aria-label', anchor.title);
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.disableScrollPropagation(button);
        L.DomEvent.on(button, 'click', (event) => {
          L.DomEvent.stop(event);
          if (button.classList.contains('leaflet-control-zoom-in')) map.zoomIn(event.shiftKey ? 3 : 1);
          else map.zoomOut(event.shiftKey ? 3 : 1);
        });
        anchor.replaceWith(button);
      });
    }
    function syncZoomButtons() {
      const zoom = map.getZoom();
      const zoomIn = container.querySelector('.leaflet-control-zoom-in');
      const zoomOut = container.querySelector('.leaflet-control-zoom-out');
      if (zoomIn) zoomIn.disabled = zoom >= map.getMaxZoom();
      if (zoomOut) zoomOut.disabled = zoom <= map.getMinZoom();
    }
    buttonizeZoomControls();
    map.on('zoomend', syncZoomButtons);
    syncZoomButtons();

    if (resetButton) resetButton.addEventListener('click', resetView);
    goNational();

    return {
      map: map,
      selectState: selectState,
      focusLocation: focusLocation,
      reset: resetView,
      getContainer: function () { return container; },
    };
  }

  window.CRGMap = { init: init };
})(window);
