// Test end-to-end du pipeline via socket.io
import { io } from 'socket.io-client'

const socket = io('http://localhost:3030', { path: '/', transports: ['websocket'] })
const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: bun test-pipeline.ts <projectId>')
  process.exit(1)
}

let deltas = 0
let deltaChars = 0
let lastStep = ''

socket.on('connect', () => {
  console.log('socket connecté:', socket.id)
  socket.emit('gen:start', { projectId })
})

socket.on('gen:step', (d: any) => {
  if (d.projectId !== projectId) return
  lastStep = d.detail || `${d.percent}%`
  const active = (d.steps || []).find((s: any) => s.status === 'active')
  console.log(`[step] ${d.percent}% ${active ? '→ ' + active.label : ''} ${d.detail ? '(' + d.detail + ')' : ''} [via ${d.provider}]`)
})

socket.on('gen:delta', (d: any) => {
  if (d.projectId !== projectId) return
  deltas++
  deltaChars += (d.html || '').length
  if (deltas <= 3) console.log(`[delta #${deltas}] ${d.html.slice(0, 120).replace(/\n/g, ' ')}…`)
})

socket.on('gen:done', (d: any) => {
  console.log(`\n[done] ${d.words} mots, ${d.units} unités, provider=${d.provider}, deltas=${deltas} (${deltaChars} car.)`)
  process.exit(0)
})

socket.on('gen:error', (d: any) => {
  console.error('[error]', d.message)
  process.exit(1)
})

socket.on('gen:status', (d: any) => {
  console.log('[status]', d.state)
  if (d.state === 'canceled') process.exit(0)
})

setTimeout(() => {
  console.error('TIMEOUT après 8 min — dernière étape:', lastStep)
  process.exit(2)
}, 8 * 60 * 1000)
