import type { MetadataRoute } from 'next';

const siteUrl = 'https://tienda-react-demo.richardlagos2.workers.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
