import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

async function ping(url: string, ms: number): Promise<boolean> {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), ms)
    const r = await fetch(url, { signal: c.signal })
    clearTimeout(t)
    // Toute réponse HTTP (même 401/403) prouve que le réseau est joignable
    return r.status < 500
  } catch {
    return false
  }
}

export async function GET() {
  const s = await db.settings.findUnique({ where: { id: 'default' } })
  const [internet, ollama] = await Promise.all([
    ping('https://api.mistral.ai/v1/models', 4000),
    ping(`${(s?.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/tags`, 3000),
  ])
  return NextResponse.json({
    internet,
    ollama,
    mistral: Boolean(s?.mistralKey),
    agnes: Boolean(s?.agnesKey),
    providerOrder: s?.providerOrder || 'auto',
    online: internet || ollama,
  })
}
