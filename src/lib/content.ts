import { getCollection, type CollectionEntry } from 'astro:content';
import type { CategoryKey } from '../site.config';

export type Article = CollectionEntry<'articles'>;
export type Bike = CollectionEntry<'bikes'>;

export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getArticlesByCategory(category: CategoryKey) {
  return (await getArticles()).filter((a) => a.data.category === category);
}

export function articleUrl(a: Article) {
  return `/news/${a.id}/`;
}

export function bikeUrl(b: Bike) {
  return `/bikes/${b.id}/`;
}

/** Related articles: same bike first, then same category, then same format. */
export function related(current: Article, all: Article[], n = 3) {
  const score = (a: Article) =>
    (a.data.bike && current.data.bike && a.data.bike.id === current.data.bike.id ? 4 : 0) +
    (a.data.category === current.data.category ? 2 : 0) +
    (a.data.format === current.data.format ? 1 : 0);
  return all
    .filter((a) => a.id !== current.id)
    .map((a) => ({ a, s: score(a) }))
    .sort((x, y) => y.s - x.s || y.a.data.pubDate.valueOf() - x.a.data.pubDate.valueOf())
    .slice(0, n)
    .map((x) => x.a);
}

export function readingTime(body = '') {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function formatDate(d: Date, style: 'long' | 'short' = 'long') {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

/** Launch dates may be a full date, a month ("2026-06") or only a year. */
export function launchTime(s: string) {
  return Date.parse(s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s);
}

export function formatLaunch(s: string, style: 'long' | 'short' = 'long') {
  if (s.length === 4) return s;
  const d = new Date(launchTime(s));
  if (s.length === 7)
    return d.toLocaleDateString('en-GB', { month: style === 'long' ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });
  return formatDate(d, style);
}

export function formatMoney(value: number | null, currency: 'USD' | 'EUR') {
  if (value == null) return 'TBC';
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-IE', {
    style: 'currency',
    currency,
    // Keep cents only when a price has them ($13,999.99 must not round up to $14,000)
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatWeight(kg: number | null) {
  return kg == null ? 'TBC' : `${kg.toFixed(2)} kg`;
}

export function filterBikes(
  bikes: Bike[],
  f: { category?: string; minPriceUSD?: number; maxWeightKg?: number; sort: string },
) {
  const out = bikes.filter(
    ({ data }) =>
      !data.discontinued &&
      // A ranking by weight or price only lists bikes with that figure confirmed
      (f.sort !== 'weight-asc' || data.weightKg != null) &&
      (!f.sort.startsWith('price') || data.priceUSD != null) &&
      (!f.category || data.category === f.category) &&
      (f.minPriceUSD == null || (data.priceUSD ?? 0) >= f.minPriceUSD) &&
      (f.maxWeightKg == null || (data.weightKg != null && data.weightKg <= f.maxWeightKg)),
  );
  const cmp: Record<string, (a: Bike, b: Bike) => number> = {
    'price-desc': (a, b) => (b.data.priceUSD ?? 0) - (a.data.priceUSD ?? 0),
    'price-asc': (a, b) => (a.data.priceUSD ?? 0) - (b.data.priceUSD ?? 0),
    'weight-asc': (a, b) => (a.data.weightKg ?? 99) - (b.data.weightKg ?? 99),
  };
  return out.sort(cmp[f.sort]);
}
