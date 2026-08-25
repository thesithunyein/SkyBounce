import { Schemas } from '@dcl/sdk/ecs'

// ─── Player Score Update ──────────────────────────────────────────────────
export const PlayerScoreMsg = Schemas.Map({
  address: Schemas.String,
  name: Schemas.String,
  score: Schemas.Int,
  coins: Schemas.Int,
  sacks: Schemas.Int,
  combo: Schemas.Int,
  comboMax: Schemas.Int,
  phase: Schemas.String,
  timeLeft: Schemas.Int
})

// ─── Quick Chat ───────────────────────────────────────────────────────────
export const QuickChatMsg = Schemas.Map({
  message: Schemas.String,
  senderName: Schemas.String
})

// ─── Round Control ────────────────────────────────────────────────────────
export const RoundStartMsg = Schemas.Map({
  roundId: Schemas.Int,
  duration: Schemas.Int
})

export const RoundEndMsg = Schemas.Map({
  roundId: Schemas.Int,
  winnerAddress: Schemas.String,
  winnerName: Schemas.String,
  winnerScore: Schemas.Int
})

// ─── Golden Rush ──────────────────────────────────────────────────────────
export const GoldenRushMsg = Schemas.Map({
  active: Schemas.Boolean,
  duration: Schemas.Int
})

// ─── Name Registration ────────────────────────────────────────────────────
export const NameRegisterMsg = Schemas.Map({
  name: Schemas.String
})

// ─── Leaderboard Entry ────────────────────────────────────────────────────
export const LbEntrySchema = Schemas.Map({
  address: Schemas.String,
  name: Schemas.String,
  score: Schemas.Int,
  coins: Schemas.Int,
  sacks: Schemas.Int,
  comboMax: Schemas.Int,
  timestamp: Schemas.Int
})

// ─── All messages registry ────────────────────────────────────────────────
export const AllMessages = {
  PlayerScoreMsg,
  QuickChatMsg,
  RoundStartMsg,
  RoundEndMsg,
  GoldenRushMsg,
  NameRegisterMsg,
  LbEntrySchema
}
