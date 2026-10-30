'use client'

import { useRef, useState } from 'react'
import { useStudio } from '@/lib/store'
import { CoverDoc, CoverText, defaultCover, parseJson } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wand2, Plus, Trash2, Type, Image as ImageIcon, Download, Bold as BoldIcon, Italic as ItalicIcon, Loader2,
} from 'lucide-react'

const GRADIENTS = [
  ['#0f172a', '#334155'], ['#1e1b4b', '#7c3aed'], ['#0c4a6e', '#0ea5e9'],
  ['#14532d', '#84cc16'], ['#7c2d12', '#f59e0b'], ['#4c0519', '#fb7185'],
  ['#111827', '#6b7280'], ['#312e81', '#ec4899'],
]

function NewText(partial: Partial<CoverText>): CoverText {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: 'Texte', x: 50, y: 50, size: 42, color: '#ffffff',
    bold: true, italic: false, align: 'center', font: 'Georgia', maxWidth: 80,
    ...partial,
  }
}

export default function CoverDialog() {
  const coverOpen = useStudio((s) => s.coverOpen)
  const openCover = useStudio((s) => s.openCover)
  const current = useStudio((s) => s.current)
  if (!current) return null
  // key = id du projet : l'éditeur interne est remonté (state réinitialisé) à chaque changement de projet
  return <CoverEditor key={current.id} open={coverOpen} onOpenChange={openCover} />
}

function CoverEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const current = useStudio((s) => s.current)!
  const patchProject = useStudio((s) => s.patchProject)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [front, setFront] = useState<CoverDoc>(() => parseJson(current?.coverFront, defaultCover()))
  const [back, setBack] = useState<CoverDoc>(() => parseJson(current?.coverBack, defaultCover()))
  const [selected, setSelected] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null)

  const doc = side === 'front' ? front : back
  const setDoc = (updater: (d: CoverDoc) => CoverDoc) => {
    if (side === 'front') setFront(updater)
    else setBack(updater)
  }

  const sel = doc.texts.find((t) => t.id === selected) || null

  const save = async () => {
    await patchProject({ coverFront: JSON.stringify(front), coverBack: JSON.stringify(back) })
    onOpenChange(false)
  }

  const genImage = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const brief = parseJson<{ prompt?: string; genre?: string; ton?: string }>(current.brief, {})
      const prompt = `Couverture de ${current.title}. ${brief.prompt || ''} ${brief.genre || ''} ${brief.ton || ''}`
      const r = await fetch('/api/cover/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erreur')
      setDoc((d) => ({ ...d, bgType: 'image', imageDataUrl: j.dataUrl }))
    } catch (e: any) {
      setAiError(e?.message || 'Génération impossible — vérifiez la connexion ou choisissez un fond dégradé.')
    } finally {
      setAiLoading(false)
    }
  }

  const onFile = (f: File | null) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setDoc((d) => ({ ...d, bgType: 'image', imageDataUrl: String(reader.result) }))
    reader.readAsDataURL(f)
  }

  const onPointerDown = (e: React.PointerEvent, t: CoverText) => {
    e.preventDefault()
    setSelected(t.id)
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    draggingRef.current = { id: t.id, startX: e.clientX, startY: e.clientY, ox: t.x, oy: t.y }
    const move = (ev: PointerEvent) => {
      const d = draggingRef.current
      if (!d || !rect) return
      const dx = ((ev.clientX - d.startX) / rect.width) * 100
      const dy = ((ev.clientY - d.startY) / rect.height) * 100
      setDoc((cur) => ({
        ...cur,
        texts: cur.texts.map((x) => x.id === d.id ? { ...x, x: clamp(d.ox + dx, 5, 95), y: clamp(d.oy + dy, 3, 97) } : x),
      }))
    }
    const up = () => {
      draggingRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const exportPng = async () => {
    if (!previewRef.current) return
    try {
      const html2canvas = (await import('html2canvas-pro')).default
      const canvas = await html2canvas(previewRef.current, { scale: 2 })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `${current.title}-${side === 'front' ? 'couverture' : 'quatrieme'}.png`
      a.click()
    } catch {
      alert('Export image impossible')
    }
  }

  const addQuick = (kind: 'title' | 'author' | 'custom') => {
    const t = kind === 'title' ? NewText({ text: current.title, y: 38, size: 52 })
      : kind === 'author' ? NewText({ text: parseJson<{ authorName?: string }>(current.brief, {}).authorName || 'Auteur', y: 70, size: 22, bold: false })
      : NewText({ text: 'Nouveau texte', y: 55, size: 28 })
    setDoc((d) => ({ ...d, texts: [...d.texts, t] }))
    setSelected(t.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[calc(100%-2rem)] h-[92dvh] max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-5 pt-4 pb-3 border-b bg-stone-50 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2 pr-8">
            <ImageIcon className="w-4 h-4 shrink-0" /> <span className="truncate">Éditeur de couverture — généré à partir de votre idée</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Modifier la couverture avant et arrière</DialogDescription>
        </DialogHeader>

        <Tabs value={side} onValueChange={(v) => setSide(v as any)} className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 sm:px-5 pt-3 shrink-0">
            <TabsList>
              <TabsTrigger value="front">Couverture avant</TabsTrigger>
              <TabsTrigger value="back">Quatrième de couverture</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col lg:flex-row gap-5 p-4 sm:p-5">
            {/* Aperçu */}
            <div className="shrink-0 mx-auto lg:mx-0 flex flex-col items-center">
              <div
                ref={previewRef}
                className="relative w-[min(300px,72vw)] aspect-[2/3] sm:w-[300px] sm:aspect-auto sm:h-[450px] rounded-lg shadow-2xl overflow-hidden select-none cursor-move touch-none"
                style={bgStyle(doc)}
              >
                {doc.texts.map((t) => (
                  <div
                    key={t.id}
                    onPointerDown={(e) => onPointerDown(e, t)}
                    className={`absolute cursor-grab active:cursor-grabbing ${selected === t.id ? 'outline-2 outline-dashed outline-violet-500/70' : ''}`}
                    style={{
                      left: `${t.x}%`, top: `${t.y}%`,
                      transform: 'translate(-50%, -50%)',
                      maxWidth: `${t.maxWidth}%`,
                      textAlign: t.align,
                      color: t.color,
                      fontSize: t.size,
                      fontWeight: t.bold ? 700 : 400,
                      fontStyle: t.italic ? 'italic' : 'normal',
                      fontFamily: t.font,
                      lineHeight: 1.15,
                      textShadow: '0 1px 12px rgba(0,0,0,0.35)',
                      whiteSpace: 'pre-wrap',
                      padding: 4,
                    }}
                  >
                    {t.text}
                  </div>
                ))}
                {doc.texts.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm text-center px-8">
                    Ajoutez un texte (titre, auteur…) à droite, puis glissez-le où vous voulez
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3 justify-center">
                <Button size="sm" variant="outline" onClick={exportPng}><Download className="w-3.5 h-3.5 mr-1" /> PNG</Button>
              </div>
            </div>

            {/* Contrôles */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Fond de couverture</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button size="sm" variant={doc.bgType === 'gradient' ? 'default' : 'outline'} onClick={() => setDoc((d) => ({ ...d, bgType: 'gradient' }))} className="h-7 text-xs">
                    Dégradés
                  </Button>
                  <Button size="sm" variant="outline" onClick={genImage} disabled={aiLoading} className="h-7 text-xs">
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                    Générer par IA
                  </Button>
                  <label className="text-xs h-7 px-2 inline-flex items-center border rounded cursor-pointer hover:bg-stone-50">
                    <ImageIcon className="w-3.5 h-3.5 mr-1" /> Importer
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
                  </label>
                  {doc.bgType === 'image' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDoc((d) => ({ ...d, bgType: 'gradient' }))}>
                      Retirer l&apos;image
                    </Button>
                  )}
                </div>
                {doc.bgType === 'gradient' ? (
                  <div className="flex flex-wrap gap-2">
                    {GRADIENTS.map(([a, b]) => (
                      <button
                        key={a + b}
                        onClick={() => setDoc((d) => ({ ...d, gradFrom: a, gradTo: b }))}
                        aria-label={`Dégradé ${a} → ${b}`}
                        className={`w-9 h-9 rounded-md border-2 ${doc.gradFrom === a && doc.gradTo === b ? 'border-slate-900' : 'border-transparent'}`}
                        style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Fond image actif{aiError ? ` — ${aiError}` : ''}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Label className="text-xs shrink-0">Calques de texte</Label>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addQuick('title')}><Type className="w-3 h-3 mr-1" /> Titre</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addQuick('author')}>Auteur</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" aria-label="Ajouter un texte libre" onClick={() => addQuick('custom')}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {doc.texts.map((t) => (
                    <div key={t.id} className={`flex items-center gap-2 text-xs border rounded px-2 py-1.5 cursor-pointer ${selected === t.id ? 'border-violet-500 bg-violet-50' : ''}`} onClick={() => setSelected(t.id)}>
                      <span className="truncate flex-1">{t.text || '(vide)'}</span>
                      <button onClick={(e) => { e.stopPropagation(); setDoc((d) => ({ ...d, texts: d.texts.filter((x) => x.id !== t.id) })) }} aria-label="Supprimer ce calque" className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {sel && (
                <div className="border rounded-lg p-3 space-y-3 bg-stone-50">
                  <div>
                    <Label className="text-xs">Contenu</Label>
                    <textarea
                      value={sel.text}
                      onChange={(e) => updText(setDoc, sel.id, { text: e.target.value })}
                      className="w-full mt-1 text-sm border rounded p-2 min-h-16"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Taille : {sel.size}px</Label>
                      <Slider value={[sel.size]} min={12} max={90} step={2} onValueChange={([v]) => updText(setDoc, sel.id, { size: v })} className="mt-1.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Largeur max : {sel.maxWidth}%</Label>
                      <Slider value={[sel.maxWidth]} min={30} max={100} step={5} onValueChange={([v]) => updText(setDoc, sel.id, { maxWidth: v })} className="mt-1.5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="color" value={sel.color} onChange={(e) => updText(setDoc, sel.id, { color: e.target.value })} className="w-10 h-8 p-0.5" aria-label="Couleur du texte" />
                    <select value={sel.font} onChange={(e) => updText(setDoc, sel.id, { font: e.target.value })} aria-label="Police du texte" className="h-8 text-xs border rounded px-1">
                      {['Georgia', 'Times New Roman', 'Arial', 'Courier New', 'Verdana', 'Palatino'].map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <button onClick={() => updText(setDoc, sel.id, { bold: !sel.bold })} aria-label="Gras" className={`w-8 h-8 rounded border flex items-center justify-center ${sel.bold ? 'bg-slate-900 text-white' : ''}`}><BoldIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => updText(setDoc, sel.id, { italic: !sel.italic })} aria-label="Italique" className={`w-8 h-8 rounded border flex items-center justify-center ${sel.italic ? 'bg-slate-900 text-white' : ''}`}><ItalicIcon className="w-3.5 h-3.5" /></button>
                    {(['left', 'center', 'right'] as const).map((al) => (
                      <button key={al} onClick={() => updText(setDoc, sel.id, { align: al })} aria-label={`Aligner à ${al === 'left' ? 'gauche' : al === 'center' ? 'centrer' : 'droite'}`} className={`h-8 px-2 rounded border text-xs ${sel.align === al ? 'bg-slate-900 text-white' : ''}`}>{al === 'left' ? '⬅' : al === 'center' ? '↔' : '➡'}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Tabs>

        <div className="border-t px-4 sm:px-5 py-3 flex justify-end gap-2 bg-stone-50 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white">Enregistrer la couverture</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function updText(setDoc: (fn: (d: CoverDoc) => CoverDoc) => void, id: string, patch: Partial<CoverText>) {
  setDoc((d) => ({ ...d, texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function bgStyle(d: CoverDoc): React.CSSProperties {
  if (d.bgType === 'image' && d.imageDataUrl) {
    return { backgroundImage: `url(${d.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (d.bgType === 'gradient') {
    return { backgroundImage: `linear-gradient(135deg, ${d.gradFrom}, ${d.gradTo})` }
  }
  return { backgroundColor: d.bgColor }
}
