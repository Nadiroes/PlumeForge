// Convertisseur Markdown -> HTML avec support des formats scénario, théâtre, sketch, dialogue
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string): string {
  let t = esc(s)
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  return t
}

const SCRIPT_TYPES = new Set(['scenario', 'theatre', 'sketch', 'dialogue'])

export function mdToHtml(md: string, docType: string): string {
  const isScript = SCRIPT_TYPES.has(docType)
  const lines = (md || '').replace(/\r/g, '').split('\n')
  const out: string[] = []
  let i = 0
  const flushList = (tag: 'ul' | 'ol') => {
    const items: string[] = []
    while (i < lines.length) {
      const l = lines[i].trim()
      const m = tag === 'ul' ? /^[-*•]\s+(.*)$/.exec(l) : /^\d+[.)]\s+(.*)$/.exec(l)
      if (!m) break
      items.push(`<li>${inline(m[1])}</li>`)
      i++
    }
    out.push(`<${tag}>${items.join('')}</${tag}>`)
  }
  while (i < lines.length) {
    const raw = lines[i]
    const l = raw.trim()
    if (!l) { i++; continue }
    // Titres
    const h = /^(#{1,4})\s+(.*)$/.exec(l)
    if (h) {
      const lvl = Math.min(h[1].length + 1, 4) // # -> h2 dans le corps du livre
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) { out.push('<hr class="sep" />'); i++; continue }
    // Blocquote
    if (l.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        buf.push(inline(lines[i].trim().slice(2)))
        i++
      }
      out.push(`<blockquote>${buf.join('<br />')}</blockquote>`)
      continue
    }
    // Listes
    if (/^[-*•]\s+/.test(l)) { flushList('ul'); continue }
    if (/^\d+[.)]\s+/.test(l)) { flushList('ol'); continue }
    // En-têtes de scène scénario : INT. / EXT. / SÉQUENCE / SCENE
    if (isScript && /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|SÉQUENCE|SEQUENCE|SÉQ\.|SEQ\.|ACTE\s+[IVX0-9]|SCÈNE\s|SCENE\s)/i.test(l)) {
      out.push(`<p class="scene-heading">${inline(l)}</p>`)
      i++
      continue
    }
    // Didascalies théâtre : ( ... ) sur une ligne entière
    if (isScript && /^\(.*\)$/.test(l) && l.length > 2) {
      out.push(`<p class="didascalie">${inline(l.slice(1, -1))}</p>`)
      i++
      continue
    }
    // Didascalies scénario : * ... * sur une ligne entière
    if (isScript && /^\*[^*]+\*$/.test(l)) {
      out.push(`<p class="didascalie">${inline(l.slice(1, -1))}</p>`)
      i++
      continue
    }
    // Réplique théâtrale : "NOM. — texte" ou "NOM — texte"
    const rep = /^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 .,'’\-]{0,38})\s*[.—–-]?\s*—\s+(.*)$/.exec(l)
    if (isScript && rep && rep[1].trim().length > 1) {
      out.push(`<p class="replique"><span class="pers">${esc(rep[1].trim())}.</span> — ${inline(rep[2])}</p>`)
      i++
      continue
    }
    // Nom de personnage en majuscules seul sur sa ligne (cue scénario)
    if (
      isScript &&
      /^[A-ZÀ-ÖØ-Þ0-9 .,'’\-]{2,38}$/.test(l) &&
      !l.endsWith('.') &&
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !/^(#{1,4})\s|^(INT\.|EXT\.)/i.test(lines[i + 1].trim())
    ) {
      out.push(`<p class="cue">${esc(l)}</p>`)
      i++
      continue
    }
    // Paragraphe normal (regroupe les lignes collées)
    const buf: string[] = [l]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4})\s|^[-*•]\s|^\d+[.)]\s|^>\s|^(-{3,})$/.test(lines[i].trim()) &&
      !(isScript && /^(INT\.|EXT\.|SÉQUENCE|SCÈNE|SCENE|ACTE\s)/i.test(lines[i].trim()))
    ) {
      buf.push(lines[i].trim())
      i++
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  return out.join('\n')
}

export function stripHtml(html: string): string {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|h4|li|blockquote|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
