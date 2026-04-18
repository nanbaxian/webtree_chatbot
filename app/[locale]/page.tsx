import KnowledgeLanding from '@/components/KnowledgeLanding'
import { isLocale, type Locale } from '@/lib/i18n/config'

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en'
  return <KnowledgeLanding locale={locale} />
}
