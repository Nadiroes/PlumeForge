'use client'

import { useMemo, useState } from 'react'
import { useStudio } from '@/lib/store'
import {
  Brief, DOC_TYPES, HUMEURS, NARRATIONS, STYLES, TONES, defaultBrief,
} from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  BookOpen, Lightbulb, Clapperboard, ScrollText, Laugh, MessagesSquare,
  ChevronLeft, ChevronRight, Feather, Sparkles, Loader2,
} from 'lucide-react'

const ICONS: Record<string, any> = {
  book: BookOpen, bulb: Lightbulb, clapper: Clapperboard,
  scroll: ScrollText, laugh: Laugh, messages: MessagesSquare,
}

const TOTAL_STEPS = 6

export default function WizardDialog() {
  const wizardOpen = useStudio((s) => s.wizardOpen)
  const openWizard = useStudio((s) => s.openWizard)
  const createProject = useStudio((s) => s.createProject)
  const openProject = useStudio((s) => s.openProject)
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState<Brief>(defaultBrief())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setStep(0)
    setTitle('')
    setBrief(defaultBrief())
    setCreating(false)
    setError('')
  }

  const up = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }))
  const upEl = (patch: Partial<Brief['elements']>) => setBrief((b) => ({ ...b, elements: { ...b.elements, ...patch } }))

  const canNext = useMemo(() => {
    if (step === 0) return !!brief.docType
    if (step === 1) return brief.prompt.trim().length >= 10
    return true
  }, [step, brief])

  const finish = async () => {
    setCreating(true)
    setError('')
    try {
      const finalTitle = title.trim() || brief.prompt.trim().split(/[.!?]/)[0].slice(0, 60) || 'Sans titre'
      const project = await createProject(finalTitle, brief)
      if (!project) throw new Error('Création impossible')
      openWizard(false)
      reset()
      await openProject(project.id)
      // Lancement automatique de l'écriture par les agents
      useStudio.getState().startGeneration()
    } catch (e: any) {
      setError(e?.message || 'Erreur')
      setCreating(false)
    }
  }

  return (
    <Dialog open={wizardOpen} onOpenChange={(v) => { openWizard(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 border-b bg-stone-50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Feather className="w-4 h-4" /> Assistant de création
            <span className="ml-auto text-xs font-normal text-muted-foreground">Étape {step + 1} / {TOTAL_STEPS}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Création guidée d&apos;un ouvrage</DialogDescription>
          <div className="mt-3 h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </DialogHeader>

        {/* Scroll natif : le viewport Radix ne résout pas 100% de hauteur dans un conteneur à max-height seule */}
        <div className="flex-1 min-h-0 max-h-[58vh] overflow-y-auto">
          <div className="p-4 sm:p-6">
            {step === 0 && (
              <div>
                <h3 className="font-semibold mb-1">Quel type de document voulez-vous produire ?</h3>
                <p className="text-sm text-muted-foreground mb-4">Le moteur s&apos;adapte au format : chapitres, séquences, actes, tableaux…</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DOC_TYPES.map((t) => {
                    const Icon = ICONS[t.icon]
                    return (
                      <button
                        key={t.id}
                        onClick={() => up({ docType: t.id })}
                        className={`text-left p-3.5 rounded-xl border-2 transition-all ${brief.docType === t.id ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-stone-200 hover:border-stone-400 bg-white'}`}
                      >
                        <Icon className="w-5 h-5 mb-2" />
                        <div className="text-sm font-semibold">{t.label}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold">L&apos;idée directrice de votre ouvrage</h3>
                <div>
                  <Label className="text-xs">Votre prompt — l&apos;idée, le message, les thèmes</Label>
                  <Textarea
                    value={brief.prompt}
                    onChange={(e) => up({ prompt: e.target.value })}
                    placeholder="Ex : Un polar intimiste dans une petite ville de Provence où une libraire découvre que les livres de sa boutique racontent des crimes à venir…"
                    className="min-h-28 mt-1.5"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{brief.prompt.trim().length} caractères (minimum 10)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Titre de l&apos;ouvrage <span className="text-muted-foreground">(optionnel)</span></Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Laisser vide pour un titre auto" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs">Genre littéraire <span className="text-muted-foreground">(optionnel)</span></Label>
                    <Input value={brief.genre || ''} onChange={(e) => up({ genre: e.target.value })} placeholder="polar, SF, romance, autobiographie…" className="mt-1.5" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Public cible <span className="text-muted-foreground">(optionnel)</span></Label>
                  <Input value={brief.audience || ''} onChange={(e) => up({ audience: e.target.value })} placeholder="adultes, jeunesse, spécialistes…" className="mt-1.5" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h3 className="font-semibold">Ton, narration & humeur</h3>
                <ChipGroup label="Ton" options={TONES} value={brief.ton} onChange={(v) => up({ ton: v })} />
                <div>
                  <Label className="text-xs mb-2 block">Narration</Label>
                  <RadioGroup value={brief.narration} onValueChange={(v) => up({ narration: v })} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NARRATIONS.map((n) => (
                      <label key={n} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${brief.narration === n ? 'border-slate-900 bg-slate-50' : 'border-stone-200'}`}>
                        <RadioGroupItem value={n} /> {n}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <ChipGroup label="Humeur" options={HUMEURS} value={brief.humeur} onChange={(v) => up({ humeur: v })} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h3 className="font-semibold">Style d&apos;écriture & ampleur</h3>
                <ChipGroup label="Style" options={STYLES} value={brief.style} onChange={(v) => up({ style: v })} />
                <div>
                  <Label className="text-xs">Nombre de pages souhaité : <span className="font-bold">{brief.targetPages}</span> (≈ {Math.round(brief.targetPages * 280).toLocaleString('fr-FR')} mots)</Label>
                  <Slider value={[brief.targetPages]} min={4} max={120} step={2} onValueChange={([v]) => up({ targetPages: v })} className="mt-3" />
                </div>
                {brief.docType === 'scenario' && (
                  <div>
                    <Label className="text-xs">Format de script</Label>
                    <ChipGroup inline label="" options={['Séquencier détaillé', 'Scènes numérotées', 'Traitements', 'Pitch & synopsis']} value={brief.extras?.scriptFormat || 'Séquencier détaillé'} onChange={(v) => up({ extras: { ...brief.extras, scriptFormat: v } })} />
                  </div>
                )}
                {brief.docType === 'theatre' && (
                  <div>
                    <Label className="text-xs">Nombre d&apos;actes souhaité</Label>
                    <Slider value={[brief.extras?.actes || 3]} min={1} max={5} step={1} onValueChange={([v]) => up({ extras: { ...brief.extras, actes: v } })} className="mt-3" />
                    <p className="text-xs text-muted-foreground mt-1">{brief.extras?.actes || 3} actes</p>
                  </div>
                )}
                {brief.docType === 'sketch' && (
                  <div>
                    <Label className="text-xs">Durée cible du sketch</Label>
                    <ChipGroup inline label="" options={['2 minutes', '5 minutes', '10 minutes', 'One man show']} value={brief.extras?.duree || '5 minutes'} onChange={(v) => up({ extras: { ...brief.extras, duree: v } })} />
                  </div>
                )}
                {brief.docType === 'dialogue' && (
                  <div>
                    <Label className="text-xs">Type d&apos;échanges</Label>
                    <ChipGroup inline label="" options={['Entretiens', 'Débats', 'Correspondance', 'Échanges philosophiques']} value={brief.extras?.dialogueType || 'Entretiens'} onChange={(v) => up({ extras: { ...brief.extras, dialogueType: v } })} />
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Éléments à inclure dans l&apos;ouvrage</h3>
                <p className="text-sm text-muted-foreground">Tout est au choix — l&apos;assemblage s&apos;adapte à vos cases cochées.</p>
                <div className="space-y-2.5">
                  <ElementCheck checked={brief.elements.couverture} onChange={(v) => upEl({ couverture: v })} label="Couverture" desc="Éditable avant/arrière, générée à partir de votre idée" />
                  <ElementCheck checked={brief.elements.sommaire} onChange={(v) => upEl({ sommaire: v })} label="Sommaire" desc="Table des unités en début d'ouvrage" />
                  <ElementCheck checked={brief.elements.preface} onChange={(v) => upEl({ preface: v })} label="Préface" desc="Texte liminaire rédigé par les agents" />
                  <ElementCheck checked={brief.elements.dedicace} onChange={(v) => upEl({ dedicace: v })} label="Dédicace" desc="Une page d'attribution" />
                  <ElementCheck checked={brief.elements.corps} onChange={(v) => upEl({ corps: v })} label="Corps du livre" desc="Le contenu principal généré unité par unité" />
                  <ElementCheck checked={brief.elements.annexes} onChange={(v) => upEl({ annexes: v })} label="Annexes" desc="Notes, glossaire, documents complémentaires" />
                  {brief.elements.annexes && (
                    <div className="pl-7 pt-1">
                      <RadioGroup value={brief.elements.numberedAnnexes ? 'num' : 'alpha'} onValueChange={(v) => upEl({ numberedAnnexes: v === 'num' })} className="flex flex-wrap gap-x-4 gap-y-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="num" /> Numérotées (Annexe 1, 2…)</label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="alpha" /> Lettres (Annexe A, B…)</label>
                      </RadioGroup>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Récapitulatif</h3>
                <div className="rounded-xl border bg-stone-50 p-4 text-sm space-y-1.5">
                  <p><span className="text-muted-foreground">Type :</span> <b>{DOC_TYPES.find((t) => t.id === brief.docType)?.label}</b></p>
                  <p><span className="text-muted-foreground">Idée :</span> {brief.prompt.slice(0, 140)}{brief.prompt.length > 140 ? '…' : ''}</p>
                  <p><span className="text-muted-foreground">Ton :</span> {brief.ton} · <span className="text-muted-foreground">Narration :</span> {brief.narration} · <span className="text-muted-foreground">Humeur :</span> {brief.humeur}</p>
                  <p><span className="text-muted-foreground">Style :</span> {brief.style} · <span className="text-muted-foreground">Pages :</span> {brief.targetPages}</p>
                  <p className="text-muted-foreground">
                    Éléments : {[
                      brief.elements.couverture && 'couverture',
                      brief.elements.sommaire && 'sommaire',
                      brief.elements.preface && 'préface',
                      brief.elements.dedicace && 'dédicace',
                      brief.elements.corps && 'corps',
                      brief.elements.annexes && `annexes (${brief.elements.numberedAnnexes ? 'numérotées' : 'lettres'})`,
                    ].filter(Boolean).join(', ') || 'aucun'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm flex gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-800">
                    En cliquant sur <b>Écriture</b>, le document s&apos;ouvre dans l&apos;éditeur intégré et les agents
                    (Brief → Plan → Rédaction → Révision → Assemblage) écrivent directement dessus, unité par unité.
                    Vous pourrez les interrompre, discuter avec eux et tout modifier.
                  </p>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-4 sm:px-6 py-3.5 flex items-center justify-between gap-2 bg-stone-50 shrink-0" style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}>
          <Button variant="ghost" onClick={() => (step === 0 ? openWizard(false) : setStep(step - 1))}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {step === 0 ? 'Annuler' : 'Retour'}
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext} className="bg-slate-900 hover:bg-slate-800 text-white">
              Continuer <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={creating} className="bg-slate-900 hover:bg-slate-800 text-white">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Feather className="w-4 h-4 mr-2" />}
              {creating ? 'Ouverture de l\'éditeur…' : 'Écriture'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChipGroup({ label, options, value, onChange, inline }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; inline?: boolean }) {
  return (
    <div>
      {label && <Label className="text-xs mb-2 block">{label}</Label>}
      <div className={`flex flex-wrap ${inline ? '' : ''} gap-2`}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${value === o ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-stone-200 hover:border-stone-400'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function ElementCheck({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${checked ? 'border-slate-900 bg-slate-50' : 'border-stone-200 hover:border-stone-300'}`}>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  )
}
