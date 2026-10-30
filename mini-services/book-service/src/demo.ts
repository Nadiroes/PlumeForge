// Générateur 100% hors-ligne — garantit que le studio fonctionne sans réseau ni clé API
import type { LLMMessage } from './llm'

function keywords(prompt: string): string[] {
  const stop = new Set([
    'dans', 'avec', 'pour', 'cette', 'celui', 'celle', 'histoire', 'livre', 'roman', 'essai',
    'scénario', 'pièce', 'sketch', 'dialogue', 'veux', 'voudrais', 'faire', 'écrire', 'creer',
    'créer', 'sur', 'les', 'des', 'une', 'que', 'qui', 'quoi', 'plus', 'tout', 'tous', 'être'
  ])
  const words = (prompt || '')
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stop.has(w))
  return [...new Set(words)].slice(0, 6)
}

function pick<T>(arr: T[], n: number): T[] {
  const c = [...arr]
  const out: T[] = []
  while (c.length && out.length < n) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0])
  return out
}

const TONE_WORDS: Record<string, string[]> = {
  sombre: ['oppressante', 'minérale', 'sans concessions', 'aux ombres longues'],
  humoristique: ['pétillante', 'irrévérencieuse', 'drôlement lucide'],
  lyrique: ['charnelle', 'lumineuse', 'aux images franches'],
  didactique: ['précise', 'rigoureuse', 'pédagogique'],
  neutre: ['sobres', ' nettes', 'assurées'],
  epique: ['vertigineuse', 'pulvérisante', 'aux souffles immenses'],
  tendre: ['douce', 'attentionnée', 'fragile et tenace']
}

const UNIT_LABEL: Record<string, string> = {
  roman: 'Chapitre', essai: 'Chapitre', scenario: 'Séquence',
  theatre: 'Acte', sketch: 'Tableau', dialogue: 'Partie'
}

export function demoStyleBible(brief: any, title: string): string {
  const tone = brief.ton || 'neutre'
  const t = (TONE_WORDS[tone] || TONE_WORDS.neutre).join(', ')
  return [
    `TITRE : ${title}`,
    `TYPE : ${brief.docType || 'roman'} — TON : ${tone} — NARRATION : ${brief.narration || 'troisième personne'} — HUMEUR : ${brief.humeur || 'neutre'} — STYLE : ${brief.style || 'concis'}`,
    `DIRECTION : le texte garde des phrases ${t}. Le thème central est : ${brief.prompt?.slice(0, 140)}`,
    `RÈGLES : éviter les clichés, varier le rythme des paragraphes, ancrer chaque scène dans un lieu concret, terminer chaque unité sur une accroche.`
  ].join('\n')
}

export function demoOutline(brief: any, title: string): { units: { index: number; title: string; summary: string; beats: string[] }[] } {
  const label = UNIT_LABEL[brief.docType] || 'Chapitre'
  const pages = Math.max(4, Math.min(40, brief.targetPages || 12))
  const n = Math.min(8, Math.max(3, Math.ceil(pages / 4)))
  const kws = keywords(brief.prompt)
  const arcs = [
    ['Le déclenchement', 'l\'équilibre quotidien se fissure et pousse à agir'],
    ['Le premier pas', 'l\'héroïne franchit un seuil sans revenir en arrière'],
    ['Les obstacles', 'les alliés comme les rivales compliquent la traversée'],
    ['La révélation', 'une vérité cachée redistribue les cartes'],
    ['La tempête', 'tout ce qui pouvait vaciller vacille enfin'],
    ['Le choix', 'un arbitrage coûteux trace la ligne du récit'],
    ['La renaissance', 'de ce qui restait, quelque chose repousse'],
    ['Le dénouement', 'le monde apaisé garde la trace du voyage']
  ]
  const units: { index: number; title: string; summary: string; beats: string[] }[] = []
  for (let i = 0; i < n; i++) {
    const a = arcs[Math.min(i, arcs.length - 1)]
    const kw = kws[i % Math.max(1, kws.length)] || 'le sujet'
    units.push({
      index: i + 1,
      title: `${label} ${i + 1} — ${a[0]}`,
      summary: `Ce ${label.toLowerCase()} explore ${a[1]} autour de ${kw}.`,
      beats: [
        `Mise en place liée à ${kw}`,
        `Complication qui engage ${a[0].toLowerCase()}`,
        `Accroche finale vers la suite`
      ]
    })
  }
  return { units }
}

