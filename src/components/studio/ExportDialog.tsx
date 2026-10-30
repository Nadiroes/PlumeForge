'use client'

import { useState } from 'react'
import { useStudio } from '@/lib/store'
import { parseJson } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  FileDown, Printer, FileText, File, Loader2, Image as ImageIcon, CheckCircle2, Info,
} from 'lucide-react'

export default function ExportDialog() {
  const exportOpen = useStudio((s) => s.exportOpen)
  const openExport = useStudio((s) => s.openExport)
  const current = useStudio((s) => s.current)
  const openCover = useStudio((s) => s.openCover)
  const setPrintAuthor = useStudio((s) => s.setPrintAuthor)
  const { toast } = useToast()
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState('')

  if (!current) return null

  const brief = parseJson<{ authorName?: string }>(current.brief, {})

  const getAuthor = async () => {
    try {
      const r = await fetch('/api/settings')
      const s = await r.json()
      return s.authorName || brief.authorName || ''
    } catch {
      return ''
    }
  }

  const download = async (kind: 'docx' | 'doc' | 'md') => {
    setBusy(kind)
    setDone('')
    try {
      const author = await getAuthor()
      const r = await fetch(`/api/export/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: `<h1 style="text-align:center;font-size:26pt;margin-top:140pt">${current.title}</h1><hr />` + (current.contentHtml || '<p></p>'),
          title: current.title,
          author,
        }),
      })
      if (!r.ok) throw new Error('Export échoué')
      const blob = await r.blob()
      triggerDownload(blob, kind)
      setDone(kind)
      toast({ title: 'Export réussi', description: `« ${current.title} » a été téléchargé en .${kind}.` })
    } catch {
      toast({ title: 'Export échoué', description: 'Une erreur est survenue. Vérifiez votre connexion et réessayez.', variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const printPdf = async () => {
    setBusy('pdf')
    try {
      const author = await getAuthor()
      setPrintAuthor(author) // PrintView lit l'auteur depuis le store (rendu React, pas de hack DOM)
      setTimeout(() => {
        window.print()
        setBusy('')
        setDone('pdf')
      }, 250)
    } catch {
      setBusy('')
      toast({ title: 'Impression impossible', description: 'Le document n\'a pas pu être préparé.', variant: 'destructive' })
    }
  }

  const triggerDownload = (blob: Blob, kind: string) => {
    const ext = kind === 'docx' ? 'docx' : kind === 'doc' ? 'doc' : 'md'
    const safe = current.title.replace(/[^a-z0-9àâäéèêëïîôöùûüç \-]/gi, '').trim().slice(0, 60) || 'livre'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${safe}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const hasContent = (current.contentHtml || '').length > 0

  return (
    <Dialog open={exportOpen} onOpenChange={openExport}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><FileDown className="w-4 h-4" /> Finaliser — prêt à imprimer & export</DialogTitle>
          <DialogDescription className="sr-only">Exporter le livre</DialogDescription>
        </DialogHeader>

        {!hasContent && (
          <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Le document est vide — générez d&apos;abord le contenu avec les agents ou écrivez du texte.
          </div>
        )}

        <div className="space-y-2">
          <ExportRow
            icon={<Printer className="w-5 h-5" />}
            title="PDF — prêt à imprimer"
            desc="Couverture + sommaire + corps, mise en page A4 professionnelle (via la boîte d'impression)"
            onClick={printPdf}
            busy={busy === 'pdf'}
            ok={done === 'pdf'}
            disabled={!hasContent}
          />
          <ExportRow
            icon={<FileText className="w-5 h-5" />}
            title="Word moderne (.docx)"
            desc="Compatible Word, LibreOffice, Google Docs"
            onClick={() => download('docx')}
            busy={busy === 'docx'}
            ok={done === 'docx'}
            disabled={!hasContent}
          />
          <ExportRow
            icon={<File className="w-5 h-5" />}
            title="Word 97-2003 (.doc)"
            desc="Ancien format Word, lisible par toutes les versions"
            onClick={() => download('doc')}
            busy={busy === 'doc'}
            ok={done === 'doc'}
            disabled={!hasContent}
          />
          <ExportRow
            icon={<FileDown className="w-5 h-5" />}
            title="Markdown (.md)"
            desc="Texte brut structuré, idéal pour republication"
            onClick={() => download('md')}
            busy={busy === 'md'}
            ok={done === 'md'}
            disabled={!hasContent}
          />
          <ExportRow
            icon={<ImageIcon className="w-5 h-5" />}
            title="Images de couverture (avant / arrière)"
            desc="Éditer puis exporter la couverture en PNG"
            onClick={() => { openExport(false); openCover(true) }}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Le PDF intègre automatiquement la couverture avant, la page de titre, le sommaire, le corps du livre et la quatrième de couverture selon les éléments choisis.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ExportRow({ icon, title, desc, onClick, busy, ok, disabled }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; busy?: boolean; ok?: boolean; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="w-full flex items-center gap-3 border rounded-lg px-3.5 py-3 text-left hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-slate-700">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground truncate">{desc}</span>
      </span>
      {busy ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
    </button>
  )
}
