import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Export Word 97-2003 (.doc) — document HTML compatible Word (ProgId Word.Document), lisible par Word 97 et suivants. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const title: string = body.title || 'Livre'
  const author: string = body.author || ''
  const contentHtml: string = body.html || ''
  const safeName = title.replace(/[^a-z0-9àâäéèêëïîôöùûüç \-]/gi, '').trim().slice(0, 60) || 'livre'
  // Échappe le titre/author pour éviter toute injection HTML dans le document généré
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const css = `
    body { font-family: 'Times New Roman', serif; font-size: 12pt; }
    p { line-height: 1.6; margin: 0 0 10pt 0; text-align: justify; }
    h1 { font-size: 22pt; text-align: center; margin: 24pt 0 12pt 0; }
    h2 { font-size: 16pt; margin: 18pt 0 10pt 0; }
    h3 { font-size: 13pt; margin: 14pt 0 8pt 0; }
    p.scene-heading { font-family: 'Courier New', monospace; text-transform: uppercase; font-weight: bold; }
    p.didascalie { font-style: italic; margin-left: 24pt; color: #555555; }
    p.cue { font-family: 'Courier New', monospace; text-transform: uppercase; }
    p.replique .pers { font-family: 'Courier New', monospace; text-transform: uppercase; font-weight: bold; }
    .front-page { page-break-before: always; }
    .dedicace-text { text-align: center; font-style: italic; margin-top: 120pt; }
    @page { size: A4; margin: 2cm; }
  `

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta name="ProgId" content="Word.Document" />
<meta name="Generator" content="Microsoft Word 9" />
<meta name="Originator" content="Microsoft Word 9" />
<title>${esc(title)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument>
</xml><![endif]-->
<style>${css}</style>
</head>
<body>
<p style="text-align:center;font-size:28pt;font-weight:bold;margin-top:200pt">${esc(title)}</p>
${author ? `<p style="text-align:center;font-size:14pt">${esc(author)}</p>` : ''}
<hr />
${contentHtml}
</body>
</html>`

  return new NextResponse(Buffer.from('\ufeff' + doc, 'utf-8'), {
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.doc"`,
    },
  })
}
