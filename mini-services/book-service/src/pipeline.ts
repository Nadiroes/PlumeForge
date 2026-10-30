// Pipeline de génération multi-agents avec mémoire persistante, pause/reprise et résilience
import { callLLM, parseJSONLoose, type LLMMessage, type ServiceSettings } from './llm'
import { mdToHtml, stripHtml } from './md'
import {
  demoAnnexes, demoChapter, demoFrontMatter, demoOutline, demoStyleBible,
} from './demo'

const API = process.env.NEXT_API_URL || 'http://localhost:3000'

export interface Brief {
  prompt: string
  docType: string
  ton: string
  narration: string
  humeur: string
  style: string
  targetPages: number
  genre?: string
  audience?: string
  extras?: Record<string, any>
  elements: {
    couverture: boolean; sommaire: boolean; preface: boolean; dedicace: boolean;
    corps: boolean; annexes: boolean; numberedAnnexes: boolean
  }
}

export interface Step { id: string; label: string; status: 'pending' | 'active' | 'done' | 'error' }

interface Job {
  projectId: string
  paused: boolean
  canceled: boolean
  running: boolean
}

class PipelineRunner {
  jobs = new Map<string, Job>()

  private job(projectId: string): Job {
    let j = this.jobs.get(projectId)
    if (!j) {
      j = { projectId, paused: false, canceled: false, running: false }
      this.jobs.set(projectId, j)
    }
    return j
  }

  isRunning(projectId: string) {
    return this.jobs.get(projectId)?.running || false
  }

  isPaused(projectId: string) {
    return this.jobs.get(projectId)?.paused || false
  }

  pause(projectId: string) {
    const j = this.jobs.get(projectId)
    if (j && j.running) j.paused = true
  }

  resume(projectId: string) {
    const j = this.jobs.get(projectId)
    if (j && j.running) j.paused = false
  }

  cancel(projectId: string) {
    const j = this.jobs.get(projectId)
    if (j) j.canceled = true
  }

  private async waitWhilePaused(job: Job) {
    while (job.paused && !job.canceled) await new Promise((r) => setTimeout(r, 600))
  }

  private async api(path: string, opts: any = {}) {
    const r = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
    if (!r.ok) throw new Error(`API ${path} -> ${r.status}`)
    return r.json()
  }

