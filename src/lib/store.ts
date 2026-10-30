'use client'

import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type {
  Brief, ChatMsg, CoverDoc, GenState, ProjectFull, ProjectSummary,
} from './types'
import { parseJson } from './types'

let socket: Socket | null = null
let socketStarted = false
let everConnected = false
const handlers = new Map<string, Set<(...args: any[]) => void>>()
const pendingEmits: [string, ...any[]][] = []

const SOCK_OPTS = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1500,
  timeout: 12000,
  path: '/',
}

function attachHandlers(s: Socket) {
  handlers.forEach((set, ev) => set.forEach((fn) => s.on(ev, fn)))
  s.on('connect', () => {
    everConnected = true
    while (pendingEmits.length) {
      const [ev, ...args] = pendingEmits.shift()!
      s.emit(ev, ...args)
    }
  })
}

function openGateway() {
  const s = io('/?XTransformPort=3030', SOCK_OPTS)
  socket = s
  attachHandlers(s)
  let swapped = false
  s.on('connect_error', () => {
    if (swapped) return
    swapped = true
    // La passerelle Caddy n'est pas dans le chemin (accès local direct) → service sur son port réel
    try { s.close() } catch { /* ignore */ }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const direct = io(`http://${host}:3030`, SOCK_OPTS)
    socket = direct
    attachHandlers(direct)
  })
}

export interface SockLike {
  on(ev: string, fn: (...args: any[]) => void): void
  emit(ev: string, ...args: any[]): void
}

const facade: SockLike = {
  on(ev, fn) {
    if (!handlers.has(ev)) handlers.set(ev, new Set())
    handlers.get(ev)!.add(fn)
    if (socket) socket.on(ev, fn)
  },
  emit(ev, ...args) {
    if (socket && (socket.connected || everConnected)) socket.emit(ev, ...args)
    else pendingEmits.push([ev, ...args])
  },
}

export function getSocket(): SockLike {
  if (!socketStarted) {
    socketStarted = true
    openGateway()
  }
  return facade
}

export interface SaveState {
  saving: boolean
  lastSaved: string
}

interface StudioState {
  view: 'library' | 'editor'
  projects: ProjectSummary[]
  loadingProjects: boolean
  current: ProjectFull | null
  saveState: SaveState
  gen: GenState
  chat: ChatMsg[]
  chatStreaming: boolean
  chatStreamText: string
  conn: { online: boolean; internet: boolean; ollama: boolean; checked: boolean }
  wizardOpen: boolean
  settingsOpen: boolean
  coverOpen: boolean
  exportOpen: boolean
  progressOpen: boolean
  deltaTick: number
  lastDelta: string
  insertFn: ((html: string) => void) | null
  printAuthor: string
  syncTick: number

  setView: (v: 'library' | 'editor') => void
  setInsertFn: (fn: ((html: string) => void) | null) => void
  setPrintAuthor: (a: string) => void
  openWizard: (v: boolean) => void
  openSettings: (v: boolean) => void
  openCover: (v: boolean) => void
  openExport: (v: boolean) => void
  openProgress: (v: boolean) => void

  loadProjects: () => Promise<void>
  createProject: (title: string, brief: Brief) => Promise<ProjectFull | null>
  openProject: (id: string) => Promise<void>
  closeProject: () => void
  patchProject: (patch: Record<string, unknown>, silent?: boolean) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
  setTitle: (t: string) => void

  saveContent: (html: string, wordCount: number) => void
  applyDelta: (html: string) => void

  startGeneration: () => Promise<void>
  pauseGeneration: () => void
  resumeGeneration: () => void
  cancelGeneration: () => void

  loadMessages: (projectId: string) => Promise<void>
  sendChat: (message: string) => Promise<void>
  insertProposal: (text: string) => void

  checkConn: () => Promise<void>
  init: () => void
}

const emptyGen: GenState = {
  running: false, paused: false, steps: [], percent: 0, detail: '', provider: '', error: '', doneInfo: '',
}

