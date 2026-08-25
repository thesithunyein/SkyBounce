import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { registerMessages, getRoom } from '@dcl/sdk/network/events'
import { Storage } from '@dcl/sdk/server'
import { ROUND_DURATION } from './config'
import { AllMessages, PlayerScoreMsg, QuickChatMsg, NameRegisterMsg } from './messages'

// ─── Types ────────────────────────────────────────────────────────────────
interface ServerPlayer {
  address: string
  name: string
  score: number
  coins: number
  sacks: number
  combo: number
  comboMax: number
  phase: string
  timeLeft: number
  lastUpdate: number
}

interface LeaderboardEntry {
  address: string
  name: string
  score: number
  coins: number
  sacks: number
  comboMax: number
  timestamp: number
}

// ─── State ────────────────────────────────────────────────────────────────
const players = new Map<string, ServerPlayer>()
let leaderboard: LeaderboardEntry[] = []
let roundId = 0

const MAX_LEADERBOARD = 10
const LB_KEY = 'sky_leaderboard'
const NAME_KEY = 'sky_names'
const lastChat = new Map<string, number>()

let room: ReturnType<typeof registerMessages> | null = null

// ─── Persistence ──────────────────────────────────────────────────────────
function loadLeaderboard() {
  try {
    const raw = Storage.get(LB_KEY)
    if (raw) {
      Promise.resolve(raw).then(val => {
        if (val) leaderboard = JSON.parse(val as string)
      })
    }
  } catch { leaderboard = [] }
}

function saveLeaderboard() {
  try { Storage.set(LB_KEY, JSON.stringify(leaderboard)) }
  catch (e) { console.log('[server] LB save failed:', e) }
}

function loadNames() {
  try {
    const raw = Storage.get(NAME_KEY)
    if (raw) {
      Promise.resolve(raw).then(val => {
        if (val) {
          const names: Record<string, string> = JSON.parse(val as string)
          for (const [addr, name] of Object.entries(names)) {
            const p = players.get(addr)
            if (p) p.name = name
          }
        }
      })
    }
  } catch {}
}

function saveNames() {
  try {
    const out: Record<string, string> = {}
    for (const [addr, p] of players) if (p.name) out[addr] = p.name
    Storage.set(NAME_KEY, JSON.stringify(out))
  } catch {}
}

// ─── Leaderboard ──────────────────────────────────────────────────────────
function updateLB(entry: LeaderboardEntry) {
  const idx = leaderboard.findIndex(e => e.address === entry.address)
  if (idx >= 0) {
    if (entry.score > leaderboard[idx].score) leaderboard[idx] = entry
  } else {
    leaderboard.push(entry)
  }
  leaderboard.sort((a, b) => b.score - a.score)
  leaderboard = leaderboard.slice(0, MAX_LEADERBOARD)
  saveLeaderboard()
}

export function getServerLeaderboard(): LeaderboardEntry[] {
  return leaderboard.slice(0, MAX_LEADERBOARD)
}

// ─── Player helpers ───────────────────────────────────────────────────────
function getOrCreate(addr: string, name?: string): ServerPlayer {
  let p = players.get(addr)
  if (!p) {
    p = {
      address: addr, name: name || 'Player',
      score: 0, coins: 0, sacks: 0,
      combo: 0, comboMax: 0,
      phase: 'lobby', timeLeft: ROUND_DURATION,
      lastUpdate: Date.now()
    }
    players.set(addr, p)
  }
  return p
}

// ─── Server tick ──────────────────────────────────────────────────────────
function serverTick() {
  const now = Date.now()
  for (const [addr, p] of players) {
    if (now - p.lastUpdate > 30000) players.delete(addr)
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────
export function initServer() {
  if (!isServer()) return

  room = registerMessages(AllMessages)

  loadLeaderboard()
  loadNames()
  engine.addSystem(serverTick)

  // Handle incoming messages from clients
  room.onMessage('PlayerScoreMsg', (data, context) => {
    if (!context) return
    onPlayerScore(context.from, data)
  })

  room.onMessage('QuickChatMsg', (data, context) => {
    if (!context) return
    onQuickChat(context.from, data)
  })

  room.onMessage('NameRegisterMsg', (data, context) => {
    if (!context) return
    onNameRegister(context.from, data)
  })
}

// ─── Message handlers ────────────────────────────────────────────────────
function onPlayerScore(senderAddress: string, data: {
  score: number; coins: number; sacks: number
  combo: number; comboMax: number
  phase: string; timeLeft: number; name: string
}) {
  if (!isServer()) return
  const p = getOrCreate(senderAddress, data.name)
  p.score = data.score
  p.coins = data.coins
  p.sacks = data.sacks
  p.combo = data.combo
  p.comboMax = data.comboMax
  p.phase = data.phase
  p.timeLeft = data.timeLeft
  p.name = data.name || p.name
  p.lastUpdate = Date.now()

  if (data.phase === 'gameover') {
    updateLB({
      address: senderAddress, name: p.name,
      score: p.score, coins: p.coins, sacks: p.sacks,
      comboMax: p.comboMax, timestamp: Date.now()
    })
  }
}

function onQuickChat(senderAddress: string, data: {
  message: string; senderName: string
}) {
  if (!isServer()) return
  const now = Date.now()
  const last = lastChat.get(senderAddress) || 0
  if (now - last < 2000) return
  lastChat.set(senderAddress, now)

  // Rebroadcast to all clients
  if (room) {
    room.send('QuickChatMsg', {
      message: data.message,
      senderName: data.senderName
    })
  }
}

function onNameRegister(senderAddress: string, data: { name: string }) {
  if (!isServer()) return
  const p = getOrCreate(senderAddress, data.name)
  p.name = data.name
  saveNames()
}

export function startServerRound() {
  if (!isServer()) return
  roundId++
  for (const p of players.values()) {
    p.score = 0; p.coins = 0; p.sacks = 0
    p.combo = 0; p.comboMax = 0; p.phase = 'playing'
  }
}

export function endServerRound(addr: string) {
  if (!isServer()) return
  const p = players.get(addr)
  if (p) {
    updateLB({
      address: addr, name: p.name,
      score: p.score, coins: p.coins, sacks: p.sacks,
      comboMax: p.comboMax, timestamp: Date.now()
    })
  }
}

// ─── Client-side send helpers ─────────────────────────────────────────────
export function clientSendScore(data: {
  address: string; name: string;
  score: number; coins: number; sacks: number;
  combo: number; comboMax: number;
  phase: string; timeLeft: number
}) {
  if (isServer()) return
  const r = getRoom<typeof AllMessages>()
  r.send('PlayerScoreMsg', data)
}

export function clientSendChat(message: string, senderName: string) {
  if (isServer()) return
  const r = getRoom<typeof AllMessages>()
  r.send('QuickChatMsg', { message, senderName })
}

export function clientSendName(name: string) {
  if (isServer()) return
  const r = getRoom<typeof AllMessages>()
  r.send('NameRegisterMsg', { name })
}

export function clientOnChat(callback: (data: { message: string; senderName: string }) => void) {
  if (isServer()) return () => {}
  const r = getRoom<typeof AllMessages>()
  return r.onMessage('QuickChatMsg', callback)
}
