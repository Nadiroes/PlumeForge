export interface BriefElements {
  couverture: boolean
  sommaire: boolean
  preface: boolean
  dedicace: boolean
  corps: boolean
  annexes: boolean
  numberedAnnexes: boolean
}

export interface Brief {
  prompt: string
  docType: string
  genre?: string
  audience?: string
  ton: string
  narration: string
  humeur: string
  style: string
  targetPages: number
  extras?: Record<string, any>
  elements: BriefElements
}

export interface ProjectSummary {
  id: string
  title: string
  docType: string
  status: string
  wordCount: number
  targetPages: number
  brief: string
  coverFront: string
  progress: string
  createdAt: string
  updatedAt: string
}

export interface ChatMsg {
  id: string
  projectId: string
  role: string
  content: string
  createdAt: string
}

export interface ProjectFull {
  id: string
  title: string
  docType: string
  status: string
  brief: string
  styleBible: string
  learnings: string
  outline: string
  contentHtml: string
  chapterSummaries: string
  coverFront: string
  coverBack: string
  progress: string
  wordCount: number
  targetPages: number
  createdAt: string
  updatedAt: string
  messages?: ChatMsg[]
}

export interface GenStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export interface GenState {
  running: boolean
  paused: boolean
  steps: GenStep[]
  percent: number
  detail: string
  provider: string
  error: string
  doneInfo: string
}

export interface CoverText {
  id: string
  text: string
  x: number // %
  y: number // %
  size: number // px
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  font: string
  maxWidth: number // %
}

export interface CoverDoc {
  bgType: 'solid' | 'gradient' | 'image'
  bgColor: string
  gradFrom: string
  gradTo: string
  imageDataUrl?: string
  texts: CoverText[]
}

export const DOC_TYPES = [
  { id: 'roman', label: 'Roman', desc: 'Fiction longue par chapitres', icon: 'book' },
  { id: 'essai', label: 'Essai', desc: 'Réflexion, argumentation, vulgarisation', icon: 'bulb' },
  { id: 'scenario', label: 'Scénario de cinéma', desc: 'Séquences, scènes, dialogues formatés', icon: 'clapper' },
  { id: 'theatre', label: 'Pièce de théâtre', desc: 'Actes, scènes, didascalies', icon: 'scroll' },
  { id: 'sketch', label: 'Sketch', desc: 'Comédie courte, escalade, chute', icon: 'laugh' },
  { id: 'dialogue', label: 'Recueil de dialogues', desc: 'Échanges structurés, entretiens', icon: 'messages' },
] as const

export const TONES = ['Neutre', 'Humoristique', 'Sombre', 'Lyrique', 'Didactique', 'Épique', 'Tendre', 'Persuasif']
export const NARRATIONS = ['Première personne', 'Troisième personne limitée', 'Troisième personne omnisciente', 'Deuxième personne']
export const HUMEURS = ['Légère', 'Tendue', 'Mélancolique', 'Épique', 'Contemplative', 'Joyeuse']
export const STYLES = ['Concis', 'Fleuri', 'Oral', 'Journalistique', 'Poétique', 'Cinématographique']

export const defaultBrief = (): Brief => ({
  prompt: '',
  docType: 'roman',
  ton: 'Neutre',
  narration: 'Troisième personne omnisciente',
  humeur: 'Contemplative',
  style: 'Concis',
  targetPages: 12,
  elements: {
    couverture: true, sommaire: true, preface: false, dedicace: false,
    corps: true, annexes: false, numberedAnnexes: false,
  },
})

export const defaultCover = (): CoverDoc => ({
  bgType: 'gradient',
  bgColor: '#1e293b',
  gradFrom: '#0f172a',
  gradTo: '#334155',
  texts: [],
})

export function parseJson<T>(raw: string | undefined | null, fallback: T): T {
  try {
    const v = raw ? JSON.parse(raw) : null
    if (v === null || v === undefined) return fallback
    // Fusionne avec les défauts pour que les objets partiels restent exploitables
    if (
      typeof v === 'object' && !Array.isArray(v) &&
      typeof fallback === 'object' && !Array.isArray(fallback)
    ) {
      return { ...(fallback as object), ...(v as object) } as T
    }
    return v as T
  } catch {
    return fallback
  }
}
