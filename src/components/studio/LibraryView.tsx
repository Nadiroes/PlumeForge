'use client'

import { createElement, useEffect, useMemo, useState } from 'react'
import { useStudio } from '@/lib/store'
import { DOC_TYPES, parseJson } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Feather, Plus, Settings, Trash2, Copy, BookOpen, Lightbulb, Clapperboard,
  ScrollText, Laugh, MessagesSquare, MoreVertical, Wifi, WifiOff, PenLine, RefreshCw,
} from 'lucide-react'

const ICONS: Record<string, any> = {
  book: BookOpen, bulb: Lightbulb, clapper: Clapperboard,
  scroll: ScrollText, laugh: Laugh, messages: MessagesSquare,
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  generation: { label: 'Génération…', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  termine: { label: 'Terminé', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

function typeLabel(id: string) {
  return DOC_TYPES.find((t) => t.id === id)?.label || id
}

function typeIcon(id: string) {
  return ICONS[DOC_TYPES.find((t) => t.id === id)?.icon || 'book'] || BookOpen
}

function MiniCover({ cover, docType }: { cover: string; docType: string }) {
  const c = parseJson<{ bgType?: string; bgColor?: string; gradFrom?: string; gradTo?: string; imageDataUrl?: string }>(cover, {})
  const Icon = typeIcon(docType)
  const style: React.CSSProperties = c.imageDataUrl
    ? { backgroundImage: `url(${c.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : c.bgType === 'gradient'
      ? { backgroundImage: `linear-gradient(135deg, ${c.gradFrom || '#0f172a'}, ${c.gradTo || '#334155'})` }
      : { backgroundColor: c.bgColor || '#e2e8f0' }
  const dark = c.bgType === 'image' || c.bgType === 'gradient' || (c.bgColor && isDark(c.bgColor))
  return (
    <div className="w-14 h-20 rounded-md shadow-inner flex items-center justify-center shrink-0" style={style}>
      {!c.imageDataUrl && createElement(Icon, { className: `w-6 h-6 ${dark ? 'text-white/70' : 'text-slate-500'}` })}
    </div>
  )
}

function isDark(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return r * 0.299 + g * 0.587 + b * 0.114 < 140
}

export default function LibraryView() {
  const projects = useStudio((s) => s.projects)
  const loadingProjects = useStudio((s) => s.loadingProjects)
  const loadProjects = useStudio((s) => s.loadProjects)
  const openProject = useStudio((s) => s.openProject)
  const deleteProject = useStudio((s) => s.deleteProject)
  const duplicateProject = useStudio((s) => s.duplicateProject)
  const openWizard = useStudio((s) => s.openWizard)
  const openSettings = useStudio((s) => s.openSettings)
  const conn = useStudio((s) => s.conn)
  const checkConn = useStudio((s) => s.checkConn)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadProjects()
    checkConn()
  }, [loadProjects, checkConn])

  const filtered = useMemo(
    () => (filter === 'all' ? projects : projects.filter((p) => p.docType === filter)),
    [projects, filter]
  )

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of projects) m[p.docType] = (m[p.docType] || 0) + 1
    return m
  }, [projects])

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-stone-50 to-stone-100">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-50 flex items-center justify-center shadow shrink-0">
            <Feather className="w-5 h-5" />
          </div>
          <div className="mr-auto min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight">PlumeForge</h1>
            <p className="text-xs text-muted-foreground hidden sm:block truncate">Studio d&apos;écriture IA — multi-agents · multi-genres · prêt-à-imprimer</p>
          </div>
          <button
            onClick={checkConn}
            title={conn.online ? 'Connectivité OK (cloud ou local)' : 'Hors ligne — mode local/démo actif'}
            aria-label="État de connexion — cliquer pour vérifier"
            className={`flex items-center gap-1.5 text-xs px-2 py-1.5 sm:px-2.5 rounded-full border shrink-0 ${conn.online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
          >
            {conn.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{conn.online ? 'En ligne' : 'Mode local'}</span>
            <RefreshCw className="w-3 h-3 opacity-50" />
          </button>
          <Button variant="outline" size="sm" onClick={() => openSettings(true)} aria-label="Paramètres" className="px-2 sm:px-3 shrink-0">
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Paramètres</span>
          </Button>
          <Button size="sm" onClick={() => openWizard(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 sm:px-3 shrink-0">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau projet</span><span className="sm:hidden">Nouveau</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`Tous (${projects.length})`} />
          {DOC_TYPES.map((t) => (
            <FilterChip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)} label={`${t.label} (${counts[t.id] || 0})`} />
          ))}
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-5 h-36 animate-pulse bg-stone-100 rounded-lg" /></Card>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 sm:py-20 px-4 border-2 border-dashed rounded-2xl bg-white/60">
            <PenLine className="w-12 h-12 mx-auto text-stone-300 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {projects.length === 0 ? 'Votre étagère est vide' : 'Aucun projet dans cette catégorie'}
            </h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              Cliquez sur « Nouveau projet » : l&apos;assistant vous guide pas à pas — type d&apos;écriture, ton, narration, humeur, style, nombre de pages, éléments à inclure — puis les agents rédigent directement dans l&apos;éditeur intégré.
            </p>
            <Button onClick={() => openWizard(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="w-4 h-4 mr-1" /> Créer mon premier ouvrage
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const Icon = typeIcon(p.docType)
              const st = STATUS_LABEL[p.status] || STATUS_LABEL.brouillon
              return (
                <Card key={p.id} className="group hover:shadow-lg transition-shadow cursor-pointer border-stone-200" onClick={() => openProject(p.id)}>
                  <CardContent className="p-4 flex gap-3">
                    <MiniCover cover={p.coverFront} docType={p.docType} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" title={p.title}>{p.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Icon className="w-3 h-3 shrink-0" /> <span className="truncate">{typeLabel(p.docType)}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${st.cls}`}>{st.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{p.wordCount.toLocaleString('fr-FR')} mots</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Modifié le {new Date(p.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions sur « ${p.title} »`}
                          className="h-7 w-7 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openProject(p.id)}>
                          <BookOpen className="w-4 h-4 mr-2" /> Ouvrir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateProject(p.id)}>
                          <Copy className="w-4 h-4 mr-2" /> Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => {
                          if (window.confirm(`Supprimer « ${p.title} » définitivement ?`)) deleteProject(p.id)
                        }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-white/70 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-muted-foreground">
          PlumeForge fonctionne localement : vos projets sont stockés sur votre machine. Moteurs IA : Mistral · Agnes AI · Ollama (local) · mode démo hors-ligne intégré.
        </div>
      </footer>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors min-h-8 ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}
    >
      {label}
    </button>
  )
}