const OPENERS = [
  'Il y a d' + "'" + 'abord le silence, celui qui précise tout le reste.',
  'La lumière tombait en biais sur les choses simples.',
  'On dit que rien n' + "'" + 'arrive par hasard ; le récit allait le prouver.',
  'Tout commence là où l' + "'" + 'on ne l' + "'" + 'attend plus.',
  'Le matin sentait la pluie tiède et les décisions neuves.'
]

const BODY_TPL = [
  'Autour de {kw}, les gestes reprennent leur place : celui qui observe, celui qui hésite, celui qui avance. La scène s\'installe avec une précision {tone}, et le détail le plus minuscule devient une porte. On comprend vite que rien ne sera plus tout à fait pareil.',
  'Ce qui se joue là, c\'est la part de {kw} que personne ne nomme à voix haute. Les dialogues frottent l\'un contre l\'autre, se cherchent, se heurtent ; chaque réplique en cache une autre. Le récit respire au rythme {tone}, et la tension monte d\'un cran, imperceptible.',
  'La mémoire du lieu travaille en sourdine. {Kw} revient comme un refrain, mais déplacé, transformé, presque méconnaissable. On avance d\'un pas, puis de deux, et le monde du livre élargit ses contours sans jamais perdre son axe.',
  'Une évidence s\'impose : {kw} n\'est pas un décor, c\'est un moteur. Les personnages le découvrent à leurs dépens, entre ce qu\'ils disent et ce qu\'ils taisent. Le style, {tone}, garde la main ferme sur le gouvernail.',
  'À mesure que l\'heure tourne, les certitudes s\'échelonnent comme des marches. {Kw} impose sa logique propre, plus intime qu\'il n\'y paraissait. Il faudra choisir, et choisir coûte toujours : c\'est précisément là que le récit prend son sens.',
  'Le soir referme la journée comme un livre qu\'on relit. Ce qui restera de {kw}, ce n\'est pas la matière, c\'est l\'onde. Une onde {tone} qui porte jusqu\'à la page suivante, promesse d\'un basculement encore invisible.'
]

export function demoChapter(brief: any, unit: any, chapterIndex: number): string {
  const docType = brief.docType || 'roman'
  const kws = keywords(brief.prompt)
  const kw = kws[chapterIndex % Math.max(1, kws.length)] || 'le sujet'
  const toneList = TONE_WORDS[brief.ton] || TONE_WORDS.neutre
  const tone = (toneList[chapterIndex % toneList.length] || 'assurée').trim()
  const lines: string[] = [`# ${unit.title}`]
  if (docType === 'scenario') {
    lines.push(`*INT. LIEU PRINCIPAL — JOUR*`, '')
    lines.push(`*Un espace vécu. ${unit.summary} L'atmosphère est ${tone}.*`, '')
    const chars = ['MARTIN', 'CLAIRE', 'SOLVEIG']
    lines.push(chars[0])
    lines.push(`Tout tourne autour de ${kw}. On ne peut plus faire semblant.`)
    lines.push(chars[1])
    lines.push(`Alors on décide. Maintenant.`)
    lines.push(`*Ils se regardent. Le bruit du dehors s'arrête un instant.*`)
    lines.push(chars[0])
    lines.push(`Si on se trompe, on l'assumera ensemble.`)
  } else if (docType === 'theatre' || docType === 'sketch') {
    lines.push(`*Un plateau presque nu. ${unit.summary}*`, '')
    lines.push(`PREMIER PERSONNAGE. — Tout tourne autour de ${kw}, et le public le sait avant nous.`)
    lines.push(`DEUXIÈME PERSONNAGE. — C'est précisément ce qui rend la chose ${tone}.`)
    lines.push(`PREMIER PERSONNAGE. — Alors jouons-la jusqu'au bout, jusqu'à la chute.`)
    lines.push(`*(Ils se tournent vers la salle. Noir.)*`)
  } else if (docType === 'dialogue') {
    lines.push(`ÉCRIVAIN. — Comment nommer ce qui nous occupe : ${kw} ?`)
    lines.push(`LECTRICE. — Je dirais que c'est une question de regard avant d'être une question de mots.`)
    lines.push(`ÉCRIVAIN. — Le regard décide, le mot transporte. Les deux font le trajet.`)
    lines.push(`LECTRICE. — Alors continuons le trajet, ${tone}, pas à pas.`)
  } else {
    lines.push(...pick(OPENERS, 1))
    lines.push('')
    const nParas = 5 + Math.floor(Math.random() * 2)
    const tpls = pick(BODY_TPL, nParas)
    for (const tpl of tpls) {
      lines.push(
        tpl.replace(/\{kw\}/g, kw).replace(/\{Kw\}/g, kw.charAt(0).toUpperCase() + kw.slice(1)).replace(/\{tone\}/g, tone)
      )
      lines.push('')
    }
  }
  return lines.join('\n')
}

