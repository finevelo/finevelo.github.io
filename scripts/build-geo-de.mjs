// One-off: extract and simplify the 16 German Länder from Natural Earth 10m admin-1 polygons
// (as shipped in the npm package geojson-places, ISC; data public domain) into src/data/geo/de-states.json.
//
//   npm pack geojson-places && tar xzf geojson-places-*.tgz
//   node scripts/build-geo-de.mjs package/data/regions
//
// The output is committed so the site build does not need the 285 MB source package.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATES = {
  'DE-BW': 'Baden-Württemberg',
  'DE-BY': 'Bayern',
  'DE-BE': 'Berlin',
  'DE-BB': 'Brandenburg',
  'DE-HB': 'Bremen',
  'DE-HH': 'Hamburg',
  'DE-HE': 'Hessen',
  'DE-MV': 'Mecklenburg-Vorpommern',
  'DE-NI': 'Niedersachsen',
  'DE-NW': 'Nordrhein-Westfalen',
  'DE-RP': 'Rheinland-Pfalz',
  'DE-SL': 'Saarland',
  'DE-SN': 'Sachsen',
  'DE-ST': 'Sachsen-Anhalt',
  'DE-SH': 'Schleswig-Holstein',
  'DE-TH': 'Thüringen',
};

const dir = process.argv[2];
if (!dir) throw new Error('Usage: node scripts/build-geo-de.mjs <geojson-places/data/regions>');

// Drop vertices closer than ~1.5 km to the previous kept one: about 1.5 px on a 600 px wide map.
const MIN = 0.02;
const round = (n) => Math.round(n * 1000) / 1000;
const simplifyRing = (ring) => {
  const out = [];
  for (const [x, y] of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) >= MIN) out.push([round(x), round(y)]);
  }
  const [fx, fy] = out[0];
  const [lx, ly] = out[out.length - 1];
  if (fx !== lx || fy !== ly) out.push([fx, fy]);
  return out;
};
// d3-geo wants spherical winding: exterior rings clockwise, holes counter-clockwise (the reverse of RFC 7946).
const area = (ring) => ring.reduce((a, [x, y], i) => a + (i ? (ring[i - 1][0] - x) * (ring[i - 1][1] + y) : 0), 0);
// area() > 0 means counter-clockwise (x = lon, y = lat)
const wind = (ring, clockwise) => ((area(ring) < 0) === clockwise ? ring : ring.slice().reverse());
const simplifyPolygon = (poly) =>
  poly
    .map(simplifyRing)
    .filter((r) => r.length >= 4)
    .map((r, i) => wind(r, i === 0));

const features = Object.entries(STATES).map(([code, name]) => {
  const { geometry } = JSON.parse(readFileSync(join(dir, `${code}.json`), 'utf8'));
  const coordinates =
    geometry.type === 'Polygon'
      ? simplifyPolygon(geometry.coordinates)
      : geometry.coordinates.map(simplifyPolygon).filter((p) => p.length);
  return { type: 'Feature', properties: { code, name }, geometry: { type: geometry.type, coordinates } };
});

writeFileSync('src/data/geo/de-states.json', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Wrote ${features.length} states`);
