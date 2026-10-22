import { defineCollection, reference, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { readdirSync, readFileSync } from 'node:fs';

const categoryEnum = z.enum(['road', 'gravel', 'mtb', 'e-bike', 'components', 'custom']);

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    // Title tag, max 60 characters: brand + model + year
    seoTitle: z.string().max(60).optional(),
    // Meta description, should mention the price
    description: z.string().max(170),
    dek: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: categoryEnum,
    format: z.enum(['launch-brief', 'the-edit', 'deep-dive', 'pro-bike-check']),
    author: reference('authors'),
    hero: z.object({
      src: z.string().optional(),
      alt: z.string(),
      // Caption text shown under the image, e.g. what and where
      caption: z.string().optional(),
      credit: z.string().optional(),
      // Required for Creative Commons images: link to the original and the licence
      sourceUrl: z.string().url().optional(),
      license: z.object({ name: z.string(), url: z.string().url() }).optional(),
      // Note required by CC licences when the image was changed
      changes: z.string().optional(),
    }),
    // Specs box at the top of every Launch Brief
    specs: z
      .object({
        price: z.string(),
        weight: z.string(),
        groupset: z.string().optional(),
        availability: z.string().optional(),
        url: z.string().url().optional(),
      })
      .optional(),
    bike: reference('bikes').optional(),
    source: z.object({ name: z.string(), url: z.string().url() }).optional(),
    // Where the agent first spotted the news (a magazine); the article itself is written from `source`
    tip: z.object({ name: z.string(), url: z.string().url() }).optional(),
    tags: z.array(z.string()).default([]),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    featured: z.boolean().default(false),
    // Conflict of interest, shown in a box at the top (e.g. ownership links to a featured brand)
    disclosure: z.string().optional(),
    // Placeholder content: figures not verified, remove before launch
    sample: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const bikes = defineCollection({
  loader: file('./src/data/bikes.json'),
  schema: z.object({
    brand: z.string(),
    model: z.string(),
    year: z.number(),
    category: categoryEnum,
    build: z.string(),
    priceUSD: z.number().nullable(),
    priceEUR: z.number().nullable(),
    weightKg: z.number().nullable(),
    weightNote: z.string().optional(),
    groupset: z.string(),
    frame: z.string(),
    // "YYYY-MM-DD", or "YYYY-MM" / "YYYY" when the exact launch day is not confirmed
    launchDate: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/),
    url: z.string().url().optional(),
    predecessor: z.string().optional(),
    // Where price and weight come from; verified = checked on these pages
    sources: z.array(z.object({ name: z.string(), url: z.string().url() })).default([]),
    verified: z.boolean().default(false),
    // Replaced by a newer generation: kept as predecessor data, left out of guide rankings
    discontinued: z.boolean().default(false),
  }),
});

// Component database: hub sets (Centerlock, 12x100 / 12x142). Weights are manufacturer claims unless noted.
const hubs = defineCollection({
  loader: file('./src/data/hubs.json'),
  schema: z.object({
    brand: z.string(),
    model: z.string(),
    frontG: z.number().nullable(),
    rearG: z.number().nullable(),
    weightG: z.number(),
    freehub: z.string(),
    holes: z.string(),
    spoke: z.string(),
    measured: z.boolean().default(false),
    priceEUR: z.number().nullable(),
    priceUSD: z.number().nullable(),
    madeIn: z.string().nullable(),
    launchYear: z.number().nullable(),
    url: z.string().url(),
    note: z.string().optional(),
    sources: z.array(z.object({ name: z.string(), url: z.string().url() })).min(1),
  }),
});

// Component database: road disc wheelsets. Weights are manufacturer claims for the set unless marked measured.
const wheels = defineCollection({
  loader: file('./src/data/wheels.json'),
  schema: z.object({
    brand: z.string(),
    model: z.string(),
    // Rim depth in mm; "40/44" when front and rear differ
    depth: z.string(),
    internalWidthMm: z.number().nullable(),
    rim: z.enum(['hookless', 'hooked', 'not stated']),
    spokes: z.string(),
    hub: z.string(),
    weightG: z.number(),
    measured: z.boolean().default(false),
    priceUSD: z.number().nullable(),
    priceEUR: z.number().nullable(),
    launchYear: z.number().nullable(),
    url: z.string().url(),
    note: z.string().optional(),
    sources: z.array(z.object({ name: z.string(), url: z.string().url() })).min(1),
  }),
});

