// Test de l'agent conversationnel + apprentissage
import { io } from 'socket.io-client'

const socket = io('http://localhost:3030', { path: '/', transports: ['websocket'] })
const projectId = process.argv[2]
const message = process.argv[3] || 'Je veux une atmosphère plus sombre et des dialogues denses.'

let text = ''
let learning = false

socket.on('connect', () => {
  console.log('connecté — envoi:', message.slice(0, 60))
  socket.emit('chat:send', { projectId, message })
})

socket.on('chat:delta', (d: any) => { if (d.projectId === projectId) text += d.delta })
socket.on('chat:learning', (d: any) => {
  if (d.projectId === projectId) { learning = true; console.log('[learning]', d.learning) }
})
socket.on('chat:done', () => {
  console.log('[done] réponse:', text.slice(0, 300))
  console.log('apprentissage détecté:', learning)
  process.exit(0)
})
socket.on('chat:error', (d: any) => { console.error('[error]', d.message); process.exit(1) })
setTimeout(() => { console.log('TIMEOUT — texte partiel:', text.slice(0, 200)); process.exit(2) }, 120000)
