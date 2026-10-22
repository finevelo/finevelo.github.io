import { getArticles, articleUrl } from '../lib/content';
import { SITE } from '../site.config';

// Google News sitemap: only articles from the last 48 hours.
export async function GET() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = (await getArticles()).filter((a) => !a.data.sample && a.data.pubDate.valueOf() >= cutoff);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urls = recent
    .map(
      (a) => `  <url>
    <loc>${SITE.url}${articleUrl(a)}</loc>
    <news:news>
      <news:publication><news:name>${SITE.name}</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${a.data.pubDate.toISOString()}</news:publication_date>
      <news:title>${esc(a.data.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
