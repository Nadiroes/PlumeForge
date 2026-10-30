'use client'

import { useEffect, useState } from 'react'
import { useStudio } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { parseJson } from '@/lib/types'
import {
  Play, Pause, Square, CheckCircle2, Circle, Loader2, XCircle,
  Cpu, Cloud, WifiOff, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getSocket } from '@/lib/store'

export default function ProgressPanel() {
  const current = useStudio((s) => s.current)
  const gen = useStudio((s) => s.gen)
  const startGeneration = useStudio((s) => s.startGeneration)
  const pauseGeneration = useStudio((s) => s.pauseGeneration)
  const resumeGeneration = useStudio((s) => s.resumeGeneration)
  const cancelGeneration = useStudio((s) => s.cancelGeneration)
  const [detailOpen, setDetailOpen] = useState(true)
  const [connInfo, setConnInfo] = useState<{ ollama: boolean; internet: boolean } | null>(null)

  useEffect(() => {
    getSocket().emit('status:check', (d: any) => {
      if (d) setConnInfo({ ollama: d.ollama, internet: d.internet })
    })
  }, [])

  if (!current) return null

  const progress = parseJson<{ chaptersDone?: number; totalUnits?: number }>(current.progress, {})
  const canResume = (progress.chaptersDone || 0) > 0 && (current.status === 'generation' || current.status === 'pause') && !gen.running

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2.5 border-b bg-white flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="mr-auto">
          <div className="text-sm font-semibold leading-none">Pipeline des agents</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Brief → Plan → Rédaction → Révision → Assemblage</div>
        </div>
        {gen.provider && gen.provider !== '—' && (
          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 capitalize">
            {gen.provider === 'zai' ? <Cloud className="w-3 h-3 mr-1" /> : gen.provider === 'ollama' ? <WifiOff className="w-3 h-3 mr-1" /> : <Cloud className="w-3 h-3 mr-1" />}
            {gen.provider}
          </Badge>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Barre de progression globale */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-medium">
              {gen.doneInfo ? 'Génération terminée' : gen.running ? (gen.paused ? 'En pause' : 'Génération en cours') : 'Prêt à générer'}
            </span>
            <span className="text-xs font-bold">{gen.percent}%</span>
          </div>
          <Progress value={gen.percent} className="h-2.5" />
          {gen.detail && <p className="text-[11px] text-muted-foreground mt-1">{gen.detail}</p>}
        </div>

        {/* Boutons de contrôle */}
        <div className="flex flex-wrap gap-2">
          {!gen.running && (
            <Button onClick={startGeneration} className="bg-slate-900 hover:bg-slate-800 text-white h-8 text-xs flex-1">
              <Play className="w-3.5 h-3.5 mr-1" /> {canResume ? `Reprendre (unité ${progress.chaptersDone! + 1})` : 'Générer le livre'}
            </Button>
          )}
          {gen.running && !gen.paused && (
            <Button onClick={pauseGeneration} variant="outline" className="h-8 text-xs flex-1">
              <Pause className="w-3.5 h-3.5 mr-1" /> Pause
            </Button>
          )}
          {gen.running && gen.paused && (
            <Button onClick={resumeGeneration} className="bg-slate-900 hover:bg-slate-800 text-white h-8 text-xs flex-1">
              <Play className="w-3.5 h-3.5 mr-1" /> Reprendre
            </Button>
          )}
          {gen.running && (
            <Button onClick={cancelGeneration} variant="outline" className="h-8 text-xs text-red-600 hover:text-red-700">
              <Square className="w-3.5 h-3.5 mr-1" /> Arrêter
            </Button>
          )}
          {gen.doneInfo && !gen.running && (
            <Button variant="outline" className="h-8 text-xs flex-1" onClick={startGeneration}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Régénérer
            </Button>
          )}
        </div>

        {/* Résilience réseau */}
        {connInfo && (
          <div className="text-[11px] rounded-lg border px-2.5 py-1.5 flex items-center gap-2 bg-stone-50">
            <span className={connInfo.internet ? 'text-emerald-600' : 'text-amber-600'}>
              ● Internet {connInfo.internet ? 'OK' : 'coupé'}
            </span>
            <span className="text-stone-300">|</span>
            <span className={connInfo.ollama ? 'text-emerald-600' : 'text-stone-400'}>
              ● Ollama local {connInfo.ollama ? 'prêt' : 'absent'}
            </span>
            {!connInfo.internet && !connInfo.ollama && <span className="ml-auto text-stone-500">→ mode démo hors-ligne</span>}
          </div>
        )}

        {/* Erreur */}
        {gen.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <div>
              <b>Erreur de génération</b>
              <p className="mt-0.5">{gen.error}</p>
              <p className="mt-1 text-red-600/80">Le pipeline retentera automatiquement via le fournisseur suivant ; en dernier recours, le mode démo hors-ligne prend le relais.</p>
            </div>
          </div>
        )}

        {/* Étapes */}
        <div>
          <button className="flex items-center justify-between w-full text-xs font-medium mb-2" onClick={() => setDetailOpen(!detailOpen)}>
            Étapes {gen.steps.length > 0 && `(${gen.steps.filter((s) => s.status === 'done').length}/${gen.steps.length})`}
            {detailOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {detailOpen && (
            <div className="space-y-1">
              {gen.steps.length === 0 && (
                <p className="text-[11px] text-muted-foreground bg-stone-50 rounded-lg p-2.5">
                  Les étapes s&apos;afficheront ici pendant la génération : analyse du brief, plan détaillé,
                  rédaction unité par unité avec révision, puis assemblage final.
                </p>
              )}
              {gen.steps.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${
                    s.status === 'active' ? 'bg-violet-50 text-violet-900 font-medium' :
                    s.status === 'done' ? 'text-stone-500' :
                    s.status === 'error' ? 'bg-red-50 text-red-700' : 'text-stone-400'
                  }`}
                >
                  {s.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                   s.status === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 shrink-0" /> :
                   s.status === 'error' ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /> :
                   <Circle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info reprise */}
        {canResume && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <b>Reprise possible :</b> {progress.chaptersDone}/{progress.totalUnits} unités déjà rédigées.
            La génération reprendra exactement là où elle s&apos;est arrêtée, avec la mémoire du livre (bible de style + résumés).
          </div>
        )}
      </div>
    </div>
  )
}
