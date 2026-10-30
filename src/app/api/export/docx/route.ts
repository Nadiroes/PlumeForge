import { NextRequest, NextResponse } from 'next/server'
import HTMLtoDOCX from 'html-to-docx'

export const runtime = 'nodejs'
export const maxDuration = 60

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildDocumentHtml(bodyHtml: string, title: string, author: string) {
  const css = `
    p { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 0 0 10pt 0; text-align: justify; }
    h1 { font-family: 'Georgia', serif; font-size: 22pt; color: #1a1a1a; margin: 24pt 0 12pt 0; text-align: center; }
    h2 { font-family: 'Georgia', serif; font-size: 16pt; color: #222222; margin: 18pt 0 10pt 0; }
    h3 { font-family: 'Georgia', serif; font-size: 13pt; color: #333333; margin: 14pt 0 8pt 0; }
    blockquote { margin: 12pt 24pt; font-style: italic; color: #444444; }
    ol, ul { margin: 8pt 0 12pt 24pt; }
    p.scene-heading { font-family: 'Courier New', monospace; text-transform: uppercase; font-weight: bold; margin-top: 16pt; }
    p.didascalie { font-style: italic; margin-left: 24pt; color: #555555; }
    p.cue { font-family: 'Courier New', monospace; text-transform: uppercase; margin-top: 10pt; }
    p.replique .pers { font-family: 'Courier New', monospace; text-transform: uppercase; font-weight: bold; }
    .front-page { page-break-before: always; }
    .dedicace-text { text-align: center; font-style: italic; margin-top: 120pt; }
    hr.sep { border: none; border-top: 1px solid #999999; margin: 16pt 0; }
  `
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="author" content="${escapeHtml(author)}" />
<style>${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const title: string = body.title || 'Livre'
  const author: string = body.author || ''
  const contentHtml: string = body.html || ''
  const fullHtml = buildDocumentHtml(contentHtml, title, author)

  const buffer = await HTMLtoDOCX(fullHtml, undefined, {
    orientation: 'portrait',
    margins: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
    title,
    creator: author || 'PlumeForge',
    description: body.description || '',
    font: 'Times New Roman',
    fontSize: 24,
  })

  const safeName = title.replace(/[^a-z0-9àâäéèêëïîôöùûüç \-]/gi, '').trim().slice(0, 60) || 'livre'
  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.docx"`,
    },
  })
}
