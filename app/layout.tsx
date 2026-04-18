import type { Metadata, Viewport } from 'next'
import { getSiteUrl } from '@/lib/i18n/config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'KnowledgeOS | Enterprise RAG Knowledge Base SaaS',
  description:
    'Multi-tenant enterprise knowledge chatbot platform for document ingestion, citations, and auditable answers.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
