import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Prompt requis' }, { status: 400 })
    const zai = await ZAI.create()
    const response = await zai.images.generations.create({
      prompt: `${prompt}. Illustration de couverture de livre, composition verticale épurée, riche en atmosphère, sans texte dans l'image, haute qualité`,
      size: '768x1344',
    })
    const b64 = response?.data?.[0]?.base64
    if (!b64) throw new Error('Réponse image vide')
    return NextResponse.json({ dataUrl: `data:image/png;base64,${b64}` })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Génération d\'image indisponible (hors-ligne ?)' },
      { status: 503 }
    )
  }
}
