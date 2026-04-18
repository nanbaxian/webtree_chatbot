import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/i18n/config'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/en`,
      lastModified: new Date(),
      alternates: {
        languages: {
          en: `${siteUrl}/en`,
          zh: `${siteUrl}/zh`,
        },
      },
    },
    {
      url: `${siteUrl}/zh`,
      lastModified: new Date(),
      alternates: {
        languages: {
          en: `${siteUrl}/en`,
          zh: `${siteUrl}/zh`,
        },
      },
    },
    {
      url: `${siteUrl}/zh`,
      lastModified: new Date(),
      alternates: {
        languages: {
          en: `${siteUrl}/en`,
          zh: `${siteUrl}/zh`,
        },
      },
    },
  ]
}
