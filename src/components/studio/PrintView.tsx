'use client'

import { useStudio } from '@/lib/store'
import { CoverDoc, parseJson, defaultCover } from '@/lib/types'

/** Zone visible uniquement à l'impression (PDF via la boîte d'impression navigateur). */
export default function PrintView() {
  const current = useStudio((s) => s.current)
  const author = useStudio((s) => s.printAuthor)
  if (!current) return null

  const brief = parseJson<{ elements?: { couverture?: boolean; dedicace?: boolean; sommaire?: boolean } }>(current.brief, {})
  const elements = brief.elements || {}
  const front = parseJson<CoverDoc>(current.coverFront, defaultCover())
  const back = parseJson<CoverDoc>(current.coverBack, defaultCover())
  const outline = parseJson<{ units?: { title: string }[] }>(current.outline, {})

  return (
    <div id="print-root" aria-hidden className="print-only">
      {/* Page de couverture avant */}
      {elements.couverture !== false && (
        <div className="print-cover" style={coverStyle(front)}>
          <div className="print-cover-inner">
            {front.texts.map((t, i) => (
              <div key={i} style={{
                left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%,-50%)',
                maxWidth: `${t.maxWidth}%`, textAlign: t.align, color: t.color,
                fontSize: `${Math.round(t.size * 0.75)}pt`, fontWeight: t.bold ? 700 : 400,
                fontStyle: t.italic ? 'italic' : 'normal', fontFamily: t.font,
                whiteSpace: 'pre-wrap', position: 'absolute',
              }}>
                {t.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page de titre */}
      <div className="print-page print-title-page">
        <h1 className="print-book-title">{current.title}</h1>
        <p className="print-book-author">{author}</p>
        <p className="print-book-meta">PlumeForge — {current.wordCount.toLocaleString('fr-FR')} mots</p>
      </div>

      {/* Sommaire */}
      {elements.sommaire !== false && outline.units && outline.units.length > 0 && (
        <div className="print-page">
          <h2 className="print-section-title">Sommaire</h2>
          <ol className="print-toc">
            {outline.units.map((u, i) => <li key={i}>{u.title}</li>)}
          </ol>
        </div>
      )}

      {/* Corps */}
      <div className="print-page print-body" dangerouslySetInnerHTML={{ __html: current.contentHtml || '' }} />

      {/* Quatrième de couverture */}
      {elements.couverture !== false && (back.texts.length > 0 || back.bgType === 'image') && (
        <div className="print-cover" style={coverStyle(back)}>
          <div className="print-cover-inner">
            {back.texts.map((t, i) => (
              <div key={i} style={{
                left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%,-50%)',
                maxWidth: `${t.maxWidth}%`, textAlign: t.align, color: t.color,
                fontSize: `${Math.round(t.size * 0.55)}pt`, fontWeight: t.bold ? 700 : 400,
                fontStyle: t.italic ? 'italic' : 'normal', fontFamily: t.font,
                whiteSpace: 'pre-wrap', position: 'absolute',
              }}>
                {t.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function coverStyle(d: CoverDoc): React.CSSProperties {
  if (d.bgType === 'image' && d.imageDataUrl) {
    return { backgroundImage: `url(${d.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (d.bgType === 'gradient') {
    return { backgroundImage: `linear-gradient(135deg, ${d.gradFrom}, ${d.gradTo})` }
  }
  return { backgroundColor: d.bgColor }
}
