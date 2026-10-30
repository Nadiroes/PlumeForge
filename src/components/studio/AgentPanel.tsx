'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudio } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Bot, User, Send, Loader2, BrainCircuit, Lightbulb, FileText, Moon, MessageSquareQuote,
  Sparkles, AlertTriangle, ChevronUp, Copy,
} from 'lucide-react'

const QUICK_ACTIONS = [
  { icon: Sparkles, label: 'Enrichir le passage sélectionné', prompt: 'Enrichis le passage suivant avec plus d\'images et de détails sensoriels :\n\n"""{selection}"""' },
  { icon: Moon, label: 'Rendre plus sombre', prompt: 'Réécris ce passage dans une atmosphère plus sombre et tendue :\n\n"""{selection}"""' },
  { icon: MessageSquareQuote, label: 'Densifier les dialogues', prompt: 'Transforme ce passage en ajoutant des dialogues avec du sous-texte :\n\n"""{selection}"""' },
  { icon: FileText, label: 'Proposer une suite', prompt: 'Propose la suite possible du texte en cours, cohérente avec la bible de style.' },
  { icon: Lightbulb, label: 'Suggérer des titres', prompt: 'Suggère 5 titres possibles pour ce livre, avec une justification courte.' },
]

export default function AgentPanel() {
  const current = useStudio((s) => s.current)
  const chat = useStudio((s) => s.chat)
  const chatStreaming = useStudio((s) => s.chatStreaming)
  const chatStreamText = useStudio((s) => s.chatStreamText)
  const sendChat = useStudio((s) => s.sendChat)
  const insertProposal = useStudio((s) => s.insertProposal)
  const genRunning = useStudio((s) => s.gen.running)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showLearnings, setShowLearnings] = useState(false)

  const learnings = (current?.learnings || '').split('\n').filter(Boolean)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.length, chatStreamText])

  const send = () => {
    if (!input.trim() || chatStreaming) return
    sendChat(input.trim())
    setInput('')
  }

  const applyQuick = (prompt: string) => {
    const sel = window.getSelection?.()?.toString() || ''
    setInput(prompt.replace('{selection}', sel.slice(0, 800) || ''))
  }

  if (!current) return null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2.5 border-b bg-white flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div className="mr-auto">
          <div className="text-sm font-semibold leading-none">Agents éditoriaux</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {genRunning ? 'Activés pendant la génération' : 'Prêts à enrichir ou rediriger le texte'}
          </div>
        </div>
        {learnings.length > 0 && (
          <Badge variant="outline" className="text-[10px] cursor-pointer border-violet-300 text-violet-700" onClick={() => setShowLearnings(!showLearnings)}>
            <BrainCircuit className="w-3 h-3 mr-1" /> {learnings.length} apprise{learnings.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {showLearnings && learnings.length > 0 && (
        <div className="px-3 py-2 bg-violet-50 border-b border-violet-100 text-xs text-violet-900">
          <div className="font-medium mb-1 flex items-center justify-between">Mémoire de préférences
            <button onClick={() => setShowLearnings(false)}><ChevronUp className="w-3.5 h-3.5" /></button>
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {learnings.map((l, i) => <li key={i}>{l.replace(/^•\s*/, '')}</li>)}
          </ul>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-3 py-3">
        <div className="space-y-3">
          {chat.length === 0 && !chatStreaming && (
            <div className="text-center py-8 px-4">
              <Bot className="w-10 h-10 mx-auto text-stone-300 mb-3" />
              <p className="text-sm font-medium mb-1">Discutez avec vos agents</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ils connaissent la bible de style, le plan et la mémoire du livre. Demandez d&apos;enrichir, de rediriger ou de réécrire un passage — chaque préférence que vous exprimez est apprise et appliquée à la suite.
              </p>
            </div>
          )}
          {chat.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} onInsert={() => insertProposal(m.content)} />
          ))}
          {chatStreaming && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-violet-50 rounded-xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap max-w-[85%]">
                {chatStreamText || <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-white p-2.5 space-y-2 shrink-0" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-1.5 flex-wrap overflow-y-auto max-h-24">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              onClick={() => applyQuick(q.prompt)}
              className="text-[10.5px] px-2 py-1 rounded-full border bg-stone-50 hover:bg-violet-50 hover:border-violet-300 flex items-center gap-1"
              title={q.prompt}
            >
              <q.icon className="w-3 h-3" /> {q.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ex : « rends ce chapitre plus suspensif », « ajoute un dialogue entre Anna et le gardien »…"
            className="min-h-16 max-h-40 text-sm"
          />
          <Button size="icon" onClick={send} disabled={chatStreaming || !input.trim()} className="bg-slate-900 hover:bg-slate-800 text-white shrink-0 h-9 w-9">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ role, content, onInsert }: { role: string; content: string; onInsert: () => void }) {
  if (role === 'learning') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5">
        <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
        <span><b>Préférence apprise :</b> {content}</span>
      </div>
    )
  }
  if (role === 'error') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{content}</span>
      </div>
    )
  }

  const isUser = role === 'user'
  const propIdx = !isUser ? content.indexOf('PROPOSITION :') : -1
  const intro = propIdx >= 0 ? content.slice(0, propIdx).trim() : !isUser ? content : content
  const proposal = propIdx >= 0 ? content.slice(propIdx + 'PROPOSITION :'.length).trim() : ''

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}
      <div className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${isUser ? 'bg-slate-900 text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-stone-100 rounded-tl-sm'}`}>
        {intro && <p className="whitespace-pre-wrap">{intro}</p>}
        {proposal && (
          <div className="mt-2 border rounded-lg bg-white p-2.5">
            <p className="text-xs text-stone-500 mb-1.5">Texte proposé :</p>
            <p className="whitespace-pre-wrap border-l-2 border-violet-300 pl-2 italic">{proposal}</p>
            <div className="flex gap-1.5 mt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onInsert}>
                Insérer dans le document
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigator.clipboard?.writeText(proposal)}>
                <Copy className="w-3 h-3 mr-1" /> Copier
              </Button>
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-600 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  )
}
