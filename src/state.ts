import { ROUND_DURATION, todaysQuest, DailyQuest } from './config'

// DCL runtime has localStorage on client side
declare const localStorage: {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

// ─── Phases ──────────────────────────────────────────────────────────────
export type Phase = 'lobby' | 'countdown' | 'playing' | 'gameover'

// ─── Leaderboard ─────────────────────────────────────────────────────────
export interface LbEntry {
  address: string
  name: string
  score: number
  coins: number
  sacks: number
  comboMax: number
  timestamp: number
}

function loadLeaderboard(): LbEntry[] {
  try { return JSON.parse(localStorage.getItem('sky_lb') || '[]') }
  catch { return [] }
}

function saveLeaderboard(lb: LbEntry[]) {
  try { localStorage.setItem('sky_lb', JSON.stringify(lb.slice(0, 10))) }
  catch {}
}

function getRank(lb: LbEntry[], score: number) {
  for (let i = 0; i < lb.length; i++) {
    if (score > lb[i].score) return i + 1
  }
  return Math.min(lb.length + 1, 11)
}

// ─── Persistent best ─────────────────────────────────────────────────────
function loadBest(): number {
  try { return parseInt(localStorage.getItem('sky_best') || '0') || 0 }
  catch { return 0 }
}
function saveBest(v: number) {
  try { localStorage.setItem('sky_best', '' + v) }
  catch {}
}

// ─── Daily quest completion ──────────────────────────────────────────────
function loadQuestDone(): boolean {
  const key = 'sky_qday'
  try { return localStorage.getItem(key) === '' + Math.floor(Date.now() / 86_400_000) }
  catch { return false }
}
function saveQuestDone() {
  try { localStorage.setItem('sky_qday', '' + Math.floor(Date.now() / 86_400_000)) }
  catch {}
}

// ─── Player name ─────────────────────────────────────────────────────────
function loadName(): string {
  try { return localStorage.getItem('sky_name') || '' }
  catch { return '' }
}
function saveName(name: string) {
  try { localStorage.setItem('sky_name', name) }
  catch {}
}

// ─── State ───────────────────────────────────────────────────────────────
export const state = {
  // Core
  phase: 'lobby' as Phase,
  score: 0,
  best: loadBest(),
  timeLeft: ROUND_DURATION,
  combo: 0,
  comboMax: 0,
  comboUntil: 0,
  roundStart: 0,
  countdown: 0,
  countdownAt: 0,
  coinsCollected: 0,
  sacksCollected: 0,
  sackActive: false,

  // Golden rush
  rushActive: false,
  rushEnd: 0,

  // Jump hint (for mobile double-tap)
  wantJump: false,

  // Player identity
  playerName: loadName() || 'Player',
  playerAddress: '',

  // Leaderboard (server-synced)
  lastRank: 0,
  lastBeat: '',
  leaderboard: loadLeaderboard() as LbEntry[],

  // Remote players (other players' live scores from the server)
  remotePlayers: [] as {
    name: string; score: number; coins?: number;
    combo?: number; phase: string; timeLeft?: number
  }[],

  // Quick chat
  quickChatLog: [] as { name: string; message: string; until: number }[],

  // Emote bubble above avatar
  emoteBubble: '' as string,
  emoteBubbleUntil: 0 as number,

  // Live server sync
  playersOnline: 0,
  rushFlashUntil: 0 as number,

  // Daily quest
  quest: todaysQuest() as DailyQuest,
  questDone: loadQuestDone(),
  questProgress: 0,

  // UI
  lastToast: '',
  toastUntil: 0,
  showEmoteBar: false,

  // Server sync timing
  lastScoreBroadcast: 0,

  // Name entry
  nameInput: '',
  showNameInput: false
}

// ─── Public helpers ──────────────────────────────────────────────────────
export function submitScore(name: string) {
  if (name) {
    state.playerName = name
    saveName(name)
  }

  const lb = state.leaderboard
  const entry: LbEntry = {
    address: state.playerAddress || 'local',
    name: state.playerName,
    score: state.score,
    coins: state.coinsCollected,
    sacks: state.sacksCollected,
    comboMax: state.comboMax,
    timestamp: Date.now()
  }

  const rank = getRank(lb, state.score)
  state.lastRank = rank
  state.lastBeat = rank - 1 >= 0 && rank - 1 < lb.length ? lb[rank - 1].name : ''

  lb.splice(rank - 1, 0, entry)
  state.leaderboard = lb.slice(0, 10)
  saveLeaderboard(state.leaderboard)

  if (state.score > state.best) {
    state.best = state.score
    saveBest(state.best)
  }

  // Daily quest progress
  const q = state.quest
  let val = 0
  if (q.type === 'score') val = state.score
  if (q.type === 'coins') val = state.coinsCollected
  if (q.type === 'sacks') val = state.sacksCollected
  if (q.type === 'combo') val = state.comboMax
  state.questProgress = Math.max(state.questProgress, val)
  if (state.questProgress >= q.target && !state.questDone) {
    state.questDone = true
    saveQuestDone()
  }
}

export function addQuickChat(name: string, message: string) {
  state.quickChatLog.push({ name, message, until: Date.now() + 6000 })
  if (state.quickChatLog.length > 4) state.quickChatLog.shift()

  // Also show as an emote bubble above the avatar
  state.emoteBubble = name + ': ' + message
  state.emoteBubbleUntil = Date.now() + 4000
}

export function updateRemotePlayers(players: { name: string; score: number; phase: string }[]) {
  state.remotePlayers = players
  // Server payload includes every player, so its length is the online count
  if (players.length > 0) state.playersOnline = players.length
}

export function setPlayersOnline(count: number) {
  if (count >= 0) state.playersOnline = count
}

// ─── Server leaderboard sync ───────────────────────────────────────────
export function mergeServerLeaderboard(entries: {
  address: string; name: string; score: number
}[]) {
  if (!entries || entries.length === 0) return
  const map = new Map<string, LbEntry>()
  for (const e of state.leaderboard) map.set(e.address, e)
  for (const e of entries) {
    const existing = map.get(e.address)
    if (!existing || e.score > existing.score) {
      map.set(e.address, {
        address: e.address,
        name: e.name,
        score: e.score,
        coins: (existing && existing.address === e.address) ? existing.coins : 0,
        sacks: (existing && existing.address === e.address) ? existing.sacks : 0,
        comboMax: (existing && existing.address === e.address) ? existing.comboMax : 0,
        timestamp: (existing && existing.address === e.address) ? existing.timestamp : 0
      })
    }
  }
  const merged = [...map.values()].sort((a, b) => b.score - a.score).slice(0, 10)
  state.leaderboard = merged
  saveLeaderboard(merged)
}

export function setPlayerName(name: string) {
  state.playerName = name
  saveName(name)
}