  async start(
    projectId: string,
    emit: (event: string, payload: any) => void
  ) {
    const job = this.job(projectId)
    if (job.running) {
      emit('gen:error', { projectId, message: 'Une génération est déjà en cours pour ce projet.' })
      return
    }
    job.running = true
    job.paused = false
    job.canceled = false

    try {
      const project: any = await this.api(`/api/projects/${projectId}?full=1`)
      const settings: ServiceSettings = await this.api(`/api/settings`)
      const brief: Brief = { elements: { couverture: false, sommaire: true, preface: false, dedicace: false, corps: true, annexes: false, numberedAnnexes: false }, ...JSON.parse(project.brief || '{}') }
      const docType = brief.docType || project.docType || 'roman'
      const unitLabel = docType === 'scenario' ? 'Séquence' : docType === 'theatre' ? 'Acte' : docType === 'sketch' ? 'Tableau' : docType === 'dialogue' ? 'Partie' : 'Chapitre'

      // ---- État de reprise
      const prevProgress = JSON.parse(project.progress || '{}')
      const resumeMode = (prevProgress.chaptersDone || 0) > 0 && (project.status === 'generation' || project.status === 'pause')
      let html = resumeMode ? project.contentHtml || '' : ''
      let summaries: string[] = resumeMode ? JSON.parse(project.chapterSummaries || '[]') : []
      let doneUnits = resumeMode ? prevProgress.chaptersDone || 0 : 0
      let wordCount = resumeMode ? project.wordCount || 0 : 0

      // ---- Construction des étapes
      const pages = Math.max(4, Math.min(120, brief.targetPages || 12))
      const totalUnits = Math.min(16, Math.max(3, Math.ceil(pages / 5)))
      const steps: Step[] = [
        { id: 'brief', label: 'Analyse du brief & bible de style', status: 'pending' },
        { id: 'outline', label: 'Construction du plan détaillé', status: 'pending' },
      ]
      if (brief.elements.preface || brief.elements.dedicace || brief.elements.sommaire) steps.push({ id: 'front', label: 'Pages liminaires (dédicace, préface, sommaire)', status: 'pending' })
      for (let i = 0; i < totalUnits; i++) steps.push({ id: `u${i + 1}`, label: `${unitLabel} ${i + 1}/${totalUnits} — rédaction & révision`, status: 'pending' })
      if (brief.elements.annexes) steps.push({ id: 'annexes', label: 'Annexes', status: 'pending' })
      steps.push({ id: 'assemble', label: 'Assemblage final', status: 'pending' })

      let doneCount = 0
      const total = steps.length
      let provider = '—'
      const emitProgress = (detail?: string) => {
        emit('gen:step', {
          projectId,
          steps,
          percent: Math.round((doneCount / total) * 100),
          detail,
          provider,
          state: 'running',
        })
      }

      const mark = (idx: number, status: Step['status']) => {
        // idx peut être -1 (étape absente selon les options du brief) — on ne crashe jamais le pipeline pour ça
        if (idx >= 0 && steps[idx]) steps[idx].status = status
      }

      const saveProgress = async () => {
        await this.api(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            contentHtml: html,
            chapterSummaries: JSON.stringify(summaries),
            wordCount,
            progress: JSON.stringify({ steps, chaptersDone: doneUnits, totalUnits }),
          }),
        })
      }

      if (job.canceled) throw new Error('Annulée')
      await this.api(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status: 'generation' }) })
      emitProgress(resumeMode ? `Reprise — ${doneUnits}/${totalUnits} déjà rédigés` : undefined)

      // ===== ÉTAPE 1 : BriefAgent — bible de style
      const si = { brief: 0, outline: 1 }
      let styleBible = project.styleBible || ''
      if (!styleBible || !resumeMode) {
        mark(si.brief, 'active'); emitProgress()
        try {
          const r = await callLLM([
            { role: 'system', content: 'Tu es le BriefAgent de PlumeForge, atelier d\'écriture IA. Tu produis des bibles de style concises et opérationnelles en français.' },
            { role: 'user', content: `Projet : « ${project.title} »\nBrief : ${JSON.stringify(brief, null, 1)}\n\nRédige la bible de style de ce livre : 6 à 9 lignes maximum, format liste. Elle doit fixer : le ton, le point de vue narratif, le temps verbal, le niveau de langue, les images récurrentes à cultiver, les clichés interdits, et 2-3 règles de format spécifiques au type "${docType}". Réponds uniquement par la bible, sans préambule.` },
          ], settings, 'bible-de-style')
          styleBible = r.content.trim()
          provider = r.provider
        } catch {
          styleBible = demoStyleBible(brief, project.title)
          provider = 'démo'
        }
        await this.api(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ styleBible }) })
      }
      mark(si.brief, 'done'); doneCount++
      if (job.canceled) throw new Error('Annulée')

      // ===== ÉTAPE 2 : OutlineAgent — plan détaillé
      let outline: { units: { index: number; title: string; summary: string; beats: string[] }[] } | null = null
      if (resumeMode) {
        try { outline = JSON.parse(project.outline || '') } catch { outline = null }
      }
      if (!outline?.units?.length) {
        mark(si.outline, 'active'); emitProgress()
        try {
          const r = await callLLM([
            { role: 'system', content: 'Tu es le OutlineAgent de PlumeForge. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte autour.' },
            { role: 'user', content: `Type d'écriture : ${docType}. Titre : « ${project.title} ». Brief : ${brief.prompt}. Ton : ${brief.ton}. Narration : ${brief.narration}. Humeur : ${brief.humeur}. Style : ${brief.style}.\n\nConstruis le plan de ce livre en ${totalUnits} unités (${unitLabel.toLowerCase()}s). Pour un scénario : séquences avec INT./EXT. Pour du théâtre : actes.\nRéponds EXACTEMENT avec ce JSON :\n{"units":[{"index":1,"title":"${unitLabel} 1 — …","summary":"2 phrases","beats":["beat 1","beat 2","beat 3"]}]}` },
          ], settings, 'plan')
          const j = parseJSONLoose<any>(r.content)
          if (j?.units?.length) {
            outline = { units: j.units.slice(0, totalUnits) }
            provider = r.provider
          }
        } catch { /* fallback */ }
        if (!outline?.units?.length) outline = demoOutline(brief, project.title)
        await this.api(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ outline: JSON.stringify(outline) }) })
      }
      mark(si.outline, 'done'); doneCount++
      emitProgress()
      if (job.canceled) throw new Error('Annulée')

      // ===== ÉTAPE 3 : pages liminaires (préface, dédicace, sommaire) — seulement en début de génération
      if (!resumeMode) {
        if (brief.elements.dedicace || brief.elements.preface || brief.elements.sommaire) {
          const fsi = steps.findIndex((s) => s.id === 'front')
          mark(fsi, 'active'); emitProgress()
          const parts: string[] = []
          let fm: { preface?: string; dedication?: string } = {}
          try {
            const r = await callLLM([
              { role: 'system', content: 'Tu es le FinalizerAgent de PlumeForge, écrivain français d\'avant-première.' },
              { role: 'user', content: `Livre : « ${project.title} » (${docType}). Brief : ${brief.prompt}. Ton : ${brief.ton}.\n${brief.elements.dedicace ? 'Rédige une dédicace (1-2 lignes, signature implicite).\n' : ''}${brief.elements.preface ? 'Rédige une préface de 2 paragraphes qui donne envie d\'entrer dans le livre.\n' : ''}\nRéponds au format Markdown avec les titres suivants si concerné : "DEDICACE:" puis la dédicace, puis "PREFACE:" puis la préface. Rien d'autre.` },
            ], settings, 'pages-liminaires')
            fm = this.parseFrontMatter(r.content)
            provider = r.provider
          } catch {
            fm = demoFrontMatter(brief, project.title, '')
          }
          if (fm.dedication) parts.push(`<div class="front-page dedication"><h2>Dédicace</h2><p class="dedicace-text">${fm.dedication.replace(/</g, '&lt;')}</p></div>`)
          if (fm.preface) parts.push(`<div class="front-page">${mdToHtml(fm.preface, docType)}</div>`)
          if (brief.elements.sommaire && outline) {
            const items = outline.units.map((u) => `<li>${u.title}</li>`).join('')
            parts.push(`<div class="front-page toc"><h2>Sommaire</h2><ol class="sommaire">${items}</ol></div>`)
          }
          if (parts.length) {
            const frontHtml = parts.join('\n')
            html = html ? html + '\n' + frontHtml : frontHtml
            emit('gen:delta', { projectId, html: frontHtml })
            await saveProgress()
          }
          mark(fsi, 'done'); doneCount++
          emitProgress()
        }
        if (job.canceled) throw new Error('Annulée')
      }

      // ===== ÉTAPE 4 : boucle d'écriture — WriterAgent → ReviewerAgent → FinalizerAgent
      const units = outline!.units
      for (let u = doneUnits; u < Math.min(totalUnits, units.length); u++) {
        if (job.canceled) throw new Error('Annulée')
        await this.waitWhilePaused(job)
        if (job.canceled) throw new Error('Annulée')
        const stepIdx = steps.findIndex((s) => s.id === `u${u + 1}`)
        mark(stepIdx, 'active'); emitProgress()

        const unit = units[u]
        const wordsTarget = Math.min(1100, Math.max(350, Math.round((pages * 280) / totalUnits)))
        const prevSummaries = summaries.slice(-4).map((s, k) => `- ${units[Math.max(0, u - 4) + k]?.title || 'Unité'} : ${s}`).join('\n')
        const formatRules = this.formatRules(docType)
        const learnings = (await this.reloadLearnings(projectId)) || ''

        // WriterAgent
        let draft = ''
        try {
          const r = await callLLM([
            { role: 'system', content: `Tu es le WriterAgent de PlumeForge. Tu écris en français, avec qualité professionnelle. ${formatRules}` },
            { role: 'user', content: `BIBLE DE STYLE :\n${styleBible}\n\nPRÉFÉRENCES APPRISES DE L'AUTEUR :\n${learnings || 'aucune pour le moment'}\n\nRÉSUMÉS DES UNITÉS PRÉCÉDENTES :\n${prevSummaries || 'c\'est le début du livre'}\n\nUNITÉ À RÉDIGER : ${unit.title}\nRésumé : ${unit.summary}\nPoints clés : ${JSON.stringify(unit.beats)}\n\nRédige cette unité complète (~${wordsTarget} mots). Commence obligatoirement par une ligne de titre Markdown "# ${unit.title}". Termine par une accroche qui donne envie de lire la suite. Aucun commentaire hors du texte.` },
          ], settings, `écriture ${u + 1}/${totalUnits}`)
          draft = r.content
          provider = r.provider
        } catch {
          draft = demoChapter(brief, unit, u)
          provider = 'démo'
        }

        await this.waitWhilePaused(job)
        if (job.canceled) throw new Error('Annulée')

        // ReviewerAgent + FinalizerAgent (polissage + résumé mémoire)
        let finalText = draft
        let summary = stripHtml(mdToHtml(draft, docType)).split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 240)
        try {
          const r = await callLLM([
            { role: 'system', content: `Tu es le ReviewerAgent puis FinalizerAgent de PlumeForge. Réponds UNIQUEMENT en JSON valide.` },
            { role: 'user', content: `BIBLE DE STYLE :\n${styleBible}\n\nBROUILLON DE L'UNITÉ :\n${draft.slice(0, 9000)}\n\nRelis ce texte : corrige les répétitions, les clichés, les ruptures de ton et de continuité avec les résumés précédents. Enrichis si nécessaire sans trahir le style.\nRéponds EXACTEMENT : {"summary":"résumé de l'unité en 2 phrases pour la mémoire du livre","text":"version finale complète corrigée en Markdown"}` },
          ], settings, `révision ${u + 1}/${totalUnits}`)
          const j = parseJSONLoose<any>(r.content)
          if (j?.text && j.text.length > draft.length * 0.5) finalText = j.text
          if (j?.summary) summary = String(j.summary).slice(0, 280)
        } catch { /* on garde le brouillon */ }

        const chapterHtml = mdToHtml(finalText, docType)
        html = html ? html + '\n' + chapterHtml : chapterHtml
        summaries.push(summary)
        doneUnits = u + 1
        wordCount += stripHtml(chapterHtml).split(/\s+/).filter(Boolean).length
        emit('gen:delta', { projectId, html: chapterHtml })
        mark(stepIdx, 'done'); doneCount++
        emitProgress(`${wordCount} mots`)
        await saveProgress()
      }

      // ===== ÉTAPE 5 : annexes
      if (brief.elements.annexes) {
        await this.waitWhilePaused(job)
        if (job.canceled) throw new Error('Annulée')
        const asi = steps.findIndex((s) => s.id === 'annexes')
        mark(asi, 'active'); emitProgress()
        let annexesMd = ''
        try {
          const r = await callLLM([
            { role: 'system', content: 'Tu es l\'AssemblerAgent de PlumeForge.' },
            { role: 'user', content: `Livre : « ${project.title} » (${docType}). Brief : ${brief.prompt}.\nRédige 2 annexes courtes et utiles (${brief.elements.numberedAnnexes ? 'numérotées "Annexe 1", "Annexe 2"' : 'intitulées "Annexe A", "Annexe B"'}) en lien direct avec le livre (notes, glossaire, documents fictifs, repères...). Markdown, titres "#".` },
          ], settings, 'annexes')
          annexesMd = r.content
          provider = r.provider
        } catch {
          annexesMd = demoAnnexes(brief, brief.elements.numberedAnnexes)
        }
        const annexHtml = `<div class="annexes">${mdToHtml(annexesMd, docType)}</div>`
        html = html + '\n' + annexHtml
        wordCount += stripHtml(annexHtml).split(/\s+/).filter(Boolean).length
        emit('gen:delta', { projectId, html: annexHtml })
        mark(asi, 'done'); doneCount++
        emitProgress()
        await saveProgress()
      }

      // ===== ÉTAPE 6 : assemblage final
      const last = steps.findIndex((s) => s.id === 'assemble')
      mark(last, 'active'); emitProgress()
      await this.api(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'termine', wordCount }),
      })
      mark(last, 'done'); doneCount++
      emit('gen:step', {
        projectId, steps, percent: 100, provider,
        detail: `${wordCount} mots · ${doneUnits} ${unitLabel.toLowerCase()}s`,
        state: 'running',
      })
      emit('gen:done', { projectId, words: wordCount, units: doneUnits, provider })
      this.jobs.delete(projectId)
    } catch (e: any) {
      const canceled = e?.message === 'Annulée'
      try {
        await this.api(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: canceled ? 'brouillon' : 'pause' }),
        })
      } catch { /* ignore */ }
      if (canceled) {
        emit('gen:status', { projectId, state: 'canceled' })
      } else {
        console.error('[pipeline] erreur:', e)
        emit('gen:error', { projectId, message: e?.message || 'Erreur de génération' })
      }
      this.jobs.delete(projectId)
    }
  }

  private parseFrontMatter(text: string): { preface?: string; dedication?: string } {
    const out: { preface?: string; dedication?: string } = {}
    const dedMatch = /DEDICACE\s*:?\s*([\s\S]*?)(?=PREFACE|$)/i.exec(text)
    const preMatch = /PREFACE\s*:?\s*([\s\S]*)$/i.exec(text)
    if (dedMatch) out.dedication = dedMatch[1].trim()
    if (preMatch) out.preface = preMatch[1].trim()
    if (!out.dedication && !out.preface && text.trim()) out.preface = text.trim()
    return out
  }

  private formatRules(docType: string): string {
    switch (docType) {
      case 'scenario':
        return 'FORMAT SCÉNARIO CINÉMA obligatoire : en-têtes de scène en majuscules commençant par INT. ou EXT. ; didascalies et actions entre astérisques (*…*) ; NOM DES PERSONNAGES en majuscules seul sur sa ligne ; dialogue à la ligne suivante. Utilise # pour le titre de séquence.'
      case 'theatre':
        return 'FORMAT THÉÂTRE obligatoire : titres d\'actes/scènes avec # et ## ; didascalies entre parenthèses sur leur propre ligne ; répliques au format exact "PERSONNAGE. — texte de la réplique".'
      case 'sketch':
        return 'FORMAT SKETCH obligatoire : unité de lieu, personnages récurrents, escalade comique, répliques au format "PERSONNAGE. — texte", chute marquée en fin.'
      case 'dialogue':
        return 'FORMAT DIALOGUE : échanges structurés au format "INTERLOCUTEUR. — texte", courts commentaires de cadrage entre astérisques si nécessaire.'
      default:
        return 'FORMAT PROSE : paragraphes riches et variés ; sous-titres ## autorisés pour les essais.'
    }
  }

  private async reloadLearnings(projectId: string): Promise<string> {
    try {
      const p: any = await this.api(`/api/projects/${projectId}`)
      return p.learnings || ''
    } catch {
      return ''
    }
  }

  // ================= AGENT CONVERSATIONNEL AVEC MÉMOIRE =================
  async chat(
    projectId: string,
    message: string,
    emit: (event: string, payload: any) => void
  ) {
    try {
      const project: any = await this.api(`/api/projects/${projectId}?full=1`)
      const settings: ServiceSettings = await this.api(`/api/settings`)
      const history: { role: string; content: string }[] = await this.api(`/api/projects/${projectId}/messages?limit=12`)
      const brief: Brief = { ...JSON.parse(project.brief || '{}') }

      await this.api(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: message }),
      })

      const textCtx = stripHtml(project.contentHtml || '').slice(-3200)
      const outlineTitles = (() => {
        try { return JSON.parse(project.outline || '{}').units?.map((u: any) => u.title).join(' · ') || '' } catch { return '' }
      })()
      const learningsList: string[] = (project.learnings || '').split('\n').filter(Boolean)

      const sys = `Tu es l'Agent Éditorial de PlumeForge, atelier d'écriture IA. Tu accompagnes l'auteur du projet « ${project.title} » (type : ${brief.docType || project.docType}, ton : ${brief.ton || 'neutre'}).
BIBLE DE STYLE EN VIGUEUR :
${project.styleBible || '(pas encore générée)'}
PLAN DU LIVRE : ${outlineTitles || '(pas encore construit)'}
PRÉFÉRENCES APPRISES DE L'AUTEUR :
${project.learnings || 'aucune pour le moment'}
FIN DU TEXTE EN COURS (extrait) :
${textCtx || '(document vide)'}

RÈGLES :
- Réponds toujours en français, de façon concise et actionnable (max ~200 mots sauf si l'auteur demande du texte).
- Quand l'auteur demande un texte (enrichir, réécrire, continuer), fournis-le prêt à insérer, en Markdown, dans un bloc précédé de la ligne "PROPOSITION :".
- Quand tu apprends une préférence durable (ton, style, structure), commence ta réponse par "NOTÉ : <la préférence en une phrase>".
- Tu ne réécris jamais le document entier sans demande explicite.`

      const msgs: LLMMessage[] = [
        { role: 'system', content: sys },
        ...history.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }) as LLMMessage),
        { role: 'user', content: message },
      ]

      let reply = ''
      try {
        const r = await callLLM(msgs, settings, 'agent-conversationnel')
        reply = r.content
      } catch {
        reply = (await import('./demo')).demoChatReply(message, {
          title: project.title, docType: brief.docType || project.docType, learnings: learningsList,
        })
      }

      // Détection d'un apprentissage explicite "NOTÉ : ..."
      let learningLine: string | null = null
      const noted = /^NOTÉ\s*:\s*(.+)$/im.exec(reply)
      if (noted) {
        learningLine = noted[1].trim()
      } else {
        // Extraction légère d'une préférence
        try {
          const r = await callLLM([
            { role: 'system', content: 'Tu extrais des préférences d\'écriture durables. Réponds par la préférence en une seule phrase courte, ou par le mot RIEN si aucune.' },
            { role: 'user', content: `Message de l'auteur : « ${message} »\nPréférences déjà connues :\n${project.learnings || 'aucune'}\n\nNouvelle préférence durable à retenir pour la suite du livre (ou RIEN) ?` },
          ], settings, 'extraction-préférence')
          const v = r.content.trim().toUpperCase() === 'RIEN' ? null : r.content.trim()
          if (v && v.length < 160 && !project.learnings.includes(v.slice(0, 40))) learningLine = v
        } catch {
          learningLine = (await import('./demo')).demoLearning(message)
        }
      }

      // Streaming simulé token par token (effet "écriture en direct")
      const tokens = reply.match(/\S+\s*/g) || [reply]
      for (const t of tokens) {
        emit('chat:delta', { projectId, delta: t })
        await new Promise((r) => setTimeout(r, 22))
      }

      // Nettoyage de la ligne NOTÉ dans la réponse persistée
      const cleanReply = reply.replace(/^NOTÉ\s*:.*$/im, '').trim()
      await this.api(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ role: 'assistant', content: cleanReply }),
      })

      if (learningLine) {
        const updated = ((project.learnings || '') + (project.learnings ? '\n' : '') + '• ' + learningLine).slice(0, 2000)
        await this.api(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ learnings: updated }) })
        emit('chat:learning', { projectId, learning: learningLine, all: updated })
      }
      emit('chat:done', { projectId })
    } catch (e: any) {
      console.error('[chat] erreur:', e)
      emit('chat:error', { projectId, message: e?.message || 'Erreur de l\'agent' })
    }
  }
}

export const pipeline = new PipelineRunner()
