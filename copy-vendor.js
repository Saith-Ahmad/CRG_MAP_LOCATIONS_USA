// Copies only the files the browser needs out of node_modules into plain folders.
// Reason: index.html will load them with ordinary <script> and <link> tags and no
// bundler, which mirrors exactly how WordPress will load them later.
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
  fs.mkdirSync(path.dirname(to), { recursive: true }); // Create the target folder if missing.
  fs.copyFileSync(from, to);
  console.log('copied', to);
}