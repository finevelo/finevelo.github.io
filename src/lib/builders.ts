import { getCollection, type CollectionEntry } from 'astro:content';
import { geoConicConformal, geoPath } from 'd3-geo';
import deStates from '../data/geo/de-states.json';

export type Builder = CollectionEntry<'builders'>;
type D = Builder['data'];

export const TYPE_LABELS: Record<D['type'], string> = { builder: 'Builder', shop: 'Custom shop' };
export const TYPE_PLURAL: Record<D['type'], string> = { builder: 'Builders', shop: 'Custom shops' };

/** builder | shop | dealer: the three kinds shown on the map. */
export type Kind = 'builder' | 'shop' | 'dealer';
export const kindOf = (d: D): Kind => (d.tier === 'dealer' ? 'dealer' : d.type);
export const KIND_LABELS: Record<Kind, string> = { builder: 'Builder', shop: 'Custom shop', dealer: 'High-end dealer' };
export const KIND_PLURAL: Record<Kind, string> = { builder: 'Builders', shop: 'Custom shops', dealer: 'High-end dealers' };

export const MATERIAL_LABELS: Record<D['materials'][number], string> = {
  steel: 'Steel',
  titanium: 'Titanium',
  carbon: 'Carbon',
  aluminium: 'Aluminium',
};

export const DISCIPLINE_LABELS: Record<D['disciplines'][number], string> = {
  road: 'Road',
  gravel: 'Gravel',
  mtb: 'MTB',
  touring: 'Touring',
  track: 'Track',
  urban: 'Urban',
};

export const SERVICE_LABELS: Record<D['services'][number], string> = {
  'custom-geometry': 'Custom geometry',
  'bike-fitting': 'Bike fitting',
  'custom-paint': 'Custom paint',
  'custom-build': 'Custom builds',
  'frame-building-course': 'Frame-building courses',
  'wheel-building': 'Wheel building',
  repair: 'Workshop / repair',
};

export async function getBuilders(countryCode = 'DE'): Promise<Builder[]> {
  const all = await getCollection('builders', (b) => b.data.countryCode === countryCode);
  return all.sort((a, b) => a.data.name.localeCompare(b.data.name, 'de'));
}

export function builderUrl(b: Builder) {
  return `/builders/${b.id}/`;
}

export function specialities(d: D) {
  return [...d.materials.map((m) => MATERIAL_LABELS[m]), ...d.disciplines.map((x) => DISCIPLINE_LABELS[x])];
}

/** Great-circle distance in km. */
export function distanceKm(a: D['geo'], b: D['geo']) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearby(current: Builder, all: Builder[], n = 4) {
  return all
    .filter((b) => b.id !== current.id)
    .map((b) => ({ b, km: distanceKm(current.data.geo, b.data.geo) }))
    .sort((x, y) => x.km - y.km)
    .slice(0, n);
}

// Orientation labels on the map, city-centre coordinates.
const CITIES: [string, number, number][] = [
  ['Hamburg', 53.551, 9.994],
  ['Berlin', 52.52, 13.405],
  ['Hannover', 52.375, 9.732],
  ['Köln', 50.938, 6.96],
  ['Leipzig', 51.34, 12.375],
  ['Frankfurt', 50.11, 8.682],
  ['Stuttgart', 48.776, 9.183],
  ['Nürnberg', 49.452, 11.077],
  ['München', 48.137, 11.576],
];

export const MAP_WIDTH = 600;

/**
 * Germany as SVG at build time: Natural Earth admin-1 polygons, conic conformal projection.
 * Markers sit at their true projected position; dense areas are resolved by zooming in on the page.
 */
export function germanyMap(entries: Builder[], width = MAP_WIDTH) {
  const collection = deStates as unknown as GeoJSON.FeatureCollection;
  const projection = geoConicConformal().rotate([-10.4, 0]).parallels([48.5, 53.5]);
  projection.fitWidth(width, collection);
  const path = geoPath(projection).digits(1);
  const [[, y0], [, y1]] = path.bounds(collection);
  const pad = 8;
  projection.translate([projection.translate()[0], projection.translate()[1] - y0 + pad]);
  const height = Math.ceil(y1 - y0 + pad * 2);

  const states = collection.features.map((f) => ({
    code: f.properties!.code as string,
    name: f.properties!.name as string,
    d: path(f) ?? '',
  }));

  const pt = (lat: number, lon: number) => projection([lon, lat]) as [number, number];
  const round = (n: number) => +n.toFixed(3);

  const markers = entries.map((e) => {
    const [x, y] = pt(e.data.geo.lat, e.data.geo.lon);
    return { entry: e, x: round(x), y: round(y) };
  });

  const cities = CITIES.map(([name, lat, lon]) => {
    const [x, y] = pt(lat, lon);
    return { name, x: round(x), y: round(y) };
  });

  // Town labels for every place with an entry, shown once the map is zoomed in
  const big = new Set(CITIES.map(([name]) => name));
  const byTown = new Map<string, { x: number; y: number; n: number }>();
  for (const m of markers) {
    const town = m.entry.data.city.replace(/\s*\(.*\)$/, '');
    if (big.has(town)) continue;
    const t = byTown.get(town) ?? { x: 0, y: 0, n: 0 };
    t.x += m.x;
    t.y += m.y;
    t.n += 1;
    byTown.set(town, t);
  }
  const towns = [...byTown].map(([name, t]) => ({ name, x: round(t.x / t.n), y: round(t.y / t.n) }));

  return { width, height, states, markers, cities, towns };
}
