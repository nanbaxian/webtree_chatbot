const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || ''
const API_BASE = rawBase.replace(/\/+$/, '')

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!API_BASE) return normalized
  return `${API_BASE}${normalized}`
}

