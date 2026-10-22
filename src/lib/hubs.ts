import { getCollection, type CollectionEntry } from 'astro:content';

export type Hub = CollectionEntry<'hubs'>;

export async function getHubsByWeight(): Promise<Hub[]> {
  return (await getCollection('hubs')).sort(
    (a, b) => a.data.weightG - b.data.weightG || a.data.brand.localeCompare(b.data.brand),
  );
}

export function formatGrams(g: number | null) {
  return g == null ? '–' : `${Number.isInteger(g) ? g : g.toFixed(1)} g`;
}
