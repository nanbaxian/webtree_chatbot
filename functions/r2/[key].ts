
// functions/r2/[key].ts
// GET /r2/:key — public read from R2 (for previews)
// NOTE: If you want private access, gate this with auth + signed URLs.

interface Env {
  BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const key = params.key as string
  const obj = await env.BUCKET.get(key)
  if (!obj) return new Response('Not Found', { status: 404 })

  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')

  return new Response(obj.body, { headers })
}
