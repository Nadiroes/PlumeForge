import { NextRequest, NextResponse } from 'next/server'
import TurndownService from 'turndown'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const html: string = body.html || ''
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  const md = td.turndown(html)
  const safeName = (body.title || 'livre').replace(/[^a-z0-9àâäéèêëïîôöùûüç \-]/gi, '').trim().slice(0, 60) || 'livre'
  return new NextResponse(Buffer.from(md, 'utf-8'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.md"`,
    },
  })
}
