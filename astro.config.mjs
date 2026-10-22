import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// BASE_PATH=/finevelo for the GitHub Pages preview (served from a subfolder); '/' everywhere else.
const base = process.env.BASE_PATH || '/';
// STAGING=1: noindex on every page and a robots.txt that blocks all crawlers.
const staging = process.env.STAGING === '1';

/**
 * Pages and Markdown use root-relative links ("/news/…"). When the site is served from a subfolder,
 * prefix them with the base after the build instead of threading the base through every component.
 */
function basePathLinks() {
  const prefix = base.replace(/\/$/, '');
  return {
    name: 'base-path-links',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const walk = (d) =>
          readdirSync(d).flatMap((f) => {
            const p = join(d, f);
            return statSync(p).isDirectory() ? walk(p) : [p];
          });
        if (prefix) {
          const attr = /(\s(?:href|src|action|poster)=")\/(?!\/)/g;
          for (const file of walk(root).filter((f) => f.endsWith('.html'))) {
            const html = readFileSync(file, 'utf8');
            const out = html.replace(attr, (m, a, offset) =>
              html.startsWith(`${prefix}/`, offset + a.length) ? m : `${a}${prefix}/`,
            );
            if (out !== html) writeFileSync(file, out);
          }
        }
        if (staging) writeFileSync(join(root, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
      },
    },
  };
}

export default defineConfig({
  site: 'https://finevelo.com',
  base,
  trailingSlash: 'always',
  vite: { define: { 'import.meta.env.STAGING': JSON.stringify(staging) } },
  integrations: [sitemap({ filter: (page) => !/\/(impressum|privacy)\/$/.test(page) }), basePathLinks()],
});