export const useStudio = create<StudioState>((set, get) => ({
  view: 'library',
  projects: [],
  loadingProjects: true,
  current: null,
  saveState: { saving: false, lastSaved: '' },
  gen: { ...emptyGen },
  chat: [],
  chatStreaming: false,
  chatStreamText: '',
  conn: { online: true, internet: true, ollama: false, checked: false },
  wizardOpen: false,
  settingsOpen: false,
  coverOpen: false,
  exportOpen: false,
  progressOpen: false,
  deltaTick: 0,
  lastDelta: '',
  insertFn: null,
  printAuthor: '',
  syncTick: 0,

  setView: (v) => set({ view: v }),
  setInsertFn: (fn) => set({ insertFn: fn }),
  setPrintAuthor: (a) => set({ printAuthor: a }),
  openWizard: (v) => set({ wizardOpen: v }),
  openSettings: (v) => set({ settingsOpen: v }),
  openCover: (v) => set({ coverOpen: v }),
  openExport: (v) => set({ exportOpen: v }),
  openProgress: (v) => set({ progressOpen: v }),

  loadProjects: async () => {
    set({ loadingProjects: true })
    try {
      const r = await fetch('/api/projects')
      const projects = await r.json()
      set({ projects })
    } finally {
      set({ loadingProjects: false })
    }
  },

  createProject: async (title, brief) => {
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'Sans titre', brief }),
    })
    if (!r.ok) return null
    const project = await r.json()
    await get().loadProjects()
    return project
  },

  openProject: async (id) => {
    const r = await fetch(`/api/projects/${id}?full=1`)
    if (!r.ok) return
    const project: ProjectFull = await r.json()
    set({
      current: project,
      view: 'editor',
      chat: project.messages || [],
      gen: { ...emptyGen },
      chatStreamText: '',
      chatStreaming: false,
    })
  },

  closeProject: () => {
    get().loadProjects()
    set({ view: 'library', current: null, gen: { ...emptyGen }, chat: [] })
  },

  patchProject: async (patch, silent) => {
    const cur = get().current
    if (!cur) return
    if (!silent) set({ saveState: { saving: true, lastSaved: get().saveState.lastSaved } })
    try {
      const r = await fetch(`/api/projects/${cur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (r.ok) {
        const updated = await r.json()
        set((s) => ({ current: { ...s.current!, ...updated }, saveState: { saving: false, lastSaved: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) } }))
      } else if (!silent) {
        set({ saveState: { saving: false, lastSaved: get().saveState.lastSaved } })
      }
    } catch {
      if (!silent) set({ saveState: { saving: false, lastSaved: get().saveState.lastSaved } })
    }
  },

  deleteProject: async (id) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    await get().loadProjects()
  },

  duplicateProject: async (id) => {
    const p = get().projects.find((x) => x.id === id)
    if (!p) return
    const r = await fetch(`/api/projects/${id}?full=1`)
    const full = await r.json()
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${full.title} (copie)`,
        docType: full.docType,
        brief: JSON.parse(full.brief || '{}'),
        coverFront: parseJson(full.coverFront, {}),
        coverBack: parseJson(full.coverBack, {}),
      }),
    })
    await get().loadProjects()
  },

  setTitle: (t) => {
    const cur = get().current
    if (cur) set({ current: { ...cur, title: t } })
  },

  saveContent: (html, wordCount) => {
    if (get().gen.running) return // le serveur pilote le contenu pendant la génération
    get().patchProject({ contentHtml: html, wordCount }, true)
  },

  applyDelta: (html) => {
    const fn = get().insertFn
    if (fn) fn(html)
  },

  startGeneration: async () => {
    const cur = get().current
    if (!cur) return
    const progress = parseJson<{ chaptersDone?: number }>(cur.progress, {})
    const hasContent = (cur.contentHtml || '').length > 200
    const isResume = (progress.chaptersDone || 0) > 0 && (cur.status === 'generation' || cur.status === 'pause')
    if (hasContent && !isResume) {
      const ok = window.confirm(
        "Le contenu existant du document sera remplacé par la nouvelle génération.\n\nContinuer ?"
      )
      if (!ok) return
    }
    set({ gen: { ...emptyGen, running: true }, progressOpen: true })
    getSocket().emit('gen:start', { projectId: cur.id })
  },

  pauseGeneration: () => {
    const cur = get().current
    if (cur) getSocket().emit('gen:pause', { projectId: cur.id })
    set((s) => ({ gen: { ...s.gen, paused: true } }))
  },

  resumeGeneration: () => {
    const cur = get().current
    if (cur) getSocket().emit('gen:resume', { projectId: cur.id })
    set((s) => ({ gen: { ...s.gen, paused: false } }))
  },

  cancelGeneration: () => {
    const cur = get().current
    if (cur) getSocket().emit('gen:cancel', { projectId: cur.id })
  },

  loadMessages: async (projectId) => {
    const r = await fetch(`/api/projects/${projectId}/messages?limit=50`)
    if (r.ok) set({ chat: await r.json() })
  },

  sendChat: async (message) => {
    const cur = get().current
    if (!cur || !message.trim()) return
    set((s) => ({
      chatStreaming: true,
      chatStreamText: '',
      chat: [...s.chat, {
        id: `tmp-${Date.now()}`, projectId: cur.id, role: 'user', content: message, createdAt: new Date().toISOString(),
      }],
    }))
    getSocket().emit('chat:send', { projectId: cur.id, message })
  },

  insertProposal: (text) => {
    const fn = get().insertFn
    if (fn) fn(`<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '</p><p>')}</p>`)
  },

  checkConn: async () => {
    try {
      const r = await fetch('/api/llm/status')
      const j = await r.json()
      set({ conn: { online: j.online, internet: j.internet, ollama: j.ollama, checked: true } })
    } catch {
      set({ conn: { online: false, internet: false, ollama: false, checked: true } })
    }
  },

  init: () => {
    const s = getSocket()
    s.on('connect', () => get().checkConn())
    s.on('disconnect', () => set({ conn: { ...get().conn, online: false } }))

    s.on('gen:step', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set((st) => ({
        gen: { ...st.gen, running: true, paused: false, steps: d.steps, percent: d.percent, detail: d.detail || '', provider: d.provider || st.gen.provider, error: '' },
      }))
    })

    s.on('gen:delta', (d: any) => {
      if (d.projectId !== get().current?.id || !d.html) return
      set((st) => ({ lastDelta: d.html, deltaTick: st.deltaTick + 1 }))
    })

    s.on('gen:done', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set((st) => ({
        gen: { ...st.gen, running: false, paused: false, percent: 100, doneInfo: `${d.words} mots · ${d.units} unités · via ${d.provider}`, steps: st.gen.steps.map((x) => ({ ...x, status: 'done' })) },
      }))
      const cur = get().current
      if (cur) fetch(`/api/projects/${cur.id}?full=1`).then((r) => r.json()).then((p) => set((st) => ({ current: p, syncTick: st.syncTick + 1 }))).catch(() => {})
    })

    s.on('gen:error', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set((st) => ({ gen: { ...st.gen, running: false, paused: false, error: d.message } }))
    })

    s.on('gen:status', (d: any) => {
      if (d.projectId !== get().current?.id) return
      if (d.state === 'canceled') {
        set((st) => ({ gen: { ...st.gen, running: false, paused: false } }))
      } else if (d.state === 'paused') {
        set((st) => ({ gen: { ...st.gen, paused: true } }))
      } else if (d.state === 'running') {
        set((st) => ({ gen: { ...st.gen, paused: false, running: true } }))
      }
    })

    s.on('chat:delta', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set((st) => ({ chatStreamText: st.chatStreamText + d.delta }))
    })

    s.on('chat:done', (d: any) => {
      if (d.projectId !== get().current?.id) return
      const text = get().chatStreamText
      set((st) => ({
        chatStreaming: false,
        chatStreamText: '',
        chat: [...st.chat, {
          id: `ai-${Date.now()}`, projectId: d.projectId, role: 'assistant', content: text, createdAt: new Date().toISOString(),
        }],
      }))
    })

    s.on('chat:learning', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set((st) => ({
        chat: [...st.chat, {
          id: `learn-${Date.now()}`, projectId: d.projectId, role: 'learning', content: d.learning, createdAt: new Date().toISOString(),
        }],
        current: st.current ? { ...st.current, learnings: d.all } : st.current,
      }))
    })

    s.on('chat:error', (d: any) => {
      if (d.projectId !== get().current?.id) return
      set({ chatStreaming: false, chatStreamText: '' })
      set((st) => ({
        chat: [...st.chat, {
          id: `err-${Date.now()}`, projectId: d.projectId, role: 'error', content: d.message, createdAt: new Date().toISOString(),
        }],
      }))
    })
  },
}))
