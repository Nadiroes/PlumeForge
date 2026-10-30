import { createServer } from 'http'
import { Server } from 'socket.io'
import { pipeline } from './src/pipeline'
import { checkInternet, checkOllama, USAGE } from './src/llm'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/', // DO NOT change: used by Caddy to forward
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const emit = (event: string, payload: any) => {
  io.emit(event, payload)
}

io.on('connection', (socket) => {
  console.log(`[ws] connecté: ${socket.id}`)

  socket.on('gen:start', async (data: { projectId: string }) => {
    if (!data?.projectId) return
    console.log(`[ws] gen:start ${data.projectId}`)
    await pipeline.start(data.projectId, emit)
  })

  socket.on('gen:pause', ({ projectId }: { projectId: string }) => {
    pipeline.pause(projectId)
    emit('gen:status', { projectId, state: 'paused' })
  })

  socket.on('gen:resume', ({ projectId }: { projectId: string }) => {
    pipeline.resume(projectId)
    emit('gen:status', { projectId, state: 'running' })
  })

  socket.on('gen:cancel', ({ projectId }: { projectId: string }) => {
    pipeline.cancel(projectId)
  })

  socket.on('chat:send', async (data: { projectId: string; message: string }) => {
    if (!data?.projectId || !data?.message) return
    console.log(`[ws] chat:send ${data.projectId}`)
    await pipeline.chat(data.projectId, data.message, emit)
  })

  socket.on('status:check', async (cb?: any) => {
    const ollama = await checkOllama(process.env.OLLAMA_URL || 'http://localhost:11434')
    const internet = await checkInternet()
    const payload = { ollama, internet, usage: USAGE.slice(0, 20), connected: true }
    if (typeof cb === 'function') cb(payload)
    else socket.emit('status:info', payload)
  })

  socket.on('disconnect', () => console.log(`[ws] déconnecté: ${socket.id}`))
  socket.on('error', (e: any) => console.error('[ws] erreur socket:', e))
})

const PORT = Number(process.env.PORT || 3030)
httpServer.listen(PORT, () => {
  console.log(`book-service (socket.io) démarré sur le port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
