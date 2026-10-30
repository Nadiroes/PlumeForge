import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const limit = Number(req.nextUrl.searchParams.get('limit') || 50)
  const messages = await db.chatMessage.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  })
  return NextResponse.json(messages.reverse())
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const msg = await db.chatMessage.create({
    data: { projectId: id, role: body.role === 'assistant' ? 'assistant' : 'user', content: String(body.content || '') },
  })
  return NextResponse.json(msg)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.chatMessage.deleteMany({ where: { projectId: id } })
  return NextResponse.json({ ok: true })
}
