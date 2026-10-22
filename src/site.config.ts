export const SITE = {
  name: 'Finevelo',
  url: 'https://finevelo.com',
  tagline: 'The top 10% of cycling. Daily.',
  description:
    'Finevelo curates the top 10% of cycling: launches, specs and data on high-end road, gravel, MTB and premium e-bikes.',
  locale: 'en',
  twitter: '@finevelo',
};

export const CATEGORIES = {
  road: {
    label: 'Road',
    path: '/road/',
    tone: '#1d2a3a',
    threshold: 'Complete bikes from $8,000 / €7,500',
    intro:
      'Flagship road bikes and the tech that defines them: sub-7 kg race machines, WorldTour aero platforms and the groupsets that move them. If it costs less than a used car, it probably is not here.',
  },
  gravel: {
    label: 'Gravel',
    path: '/gravel/',
    tone: '#7c5e3c',
    threshold: 'Complete bikes from $6,500',
    intro:
      'Race-geometry gravel bikes with carbon wheels as standard, custom builds and the machines that win Unbound. Not the bikepacking rig with a rack mount on every tube.',
  },
  mtb: {
    label: 'MTB',
    path: '/mtb/',
    tone: '#2f4a33',
    threshold: 'Complete bikes from $9,000',
    intro:
      'XC, downcountry and enduro flagships with Factory and Ultimate suspension, XX and XTR drivetrains, and the frames World Cup teams actually race.',
  },
  'e-bike': {
    label: 'E-Bike',
    path: '/e-bike/',
    tone: '#383d66',
    threshold: 'Complete bikes from $7,000',
    intro:
      'Premium e-bikes with lightweight motors from TQ, Fazua and Bosch CX Race, plus the design-led commuters from Stromer and Riese & Müller.',
  },
  components: {
    label: 'Components',
    path: '/components/',
    tone: '#2a2a2a',
    threshold: 'Wheelsets from $2,500, groupsets from $3,500',
    intro:
      'Top-tier groupsets, wheels, cockpits, saddles and tyres. Dura-Ace, Red, Super Record and the boutique parts that cost more than most bikes.',
  },
  custom: {
    label: 'Custom & Craft',
    path: '/custom/',
    tone: '#6e1f2a',
    threshold: 'Handmade frames, limited editions, bespoke paint',
    intro:
      'Frame builders, limited editions and paint jobs worth framing. The slow, expensive and beautiful end of cycling.',
  },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const FORMATS = {
  'launch-brief': 'Launch Brief',
  'the-edit': 'The Edit',
  'deep-dive': 'Deep Dive',
  'pro-bike-check': 'Pro Bike Check',
} as const;

export type FormatKey = keyof typeof FORMATS;

export const NAV = [
  { label: 'News', href: '/news/' },
  ...CATEGORY_KEYS.map((k) => ({ label: CATEGORIES[k].label, href: CATEGORIES[k].path })),
  { label: 'Data', href: '/bikes/' },
  { label: 'Guides', href: '/guides/' },
  { label: 'Builders', href: '/builders/' },
];