export function demoFrontMatter(brief: any, title: string, author: string): { preface?: string; dedication?: string } {
  const out: { preface?: string; dedication?: string } = {}
  if (brief.elements?.dedicace) {
    out.dedication = `À celles et ceux qui reconnaîtront ici un fragment de leur propre histoire — et à ${author || 'tous ceux qui lisent entre les lignes'}.`
  }
  if (brief.elements?.preface) {
    out.preface = `# Préface\n\nCe livre est né d'une question simple : ${brief.prompt?.slice(0, 160) || 'que reste-t-il quand tout bouge ?'}\n\nOn y trouvera un ton ${brief.ton || 'neutre'}, une narration ${brief.narration || 'classique'}, et l'ambition de tenir la promesse de son titre jusqu'à la dernière page. Le lecteur jugera ; l'auteur, lui, a déjà tout mis dans ces pages.\n\nBonne traversée.`
  }
  return out
}

export function demoAnnexes(brief: any, numbered: boolean): string {
  const kws = keywords(brief.prompt)
  const n = (i: number) => (numbered ? `Annexe ${i}` : `Annexe ${String.fromCharCode(64 + i)}`)
  return [
    `# ${n(1)} — Notes sur ${kws[0] || 'le thème'}`,
    '',
    `Repères et échos qui ont nourri l'écriture : sources d'inspiration, lectures croisées, et ce que le texte doit à la réalité.`,
    '',
    `# ${n(2)} — Glossaire`,
    '',
    `Les mots-clés du livre définis en quelques lignes chacun, pour que le lecteur retrouve le fil à tout moment.`,
  ].join('\n')
}

export function demoChatReply(message: string, ctx: { title: string; docType: string; learnings: string[] }): string {
  const m = (message || '').toLowerCase()
  if (m.includes('sombre') || m.includes('noir')) {
    return `J'ai noté : vous voulez une atmosphere plus sombre. Concrètement, je vous propose de : 1) ancrer les scènes dans des lieux clos ou crépusculaires, 2) raccourcir les phrases d'action, 3) laisser les personnages ne pas dire l'essentiel. Voici un exemple de paragraphe réécrit dans ce sens :\n\n> La pièce avait rétréci. Les objets y gardaient l'ombre comme on garde rancune, et la parole, quand elle venait, tombait d'une hauteur qu'on n'avait pas le droit de contester.`
  }
  if (m.includes('dialogue')) {
    return `Pour densifier les dialogues, je recommande la règle du sous-texte : chaque réplique devrait porter un désir non dit. Essayez ceci :\n\n> — Tu pars.\n> — Je rentre. C'est différent.\n> — Personne ne rentre un vendredi soir.\n> — Alors j'invente. Ça te va ?`
  }
  if (m.includes('court') || m.includes('trop long')) {
    return `Compris : je serai plus sobre. Une piste — couper toute phrase où un adjectif fait le travail d'un verbe. Envoyez-moi le passage exact et je vous en propose une version resserrée, prête à insérer dans le document.`
  }
  if (m.includes('titre')) {
    const kws = keywords(ctx.title || 'histoire')
    return `Quelques pistes de titre autour de votre idée :\n\n1. **Ce que ${kws[0] || 'le silence'} laisse passer**\n2. **La part minérale**\n3. **Jusqu'à la dernière lumière**\n\nDites-moi laquelle vous parle, je peux en décliner dix variantes.`
  }
  return `J'ai bien noté votre demande : « ${message.slice(0, 120)} ». Je l'applique désormais à la suite de « ${ctx.title} ». Vous pouvez me demander d'enrichir un passage, de réécrire un paragraphe dans un autre ton, ou de générer du texte prêt à insérer dans l'éditeur — je m'appuie sur la bible de style et sur vos préférences apprises (${ctx.learnings.length} en mémoire).`
}

export function demoLearning(message: string): string | null {
  const m = (message || '').toLowerCase()
  if (m.includes('sombre')) return 'Préfère une atmosphère plus sombre.'
  if (m.includes('court')) return 'Préfère des phrases plus courtes et sobres.'
  if (m.includes('dialogue')) return 'Aime les dialogues denses avec sous-texte.'
  if (m.includes('suspense') || m.includes('accroche')) return 'Aime les fins d\'unité suspensives.'
  if (m.includes('poétique') || m.includes('lyrique')) return 'Préfère un style lyrique et imagé.'
  return null
}

/** Mode démo pour l'agent conversationnel simulé via callLLM (jamais appelé en vrai). */
export function demoFromMessages(_messages: LLMMessage[]): string {
  return ''
}
