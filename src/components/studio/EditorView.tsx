'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudio } from '@/lib/store'
import { useIsMobile } from '@/hooks/use-mobile'
import RichEditor from './RichEditor'
import AgentPanel from './AgentPanel'
import ProgressPanel from './ProgressPanel'
import { DOC_TYPES } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
  ArrowLeft, Feather, Save, Palette, FileDown, Loader2, Check, PanelRightClose, PanelRightOpen,
} from 'lucide-react'

/** Panneau Agents / Progression — partagé entre l'aside desktop et le drawer mobile. */
function SidePanels() {
  const gen = useStudio((s) => s.gen)
  return (
    <Tabs defaultValue="agents" className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-2.5 pb-0 bg-white border-b">
        <TabsList className="w-full">
          <TabsTrigger value="agents" className="flex-1">Agents</TabsTrigger>
          <TabsTrigger value="progress" className="flex-1">
            Progression {gen.running && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="agents" className="flex-1 min-h-0 mt-0 overflow-hidden">
        <AgentPanel />
      </TabsContent>
      <TabsContent value="progress" className="flex-1 min-h-0 mt-0 overflow-y-auto">
        <ProgressPanel />
      </TabsContent>
    </Tabs>
  )
}

export default function EditorView() {
  const current = useStudio((s) => s.current)
  const closeProject = useStudio((s) => s.closeProject)
  const setTitle = useStudio((s) => s.setTitle)
  const patchProject = useStudio((s) => s.patchProject)
  const openCover = useStudio((s) => s.openCover)
  const openExport = useStudio((s) => s.openExport)
  const openProgress = useStudio((s) => s.openProgress)
  const gen = useStudio((s) => s.gen)
  const saveState = useStudio((s) => s.saveState)

  const isMobile = useIsMobile()
  const [panelClosed, setPanelClosed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Détecte le démarrage de la génération pour ouvrir le panneau mobile
  // (pattern React : ajustement de state dérivé pendant le render)
  const [lastRunning, setLastRunning] = useState(false)
  if (gen.running !== lastRunning) {
    setLastRunning(gen.running)
    if (isMobile && gen.running) setMobileOpen(true)
  }
  const panelOpen = !panelClosed || gen.running
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (current && current.title) document.title = `${current.title} — PlumeForge`
    return () => { document.title = 'PlumeForge — Studio d\u2019écriture IA' }
  }, [current?.title])

  if (!current) return null

  const docType = DOC_TYPES.find((t) => t.id === current.docType)

  const saveTitle = () => {
    if (titleRef.current && titleRef.current.value.trim() && titleRef.current.value !== current.title) {
      setTitle(titleRef.current.value.trim())
      patchProject({ title: titleRef.current.value.trim() })
    }
  }

  const togglePanel = () => {
    if (isMobile) setMobileOpen(true)
    else setPanelClosed(!panelClosed)
  }

  return (
    <div className="h-dvh flex flex-col bg-stone-100 print:hidden">
      {/* Barre supérieure */}
      <header className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={closeProject} title="Retour à la bibliothèque" aria-label="Retour à la bibliothèque">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-50 hidden sm:flex items-center justify-center shrink-0">
          <Feather className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={titleRef}
            defaultValue={current.title}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full text-sm font-semibold bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-400 rounded px-1.5 py-0.5 outline-none transition-colors truncate"
            aria-label="Titre du projet"
          />
          <div className="flex items-center gap-2 px-1.5 text-[10px] text-muted-foreground">
            <span className="truncate">{docType?.label}</span>
            {current.styleBible && <span className="hidden md:inline truncate">· Bible de style active</span>}
            {(current.learnings || '').split('\n').filter(Boolean).length > 0 && (
              <span className="hidden md:inline truncate">· {(current.learnings || '').split('\n').filter(Boolean).length} préférence(s) apprise(s)</span>
            )}
          </div>
        </div>

        {gen.running && (
          <button
            onClick={() => openProgress(true)}
            className="hidden md:flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-3 py-1.5 max-w-56"
            title="Voir la progression"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="truncate">{gen.percent}% — {gen.detail || 'génération…'}</span>
          </button>
        )}
        {saveState.saving ? (
          <span className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0"><Save className="w-3 h-3" /> Sauvegarde…</span>
        ) : saveState.lastSaved ? (
          <span className="hidden lg:flex items-center gap-1 text-[11px] text-emerald-700 shrink-0"><Check className="w-3 h-3" /> {saveState.lastSaved}</span>
        ) : null}

        <Button variant="outline" size="sm" onClick={() => openCover(true)} aria-label="Éditer la couverture" className="hidden sm:inline-flex shrink-0">
          <Palette className="w-4 h-4" /> <span className="hidden md:inline">Couverture</span>
        </Button>
        <Button size="sm" onClick={() => openExport(true)} className="bg-slate-900 hover:bg-slate-800 text-white shrink-0">
          <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Finaliser</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePanel}
          title={isMobile ? 'Agents & progression' : panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
          aria-label={isMobile ? 'Ouvrir le panneau agents' : panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
          className="shrink-0"
        >
          {gen.running && isMobile
            ? <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
            : panelOpen && !isMobile ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </Button>
      </header>

      {/* Corps : éditeur + panneaux latéraux (desktop) */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <RichEditor key={current.id} />
        </div>
        {panelOpen && !isMobile && (
          <aside className="w-[360px] xl:w-[400px] shrink-0 border-l bg-stone-50 hidden md:flex flex-col">
            <SidePanels />
          </aside>
        )}
      </div>

      {/* Drawer mobile : Agents & Progression (inaccessibles sinon sur < md) */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-[92vw] max-w-[420px] p-0 gap-0 flex flex-col" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Panneau agents et progression</SheetTitle>
            <SheetDescription className="sr-only">Discutez avec les agents éditoriaux et suivez la génération</SheetDescription>
            <div className="flex items-center justify-between px-3 py-2 border-b bg-white pr-12">
              <span className="text-sm font-semibold">Panneau latéral</span>
            </div>
            <div className="flex-1 min-h-0">
              <SidePanels />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
