'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { useStudio } from '@/lib/store'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Undo2, Redo2, Heading1, Heading2, Heading3, RemoveFormatting, Loader2, Check,
} from 'lucide-react'

// Extension taille de police (style Word)
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
      },
    }
  },
})

const FONTS = ['Georgia', 'Times New Roman', 'Arial', 'Calibri, Carlito, sans-serif', 'Courier New', 'Verdana', 'Palatino']
const SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '22pt', '28pt']
const COLORS = ['#1a1a1a', '#334155', '#7c2d12', '#1d4ed8', '#166534', '#7e22ce', '#b91c1c', '#a16207']

function countWords(html: string) {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null
  if (!div) return 0
  div.innerHTML = html
  return (div.textContent || '').split(/\s+/).filter(Boolean).length
}

export default function RichEditor() {
  const current = useStudio((s) => s.current)
  const saveContent = useStudio((s) => s.saveContent)
  const genRunning = useStudio((s) => s.gen.running)
  const deltaTick = useStudio((s) => s.deltaTick)
  const lastDelta = useStudio((s) => s.lastDelta)
  const setInsertFn = useStudio((s) => s.setInsertFn)
  const saveState = useStudio((s) => s.saveState)
  const syncTick = useStudio((s) => s.syncTick)
  // docHtml = null tant que l'utilisateur n'a pas modifié le document ; sinon HTML courant de l'éditeur
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAppliedTick = useRef(0)

  const wordCount = countWords(docHtml ?? current?.contentHtml ?? '')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      // FontSize étend TextStyle : pas besoin d'ajouter TextStyle séparément (évite le doublon 'textStyle')
      FontSize,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Votre page blanche vous attend… Lancez les agents avec « Générer » ou écrivez directement.' }),
    ],
    content: current?.contentHtml || '',
    editorProps: {
      attributes: {
        class: 'plume-prose focus:outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      setDocHtml(html)
      const wc = countWords(html)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (!useStudio.getState().gen.running) saveContent(html, wc)
      }, 900)
    },
  })

  // Insertion des deltas de génération à la fin du document
  const applyDelta = useCallback((html: string) => {
    if (!editor) return
    const end = editor.state.doc.content.size
    editor.commands.insertContentAt(end, html, { updateSelection: false })
  }, [editor])

  useEffect(() => {
    setInsertFn((html: string) => {
      if (!editor) return
      editor.commands.focus()
      editor.commands.insertContent(html)
    })
    return () => setInsertFn(null)
  }, [editor, setInsertFn])

  // Garde-fou : chaque delta n'est appliqué qu'UNE seule fois, même si l'effet
  // rejoue (recréation de l'éditeur via HMR / remount) — sinon duplication du texte.
  useEffect(() => {
    if (deltaTick > lastAppliedTick.current) {
      lastAppliedTick.current = deltaTick
      applyDelta(lastDelta)
    }
  }, [deltaTick, applyDelta, lastDelta])

  // Resynchronisation depuis le serveur à la fin de la génération (gen:done → syncTick).
  // emitUpdate=true → le callback onUpdate existant met à jour docHtml et le compteur de mots.
  useEffect(() => {
    if (syncTick > 0 && editor && current) {
      editor.commands.setContent(current.contentHtml || '', true)
      lastAppliedTick.current = useStudio.getState().deltaTick
    }
  }, [syncTick])

  // Scroll auto pendant la génération
  useEffect(() => {
    if (genRunning && scrollRef.current) {
      const t = setInterval(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 800)
      return () => clearInterval(t)
    }
  }, [genRunning])

  if (!editor) return null

  const chain = () => editor.chain().focus()
  const setFontSize = (size: string) => chain().setMark('textStyle', { fontSize: size }).run()
  const unsetSize = () => chain().unsetMark('textStyle').run()

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Barre d'outils façon Word — scrollable horizontalement sur mobile */}
      <div className="flex flex-nowrap md:flex-wrap items-center gap-1 px-2 py-2 border-b bg-white overflow-x-auto no-scrollbar md:overflow-x-visible">
        <Group>
          <select
            onChange={(e) => (e.target.value ? setFontSize(e.target.value) : unsetSize())}
            className="h-8 text-xs border rounded px-1.5 bg-white shrink-0"
            title="Taille de police"
            aria-label="Taille de police"
            defaultValue=""
          >
            <option value="">Taille</option>
            {SIZES.map((s) => <option key={s} value={s}>{s.replace('pt', '')}</option>)}
          </select>
          <select
            onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
            className="h-8 text-xs border rounded px-1.5 bg-white max-w-28 sm:max-w-32 shrink-0"
            title="Police"
            aria-label="Police"
            defaultValue=""
          >
            <option value="">Police</option>
            {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</option>)}
          </select>
        </Group>
        <Group>
          <TBtn active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} title="Gras (Ctrl+B)"><Bold className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} title="Italique (Ctrl+I)"><Italic className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} title="Souligné (Ctrl+U)"><UnderlineIcon className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} title="Barré"><Strikethrough className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('highlight')} onClick={() => chain().toggleHighlight().run()} title="Surligné"><Highlighter className="w-4 h-4" /></TBtn>
        </Group>
        <Group>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => chain().setColor(c).run()}
              title={`Couleur ${c}`}
              className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
          <TBtn onClick={() => chain().unsetColor().run()} title="Réinitialiser la couleur"><RemoveFormatting className="w-4 h-4" /></TBtn>
        </Group>
        <Group>
          <TBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()} title="Aligner à gauche"><AlignLeft className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()} title="Centrer"><AlignCenter className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()} title="Aligner à droite"><AlignRight className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()} title="Justifier"><AlignJustify className="w-4 h-4" /></TBtn>
        </Group>
        <Group>
          <TBtn active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} title="Liste à puces"><List className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} title="Liste numérotée"><ListOrdered className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('heading', { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()} title="Titre 1"><Heading1 className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} title="Titre 2"><Heading2 className="w-4 h-4" /></TBtn>
          <TBtn active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} title="Titre 3"><Heading3 className="w-4 h-4" /></TBtn>
        </Group>
        <Group>
          <TBtn onClick={() => chain().undo().run()} title="Annuler (Ctrl+Z)"><Undo2 className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => chain().redo().run()} title="Rétablir (Ctrl+Y)"><Redo2 className="w-4 h-4" /></TBtn>
        </Group>
      </div>

      {/* Page A4 — marges réduites sur mobile */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-stone-200/60 px-2 py-4 sm:px-6 sm:py-10 md:px-3 md:py-6">
        <div className="mx-auto w-full max-w-[820px] bg-white shadow-xl rounded-sm min-h-[70dvh] md:min-h-[1000px] px-4 sm:px-8 md:px-14 py-8 sm:py-12 md:py-16">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Barre d'état */}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-1.5 border-t bg-white text-[11px] text-muted-foreground">
        <span className="shrink-0">{wordCount.toLocaleString('fr-FR')} mots</span>
        <span className="hidden sm:inline">{wordCount > 0 ? `${Math.max(1, Math.ceil(wordCount / 280))} page(s) estimée(s)` : 'Document vide'}</span>
        {genRunning && (
          <span className="flex items-center gap-1.5 text-violet-700 font-medium truncate">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" /> <span className="truncate">Les agents écrivent…</span>
          </span>
        )}
        <span className="ml-auto hidden sm:flex items-center gap-1 min-w-0">
          {saveState.saving ? <>Enregistrement…</> : saveState.lastSaved ? <><Check className="w-3 h-3 text-emerald-600 shrink-0" /> <span className="truncate">Enregistré à {saveState.lastSaved}</span></> : '—'}
        </span>
      </div>
    </div>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-2 border-r last:border-r-0 shrink-0">{children}</div>
}

function TBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0 touch-manipulation ${active ? 'bg-slate-900 text-white' : 'hover:bg-stone-100 text-stone-700'}`}
    >
      {children}
    </button>
  )
}
