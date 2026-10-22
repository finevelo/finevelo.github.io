import { getCollection, type CollectionEntry } from 'astro:content';

export type Wheelset = CollectionEntry<'wheels'>;

export async function getWheelsByWeight(): Promise<Wheelset[]> {
  return (await getCollection('wheels')).sort(
    (a, b) => a.data.weightG - b.data.weightG || a.data.brand.localeCompare(b.data.brand),
  );
}