// Builders map: frame builders and premium custom shops. Country-aware so it can grow beyond Germany.
// Only business data the business publishes itself; every entry needs sources.
const source = z.object({ name: z.string(), url: z.string().url() });
// One JSON array per region (src/data/builders/<country>-<region>.json), so research can run per region
// without edit conflicts. Every entry needs a unique id across all files.
const BUILDERS_DIR = './src/data/builders';
const builders = defineCollection({
  loader: async () => {
    const entries = readdirSync(BUILDERS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .flatMap((f) => JSON.parse(readFileSync(`${BUILDERS_DIR}/${f}`, 'utf8')) as { id: string }[]);
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.id)) throw new Error(`Duplicate builder id: ${e.id}`);
      seen.add(e.id);
    }
    return entries;
  },
  schema: z
    .object({
      name: z.string(),
      type: z.enum(['builder', 'shop']),
      // selection = Finevelo Selection (builders and documented custom shops, full profile)
      // dealer = High-end dealer directory (authorised top-tier brand dealer or certified fitter, short entry)
      tier: z.enum(['selection', 'dealer']).default('selection'),
      country: z.string(),
      // ISO 3166-1 alpha-2, e.g. DE
      countryCode: z.string().regex(/^[A-Z]{2}$/),
      // State / Bundesland and its ISO 3166-2 code, e.g. Bayern / DE-BY
      region: z.string(),
      regionCode: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/),
      city: z.string(),
      // As published on the business's own Impressum or contact page; null = TBC
      address: z.object({
        street: z.string().nullable(),
        postalCode: z.string().nullable(),
        source: z.string().url().nullable(),
      }),
      // precision 'city' = city centre, not the workshop door
      geo: z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        precision: z.enum(['address', 'city']),
        // e.g. when the marker sits on the nearest town
        note: z.string().optional(),
      }),
      // null = official site not yet confirmed
      website: z.string().url().nullable(),
      founded: z.number().int().min(1850).max(2030).nullable(),
      materials: z.array(z.enum(['steel', 'titanium', 'carbon', 'aluminium'])).default([]),
      disciplines: z.array(z.enum(['road', 'gravel', 'mtb', 'touring', 'track', 'urban'])).default([]),
      // Exactly as published, e.g. "Frames from €2,900"; null = TBC
      priceNote: z.string().nullable(),
      brands: z.array(z.string()).default([]),
      // Certified fitting systems as published, e.g. Retül, GURU, IDmatch, Body Geometry Fit
      fittingSystems: z.array(z.string()).default([]),
      services: z
        .array(
          z.enum([
            'custom-geometry',
            'bike-fitting',
            'custom-paint',
            'custom-build',
            'frame-building-course',
            'wheel-building',
            'repair',
          ]),
        )
        .default([]),
      summary: z.string().max(400),
      // What could not be verified
      uncertain: z.string().optional(),
      checked: z.coerce.date(),
      sources: z.array(source).min(1),
    })
    .refine((d) => d.regionCode.startsWith(`${d.countryCode}-`), { message: 'regionCode must match countryCode' })
    .refine((d) => d.tier === 'selection' || d.type === 'shop', { message: 'dealer tier is for shops only' })
    .refine(
      (d) => d.countryCode !== 'DE' || (d.geo.lat > 47.2 && d.geo.lat < 55.1 && d.geo.lon > 5.8 && d.geo.lon < 15.1),
      { message: 'geo is outside Germany' },
    ),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().max(60).optional(),
    description: z.string(),
    updatedDate: z.coerce.date(),
    // Built on figures not yet checked on the original pages: noindex and flagged
    sample: z.boolean().default(false),
    // Conflict of interest, shown in a box at the top
    disclosure: z.string().optional(),
    // Which database the ranking is built from
    dataset: z.enum(['bikes', 'hubs', 'wheels']).default('bikes'),
    // Guides are rendered from the database with this filter
    filter: z.object({
      category: categoryEnum.optional(),
      minPriceUSD: z.number().optional(),
      maxWeightKg: z.number().optional(),
      sort: z.enum(['price-desc', 'price-asc', 'weight-asc']).default('price-desc'),
    }).default({}),
  }),
});

const authors = defineCollection({
  loader: file('./src/data/authors.json'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
  }),
});

export const collections = { articles, bikes, hubs, wheels, builders, guides, authors };
