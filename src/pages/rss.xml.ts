import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArticles, articleUrl } from '../lib/content';
import { SITE } from '../site.config';

export async function GET(context: APIContext) {
  const articles = (await getArticles()).filter((a) => !a.data.sample);
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.pubDate,
      link: articleUrl(a),
      categories: [a.data.category, ...a.data.tags],
    })),
  });
}
