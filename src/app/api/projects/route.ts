import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, docType: true, status: true, wordCount: true,
      targetPages: true, createdAt: true, updatedAt: true, brief: true,
      coverFront: true, progress: true,
    },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const project = await db.project.create({
    data: {
      title: body.title || 'Sans titre',
      docType: body.docType || 'roman',
      brief: JSON.stringify(body.brief || {}),
      targetPages: body.brief?.targetPages || 20,
      coverFront: JSON.stringify(body.coverFront || {}),
      coverBack: JSON.stringify(body.coverBack || {}),
    },
  })
  return NextResponse.json(project)
}
