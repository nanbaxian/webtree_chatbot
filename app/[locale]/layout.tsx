import type { Metadata } from 'next'
import { I18nProvider } from '@/lib/i18n/context'
import { getSiteUrl, isLocale, locales, type Locale } from '@/lib/i18n/config'

export function generateStaticParams() {
  return locales.map(locale => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en'
  const siteUrl = getSiteUrl()
  const isZh = locale === 'zh'

  return {
    title: isZh
      ? 'KnowledgeOS | 企业知识库 RAG SaaS'
      : 'KnowledgeOS | Enterprise RAG Knowledge Base SaaS',
    description: isZh
      ? '面向企业的多租户知识库问答平台，支持文档接入、引用溯源和可审计聊天历史。'
      : 'Multi-tenant enterprise knowledge chatbot platform for document ingestion, citations, and auditable answers.',
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: `${siteUrl}/en`,
        zh: `${siteUrl}/zh`,
        'x-default': `${siteUrl}/en`,
      },
    },
    openGraph: {
      title: isZh
        ? 'KnowledgeOS | 企业知识库 RAG SaaS'
        : 'KnowledgeOS | Enterprise RAG Knowledge Base SaaS',
      description: isZh
        ? '面向企业的多租户知识库问答平台，支持文档接入、引用溯源和可审计聊天历史。'
        : 'Multi-tenant enterprise knowledge chatbot platform for document ingestion, citations, and auditable answers.',
      url: `${siteUrl}/${locale}`,
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      siteName: 'KnowledgeOS',
      type: 'website',
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en'

  return <I18nProvider locale={locale}>{children}</I18nProvider>
}
