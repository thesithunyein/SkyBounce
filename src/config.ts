import { Color3 } from '@dcl/sdk/math'

// ─── Arena ───────────────────────────────────────────────────────────────
export const ARENA = {
  minX: -11, maxX: 27,
  minZ: -11, maxZ: 27,
  centerX: 8, centerZ: 8
}

// ─── Round timing ────────────────────────────────────────────────────────
export const ROUND_DURATION = 60

// ─── Coins ───────────────────────────────────────────────────────────────
export const COIN_COUNT = 12
export const COIN_VALUE = 10
export const HIGH_COIN_VALUE = 25
export const COIN_MODEL = 'assets/asset-packs/doubloon/Coin_01/Coin_01.glb'
export const COIN_SCALE = 4
export const COLLECT_RADIUS = 2.0

// ─── Golden sack ─────────────────────────────────────────────────────────
export const SACK_VALUE = 100
export const SACK_EVERY_MS = 12000
export const SACK_LIFE_MS = 8000
export const SACK_MODEL = 'assets/asset-packs/sack/Sack_01/Sack_01.glb'
export const SACK_SCALE = 2.5

// ─── Combo ───────────────────────────────────────────────────────────────
export const COMBO_WINDOW_MS = 3000

// ─── GOLDEN RUSH (combo 15 → 5s arena-wide 2X score) ────────────────────
export const RUSH_THRESHOLD = 15
export const RUSH_DURATION_MS = 5000

// ─── Sci-fi platforms ───────────────────────────────────────────────────
export const PLATFORMS = [
  { x: 6,     z: 2.75,  color: Color3.create(0.2, 0.9, 1)  },
  { x: 15.75, z: 1.75,  color: Color3.create(0.8, 0.3, 1)  },
  { x: 5.75,  z: -4.5,  color: Color3.create(0.3, 1, 0.5)  },
  { x: 6,     z: 13,    color: Color3.create(1, 0.85, 0.2)  }
]

// ─── Props ───────────────────────────────────────────────────────────────
export const CAMPFIRE = { x: -9.5, z: 12.5 }
export const TREE     = { x: -9.5, z: 17.25 }

// ─── Daily quests (rotate every 24 h) ──────────────────────────────────
export interface DailyQuest {
  icon: string
  text: string
  type: 'score' | 'coins' | 'sacks' | 'combo'
  target: number
}
export const DAILY_QUESTS: DailyQuest[] = [
  { icon: '🎯', text: 'Score 500 in 60s',   type: 'score',  target: 500  },
  { icon: '🪙', text: 'Collect 30 coins',    type: 'coins',  target: 30   },
  { icon: '👑', text: 'Grab 2 golden sacks', type: 'sacks',  target: 2    },
  { icon: '⚡', text: 'Reach 15× combo',     type: 'combo',  target: 15   },
  { icon: '🏆', text: 'Score 1000 in 60s',   type: 'score',  target: 1000 },
  { icon: '🪙', text: 'Collect 50 coins',    type: 'coins',  target: 50   },
]
export function todaysQuest(): DailyQuest {
  const day = Math.floor(Date.now() / 86_400_000)
  return DAILY_QUESTS[day % DAILY_QUESTS.length]
}

// ─── Palette ─────────────────────────────────────────────────────────────
export const NEON_GOLD   = Color3.create(1, 0.85, 0.2)
export const NEON_CYAN   = Color3.create(0.2, 0.9, 1)
export const NEON_PURPLE = Color3.create(0.8, 0.3, 1)
export const NEON_GREEN  = Color3.create(0.3, 1, 0.5)
export const NEON_PINK   = Color3.create(1, 0.3, 0.6)
export const WARM        = Color3.create(1, 0.6, 0.25)
