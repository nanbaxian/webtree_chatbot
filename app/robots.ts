import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/i18n/config'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/auth', '/chat'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
