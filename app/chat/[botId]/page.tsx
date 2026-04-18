import KnowledgeChatDemo from '@/components/KnowledgeChatDemo'

export function generateStaticParams() {
  return [{ botId: 'demo' }]
}

export default async function ChatDemoPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = await params
  return <KnowledgeChatDemo botId={botId} />
}
