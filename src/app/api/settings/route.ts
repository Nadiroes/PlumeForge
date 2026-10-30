import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function getSettings() {
  let s = await db.settings.findUnique({ where: { id: 'default' } })
  if (!s) s = await db.settings.create({ data: { id: 'default' } })
  return s
}

export async function GET() {
  return NextResponse.json(await getSettings())
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const f of ['mistralKey', 'agnesKey', 'ollamaUrl', 'ollamaModel', 'providerOrder', 'authorName']) {
    if (f in body) data[f] = String(body[f] ?? '')
  }
  const s = await db.settings.update({ where: { id: 'default' }, data })
  return NextResponse.json(s)
}
