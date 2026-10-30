'use client'

import { useEffect, useState } from 'react'
import { useStudio } from '@/lib/store'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { KeyRound, Loader2, CheckCircle2, XCircle, Wifi, WifiOff, Cloud, HardDrive, FlaskConical } from 'lucide-react'

interface SettingsData {
  mistralKey: string
  agnesKey: string
  ollamaUrl: string
  ollamaModel: string
  providerOrder: string
  authorName: string
}

const EMPTY: SettingsData = { mistralKey: '', agnesKey: '', ollamaUrl: 'http://localhost:11434', ollamaModel: '', providerOrder: 'auto', authorName: '' }

export default function SettingsDialog() {
  const settingsOpen = useStudio((s) => s.settingsOpen)
  const openSettings = useStudio((s) => s.openSettings)
  const checkConn = useStudio((s) => s.checkConn)
  const conn = useStudio((s) => s.conn)
  const [data, setData] = useState<SettingsData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<null | { mistral: boolean; agnes: boolean; internet: boolean; ollama: boolean }>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (settingsOpen) {
      fetch('/api/settings').then((r) => r.json()).then((s) =>
        setData({
          mistralKey: s.mistralKey || '', agnesKey: s.agnesKey || '',
          ollamaUrl: s.ollamaUrl || 'http://localhost:11434', ollamaModel: s.ollamaModel || '',
          providerOrder: s.providerOrder || 'auto', authorName: s.authorName || '',
        })
      ).catch(() => {})
    }
  }, [settingsOpen])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setSaved(true)
    checkConn()
    setTimeout(() => setSaved(false), 2500)
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const r = await fetch('/api/llm/status')
      setTest(await r.json())
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={openSettings}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4" /> Paramètres — moteurs IA</DialogTitle>
          <DialogDescription className="sr-only">Configurer les fournisseurs LLM</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Cloud className="w-4 h-4" /> APIs cloud</div>
            <div>
              <Label className="text-xs">Clé API Mistral AI</Label>
              <Input type="password" value={data.mistralKey} onChange={(e) => setData({ ...data, mistralKey: e.target.value })} placeholder="sk-…" className="mt-1" />
              <p className="text-[10.5px] text-muted-foreground mt-1">console.mistral.ai — modèles mistral-large / medium. Reste stockée localement.</p>
            </div>
            <div>
              <Label className="text-xs">Clé API Agnes AI</Label>
              <Input type="password" value={data.agnesKey} onChange={(e) => setData({ ...data, agnesKey: e.target.value })} placeholder="ak-…" className="mt-1" />
              <p className="text-[10.5px] text-muted-foreground mt-1">apihub.agnes-ai.com — modèle agnes-3.0-flash (agents, longues instructions).</p>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><HardDrive className="w-4 h-4" /> Modèle local (hors-ligne)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">URL Ollama</Label>
                <Input value={data.ollamaUrl} onChange={(e) => setData({ ...data, ollamaUrl: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Modèle</Label>
                <Input value={data.ollamaModel} onChange={(e) => setData({ ...data, ollamaModel: e.target.value })} placeholder="llama3.1, mistral-nemo…" className="mt-1" />
              </div>
            </div>
            <p className="text-[10.5px] text-muted-foreground">En cas de coupure réseau, PlumeForge bascule automatiquement sur Ollama s&apos;il est disponible, puis sur le mode démo 100 % hors-ligne.</p>
          </div>

          <div>
            <Label className="text-xs">Ordre de priorité des moteurs</Label>
            <Select value={data.providerOrder} onValueChange={(v) => setData({ ...data, providerOrder: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatique (cloud → local → intégré)</SelectItem>
                <SelectItem value="mistral">Mistral d&apos;abord</SelectItem>
                <SelectItem value="agnes">Agnes AI d&apos;abord</SelectItem>
                <SelectItem value="ollama">Ollama local d&apos;abord</SelectItem>
                <SelectItem value="zai">Moteur intégré uniquement</SelectItem>
                <SelectItem value="demo">Mode démo (100 % hors-ligne, sans IA)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Nom d&apos;auteur (pour la couverture et les exports)</Label>
            <Input value={data.authorName} onChange={(e) => setData({ ...data, authorName: e.target.value })} placeholder="Votre nom de plume" className="mt-1" />
          </div>

          {/* Statut */}
          <div className="rounded-lg border bg-stone-50 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium">Diagnostic</span>
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={runTest} disabled={testing}>
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tester maintenant'}
              </Button>
            </div>
            <StatusLine label="Connexion Internet" ok={test ? test.internet : conn.internet} unknown={!test && !conn.checked} />
            <StatusLine label="Ollama local" ok={test ? test.ollama : conn.ollama} unknown={!test && !conn.checked} />
            <StatusLine label="Clé Mistral configurée" ok={test ? test.mistral : Boolean(data.mistralKey)} />
            <StatusLine label="Clé Agnes configurée" ok={test ? test.agnes : Boolean(data.agnesKey)} />
            <p className="text-[10.5px] text-muted-foreground pt-1">
              <FlaskConical className="w-3 h-3 inline mr-1" />
              Sans aucune clé ni réseau, le <b>mode démo intégré</b> génère un livre structuré complet pour explorer tout le studio.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => openSettings(false)}>Fermer</Button>
          <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {saved ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Enregistré</> : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatusLine({ label, ok, unknown }: { label: string; ok: boolean; unknown?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {unknown ? <Wifi className="w-3.5 h-3.5 text-stone-400" />
        : ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        : <XCircle className="w-3.5 h-3.5 text-stone-400" />}
      <span>{label}</span>
      <span className="ml-auto text-stone-400">{unknown ? 'à vérifier' : ok ? 'OK' : 'indisponible'}</span>
    </div>
  )
}
