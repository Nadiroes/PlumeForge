import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const full = req.nextUrl.searchParams.get('full')
  const project = await db.project.findUnique({
    where: { id },
    include: full ? { messages: { orderBy: { createdAt: 'asc' }, take: 100 } } : undefined,
  })
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  return NextResponse.json(project)
}

const FIELDS = [
  'title', 'docType', 'status', 'styleBible', 'learnings', 'outline',
  'contentHtml', 'chapterSummaries', 'coverFront', 'coverBack', 'progress',
  'wordCount', 'targetPages',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const f of FIELDS) if (f in body) data[f] = body[f]
  if (body.brief !== undefined) data.brief = typeof body.brief === 'string' ? body.brief : JSON.stringify(body.brief)
  const project = await db.project.update({ where: { id }, data })
  return NextResponse.json(project)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.project.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
