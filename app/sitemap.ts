import type { MetadataRoute } from 'next';

const siteUrl = 'https://tienda-react-demo.richardlagos2.workers.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
