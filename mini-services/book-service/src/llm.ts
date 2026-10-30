// Routeur LLM unifié — Mistral / Agnes AI / Ollama (local) / Z.ai / Démo
export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface ServiceSettings {
  mistralKey: string
  agnesKey: string
  ollamaUrl: string
  ollamaModel: string
  providerOrder: string
}

export interface LLMResult {
  content: string
  provider: string
}

export const USAGE: { provider: string; purpose: string; chars: number; at: string; ok: boolean }[] = []

export function logUsage(provider: string, purpose: string, chars: number, ok: boolean) {
  USAGE.unshift({ provider, purpose, chars, ok, at: new Date().toISOString() })
  if (USAGE.length > 200) USAGE.pop()
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ])
}

async function callMistral(messages: LLMMessage[], key: string): Promise<string> {
  const r = await withTimeout(
    fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'mistral-large-latest', messages, temperature: 0.75 }),
    }),
    180000
  )
  if (!r.ok) throw new Error(`Mistral HTTP ${r.status}`)
  const j: any = await r.json()
  const c = j?.choices?.[0]?.message?.content
  if (!c) throw new Error('Mistral: réponse vide')
  return String(c)
}

async function callAgnes(messages: LLMMessage[], key: string): Promise<string> {
  const r = await withTimeout(
    fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'agnes-3.0-flash', messages, temperature: 0.75 }),
    }),
    180000
  )
  if (!r.ok) throw new Error(`Agnes HTTP ${r.status}`)
  const j: any = await r.json()
  const c = j?.choices?.[0]?.message?.content
  if (!c) throw new Error('Agnes: réponse vide')
  return String(c)
}

async function callOllama(messages: LLMMessage[], url: string, model: string): Promise<string> {
  const m = model || 'llama3.1'
  const r = await withTimeout(
    fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, messages, stream: false }),
    }),
    300000
  )
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`)
  const j: any = await r.json()
  const c = j?.message?.content
  if (!c) throw new Error('Ollama: réponse vide')
  return String(c)
}

let zaiInstance: any = null
async function callZai(messages: LLMMessage[]): Promise<string> {
  if (!zaiInstance) {
    const mod = await import('z-ai-web-dev-sdk')
    const ZAI = (mod as any).default ?? mod
    zaiInstance = await ZAI.create()
  }
  const completion: any = await withTimeout(
    zaiInstance.chat.completions.create({ messages, thinking: { type: 'disabled' } }),
    240000
  )
  const c = completion?.choices?.[0]?.message?.content
  if (!c) throw new Error('Z.ai: réponse vide')
  return String(c)
}

function buildOrder(s: ServiceSettings): string[] {
  const o: string[] = []
  const forced = (s.providerOrder || 'auto').toLowerCase()
  if (forced === 'demo') return []
  if (forced === 'mistral') { if (s.mistralKey) o.push('mistral') }
  else if (forced === 'agnes') { if (s.agnesKey) o.push('agnes') }
  else if (forced === 'ollama') { if (s.ollamaUrl) o.push('ollama') }
  else if (forced === 'zai') { /* juste zai */ }
  else {
    // auto : cloud d'abord, puis local, puis zai
    if (s.mistralKey) o.push('mistral')
    if (s.agnesKey) o.push('agnes')
    if (s.ollamaUrl) o.push('ollama')
  }
  if (!o.includes('zai')) o.push('zai')
  return o
}

/** Appelle le premier fournisseur disponible dans l'ordre de priorité.
 *  Le mode "démo" (100% hors-ligne) est géré par l'appelant en cas d'échec total. */
export async function callLLM(
  messages: LLMMessage[],
  settings: ServiceSettings,
  purpose = 'generation'
): Promise<LLMResult> {
  const order = buildOrder(settings)
  if (order.length === 0) throw new Error('Mode démo forcé')
  const errors: string[] = []
  for (const p of order) {
    try {
      let content: string
      const t0 = Date.now()
      if (p === 'mistral') content = await callMistral(messages, settings.mistralKey)
      else if (p === 'agnes') content = await callAgnes(messages, settings.agnesKey)
      else if (p === 'ollama') content = await callOllama(messages, settings.ollamaUrl, settings.ollamaModel)
      else content = await callZai(messages)
      logUsage(p, purpose, content.length, true)
      console.log(`[llm] ${p} (${purpose}) ok en ${((Date.now() - t0) / 1000).toFixed(1)}s, ${content.length} car.`)
      return { content, provider: p }
    } catch (e: any) {
      errors.push(`${p}: ${e?.message || e}`)
      logUsage(p, purpose, 0, false)
      console.warn(`[llm] ${p} échec (${purpose}): ${e?.message || e}`)
    }
  }
  throw new Error('Tous les fournisseurs LLM ont échoué — ' + errors.join(' | '))
}

/** Parse un JSON même entouré de ```json ...``` ou de texte parasite. */
export function parseJSONLoose<T = any>(text: string): T {
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = Math.min(
    ...['{', '['].map((c) => (t.includes(c) ? t.indexOf(c) : Infinity)).filter((n) => Number.isFinite(n))
  )
  if (Number.isFinite(start) && start > 0) t = t.slice(start)
  const lastBrace = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (lastBrace >= 0) t = t.slice(0, lastBrace + 1)
  return JSON.parse(t)
}

export async function checkOllama(url: string): Promise<boolean> {
  try {
    const r = await withTimeout(fetch(`${url.replace(/\/$/, '')}/api/tags`), 4000)
    return r.ok
  } catch {
    return false
  }
}

export async function checkInternet(): Promise<boolean> {
  try {
    const r = await withTimeout(fetch('https://api.mistral.ai/v1/models', { method: 'HEAD' }), 4000)
    return r.status < 500
  } catch {
    return false
  }
}
