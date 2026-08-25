import {
  engine, Entity, Transform, GltfContainer, MeshRenderer, Material,
  LightSource, AudioSource, MeshCollider, inputSystem, InputAction, PointerEventType
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4, Quaternion } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import {
  ARENA, ROUND_DURATION, COIN_COUNT, COIN_VALUE, HIGH_COIN_VALUE, COIN_MODEL, COIN_SCALE,
  COLLECT_RADIUS, SACK_VALUE, SACK_EVERY_MS, SACK_LIFE_MS, SACK_MODEL, SACK_SCALE,
  COMBO_WINDOW_MS, PLATFORMS, CAMPFIRE, NEON_GOLD, WARM,
  RUSH_THRESHOLD, RUSH_DURATION_MS
} from './config'
import { state, submitScore } from './state'
import { spawnGoldBurst, spawnPopup, spawnRushBurst } from './fx'
import {
  initServer, startServerRound, endServerRound,
  clientSendScore, clientSendChat, clientSendName
} from './server'

// ─── Coin entities ───────────────────────────────────────────────────────
type Coin = {
  entity: Entity
  ring: Entity
  active: boolean
  x: number; y: number; z: number
  high: boolean
  phase: number
  base: number
}
const coins: Coin[] = []

// ── Sack entity ──────────────────────────────────────────────────────────
let sackEntity: Entity | null = null
let sackGlowEntity: Entity | null = null
let sackActive = false
let sackX = 0, sackY = 0, sackZ = 0
let sackSpawnAt = 0
let sackUntil = 0

// ─── Sound ────────────────────────────────────────────────────────────────
let soundEnt: Entity | null = null
function playSound(clip: string) {
  if (!soundEnt) return
  AudioSource.createOrReplace(soundEnt, {
    audioClipUrl: clip, playing: true, loop: false, volume: 0.5, global: true, currentTime: 0
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function flatCircle(color: Color3, radius: number, y: number): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(0, y, 0),
    scale: Vector3.create(radius, 0.02, radius)
  })
  MeshRenderer.setCylinder(e)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(color.r, color.g, color.b, 0.35),
    emissiveColor: color,
    emissiveIntensity: 3,
    roughness: 0.4
  })
  return e
}

function hideEntity(e: Entity | null) {
  if (e) Transform.getMutable(e).position = Vector3.create(0, -80, 0)
}

function rand(a: number, b: number) { return a + Math.random() * (b - a) }

// ─── Touch / Mobile Controls ─────────────────────────────────────────────
let lastTapTime = 0
const TAP_THRESHOLD = 300

function handleTouchInput() {
  if (state.phase !== 'playing') return

  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
    const now = Date.now()
    if (now - lastTapTime < TAP_THRESHOLD) {
      state.wantJump = true
    }
    lastTapTime = now
  }

  if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) {
    state.wantJump = true
  }
}

// ─── Scene building ──────────────────────────────────────────────────────
function buildScene() {
  const WALL_H = 4
  const WALL_T = 0.6
  const L = ARENA.maxX - ARENA.minX + 4
  const walls = [
    { x: (ARENA.minX + ARENA.maxX) / 2, z: ARENA.minZ - 1.3, sx: L, sz: WALL_T },
    { x: (ARENA.minX + ARENA.maxX) / 2, z: ARENA.maxZ + 1.3, sx: L, sz: WALL_T },
    { x: ARENA.minX - 1.3, z: (ARENA.minZ + ARENA.maxZ) / 2, sx: WALL_T, sz: L },
    { x: ARENA.maxX + 1.3, z: (ARENA.minZ + ARENA.maxZ) / 2, sx: WALL_T, sz: L }
  ]
  for (const w of walls) {
    const wall = engine.addEntity()
    Transform.create(wall, {
      position: Vector3.create(w.x, WALL_H / 2, w.z),
      scale: Vector3.create(w.sx, WALL_H, w.sz)
    })
    MeshCollider.setBox(wall)
  }

  // Neon rings + lights for each platform
  for (const p of PLATFORMS) {
    const ring = flatCircle(p.color, 1.1, 1.25)
    Transform.getMutable(ring).position = Vector3.create(p.x, 1.25, p.z)

    const light = engine.addEntity()
    Transform.create(light, { position: Vector3.create(p.x, 2.2, p.z) })
    LightSource.create(light, { color: p.color, intensity: 1.2, range: 5 })
  }

  // Campfire glow
  const fireLight = engine.addEntity()
  Transform.create(fireLight, { position: Vector3.create(CAMPFIRE.x, 1.5, CAMPFIRE.z) })
  LightSource.create(fireLight, { color: WARM, intensity: 2, range: 7 })

  const fireGlow = flatCircle(WARM, 3.2, 0.12)
  Transform.getMutable(fireGlow).position = Vector3.create(CAMPFIRE.x, 0.12, CAMPFIRE.z)

  // Floating ember dust — optimized for mobile
  const dust: Entity[] = []
  for (let i = 0; i < 12; i++) {
    const e = engine.addEntity()
    const x = rand(ARENA.minX, ARENA.maxX)
    const z = rand(ARENA.minZ, ARENA.maxZ)
    const y = rand(0.8, 7)
    Transform.create(e, { position: Vector3.create(x, y, z), scale: Vector3.create(0.05, 0.05, 0.05) })
    MeshRenderer.setSphere(e)
    Material.setPbrMaterial(e, {
      albedoColor: Color4.create(NEON_GOLD.r, NEON_GOLD.g, NEON_GOLD.b, 0.5),
      emissiveColor: NEON_GOLD,
      emissiveIntensity: 4
    })
    dust.push(e)
  }
  engine.addSystem((dt: number) => {
    for (const d of dust) {
      const t = Transform.getMutable(d)
      t.position.y += dt * 0.3
      if (t.position.y > 8) t.position.y = 0.8
    }
  })
}

// ─── Coin spawning ───────────────────────────────────────────────────────
function spawnCoin(c: Coin) {
  const p = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]
  c.x = p.x + rand(-1.2, 1.2)
  c.z = p.z + rand(-1.2, 1.2)
  const r = Math.random()
  if (r < 0.35) {
    c.y = rand(1.05, 1.4)
    c.high = false
  } else if (r < 0.72) {
    c.y = rand(1.5, 1.9)
    c.high = false
  } else {
    c.y = rand(2.0, 2.5)
    c.high = true
  }
  c.base = c.y
  c.active = true
  Transform.getMutable(c.entity).position = Vector3.create(c.x, c.y, c.z)
  Transform.getMutable(c.ring).position = Vector3.create(c.x, 0.05, c.z)
}

// ─── Coins collection ────────────────────────────────────────────────────
function tryCollect(c: Coin) {
  const ppos = Transform.get(engine.PlayerEntity).position
  const dx = ppos.x - c.x
  const dy = ppos.y + 1 - c.y
  const dz = ppos.z - c.z
  return Math.abs(dy) < 1.05 && Math.sqrt(dx * dx + dz * dz) < 1.8
}

function collectCoin(c: Coin) {
  const now = Date.now()
  state.combo = now < state.comboUntil ? state.combo + 1 : 1
  state.comboUntil = now + COMBO_WINDOW_MS
  if (state.combo > state.comboMax) state.comboMax = state.combo

  const mult = Math.min(state.combo, 5)
  const points = (c.high ? HIGH_COIN_VALUE : COIN_VALUE) * mult
  state.score += points
  state.coinsCollected++
  playSound('sounds/coin.wav')
  spawnGoldBurst({ x: c.x, y: c.y, z: c.z })
  spawnPopup({ x: c.x, y: c.y, z: c.z }, '+' + points + (mult > 1 ? ' x' + mult : ''))
  c.active = false
  Transform.getMutable(c.entity).position = Vector3.create(0, -80, 0)
  Transform.getMutable(c.ring).position = Vector3.create(0, -80, 0)
  setTimeout(() => { if (state.phase === 'playing') spawnCoin(c) }, 1500)

  // ★ GOLDEN RUSH TRIGGER
  if (state.combo >= RUSH_THRESHOLD && !state.rushActive) {
    triggerGoldenRush()
  }

  broadcastScore()
}

// ─── Golden Rush (FIXED) ─────────────────────────────────────────────────
function triggerGoldenRush() {
  state.rushActive = true
  state.rushEnd = Date.now() + RUSH_DURATION_MS
  playSound('sounds/coin.wav')

  spawnRushBurst({ x: ARENA.centerX, y: 2, z: ARENA.centerZ })
  spawnPopup(
    { x: ARENA.centerX, y: 4, z: ARENA.centerZ },
    '⚡ GOLDEN RUSH!',
    Color4.create(1, 0.95, 0.4, 1)
  )

  // Spawn extra coins during rush
  for (let i = 0; i < 6; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -80, 0) })
    GltfContainer.create(e, { src: COIN_MODEL })
    Transform.getMutable(e).scale = Vector3.create(COIN_SCALE * 1.3, COIN_SCALE * 1.3, COIN_SCALE * 1.3)
    const ring = flatCircle(NEON_GOLD, 1.2, 0.05)
    hideEntity(ring)
    const c: Coin = {
      entity: e, ring, active: false, x: 0, y: 0, z: 0,
      high: false, phase: Math.random() * Math.PI * 2, base: 0
    }
    coins.push(c)
    spawnCoin(c)
  }

  setTimeout(() => { state.rushActive = false }, RUSH_DURATION_MS)
}

// ─── Sack ────────────────────────────────────────────────────────────────
function spawnSack() {
  const p = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]
  sackX = p.x + rand(-0.4, 0.4)
  sackZ = p.z + rand(-0.4, 0.4)
  sackY = 2.2
  sackActive = true
  state.sackActive = true
  sackUntil = Date.now() + SACK_LIFE_MS
  Transform.getMutable(sackEntity!).position = Vector3.create(sackX, sackY, sackZ)
  Transform.getMutable(sackGlowEntity!).position = Vector3.create(sackX, 0.3, sackZ)
}

function collectSack() {
  const now = Date.now()
  state.combo = now < state.comboUntil ? state.combo + 1 : 1
  state.comboUntil = now + COMBO_WINDOW_MS
  if (state.combo > state.comboMax) state.comboMax = state.combo

  const mult = Math.min(state.combo, 5)
  const points = SACK_VALUE * mult
  state.score += points
  state.sacksCollected++
  playSound('sounds/sack.wav')
  spawnGoldBurst({ x: sackX, y: sackY, z: sackZ }, true)
  spawnPopup({ x: sackX, y: sackY, z: sackZ }, '+' + points + (mult > 1 ? ' x' + mult : ''), Color4.create(1, 0.95, 0.4, 1))
  sackActive = false
  state.sackActive = false
  hideEntity(sackEntity)
  hideEntity(sackGlowEntity)
  sackSpawnAt = Date.now() + SACK_EVERY_MS

  if (state.combo >= RUSH_THRESHOLD && !state.rushActive) {
    triggerGoldenRush()
  }

  broadcastScore()
}

// ─── Server Communication ────────────────────────────────────────────────
function broadcastScore() {
  if (isServer()) return // server handles via onPlayerScore
  clientSendScore({
    address: '', name: state.playerName,
    score: state.score, coins: state.coinsCollected,
    sacks: state.sacksCollected, combo: state.combo,
    comboMax: state.comboMax, phase: state.phase,
    timeLeft: state.timeLeft
  })
}

export function sendQuickChat(message: string) {
  clientSendChat(message, state.playerName)
}

export function sendNameRegister(name: string) {
  clientSendName(name)
}

// ─── Round control ───────────────────────────────────────────────────────
function startRound() {
  state.phase = 'countdown'
  state.score = 0
  state.combo = 0
  state.comboMax = 0
  state.timeLeft = ROUND_DURATION
  state.coinsCollected = 0
  state.sacksCollected = 0
  state.sackActive = false
  state.rushActive = false
  hideEntity(sackEntity)
  hideEntity(sackGlowEntity)
  state.countdown = 3
  state.countdownAt = Date.now() + 3000

  // Clean up rush coins
  for (const c of coins) {
    if (c.active) {
      Transform.getMutable(c.entity).position = Vector3.create(0, -80, 0)
      Transform.getMutable(c.ring).position = Vector3.create(0, -80, 0)
    }
  }
  while (coins.length > COIN_COUNT) {
    const extra = coins.pop()!
    engine.removeEntity(extra.entity)
    engine.removeEntity(extra.ring)
  }

  for (let i = 0; i < COIN_COUNT; i++) spawnCoin(coins[i])
  sackSpawnAt = Date.now() + 4000 + 3000

  startServerRound()
  broadcastScore()
}

function endRound() {
  state.phase = 'gameover'
  if (state.score > state.best) state.best = state.score
  state.lastToast = '🎉 NEW BEST!'
  state.toastUntil = Date.now() + 5000
  state.sackActive = false
  state.rushActive = false
  hideEntity(sackEntity)
  hideEntity(sackGlowEntity)
  playSound('sounds/end.wav')

  submitScore(state.playerName)
  endServerRound('')
  broadcastScore()
}

// ─── Main system ─────────────────────────────────────────────────────────
function gameSystem(dt: number) {
  const now = Date.now()

  if (state.phase === 'lobby') {
    if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
      startRound()
    }
    return
  }

  if (state.phase === 'countdown') {
    const left = Math.ceil((state.countdownAt - now) / 1000)
    state.countdown = Math.max(1, Math.min(3, left))
    if (now >= state.countdownAt) {
      state.phase = 'playing'
      state.roundStart = now
      state.countdown = 0
    }
    return
  }

  if (state.phase === 'gameover') {
    if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
      startRound()
    }
    return
  }

  // Playing
  handleTouchInput()

  state.timeLeft = Math.max(0, ROUND_DURATION - Math.floor((now - state.roundStart) / 1000))
  if (state.timeLeft <= 0) { endRound(); return }

  if (state.combo > 0 && now > state.comboUntil) state.combo = 0

  // Coins: rotate + bob + collect
  const t = now * 0.0011
  for (const c of coins) {
    if (!c.active) continue
    const tr = Transform.getMutable(c.entity)
    tr.rotation = Quaternion.fromEulerDegrees(0, t * 120 + c.phase, 0)
    tr.position.y = c.base + Math.sin(t * 3 + c.phase) * 0.12
    if (tryCollect(c)) collectCoin(c)
  }

  // Sack
  if (!sackActive && now > sackSpawnAt) {
    if (state.phase === 'playing') spawnSack()
  }
  tickSack()

  // Periodic score broadcast
  if (now - state.lastScoreBroadcast > 2000) {
    broadcastScore()
    state.lastScoreBroadcast = now
  }
}

function tickSack() {
  if (!sackActive || !sackEntity) return
  const now = Date.now()
  const tr = Transform.getMutable(sackEntity)
  tr.rotation = Quaternion.fromEulerDegrees(0, now * 0.09, 0)
  const remaining = sackUntil - now
  if (remaining <= 2000) {
    const blink = Math.floor(now / 200) % 2 === 0
    tr.scale = Vector3.create(
      blink ? SACK_SCALE : 0.2,
      blink ? SACK_SCALE : 0.2,
      blink ? SACK_SCALE : 0.2
    )
  } else {
    tr.scale = Vector3.create(SACK_SCALE, SACK_SCALE, SACK_SCALE)
  }
  tr.position.y = sackY + Math.sin(now * 0.003) * 0.15
  if (remaining <= 0) {
    sackActive = false
    state.sackActive = false
    hideEntity(sackEntity)
    hideEntity(sackGlowEntity)
    return
  }

  const ppos = Transform.get(engine.PlayerEntity).position
  const dx = ppos.x - sackX, dy = ppos.y + 1 - sackY, dz = ppos.z - sackZ
  if (Math.abs(dy) < 1.2 && Math.sqrt(dx * dx + dz * dz) < 2.0) collectSack()
}

// ─── Setup ───────────────────────────────────────────────────────────────
export function setupGame() {
  initServer()

  soundEnt = engine.addEntity()
  Transform.create(soundEnt, { position: Vector3.create(0, 0, 0) })
  AudioSource.create(soundEnt, { audioClipUrl: '', playing: false, loop: false, volume: 0.8, global: true })

  buildScene()

  // Coin pool
  for (let i = 0; i < COIN_COUNT; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -80, 0) })
    GltfContainer.create(e, { src: COIN_MODEL })
    Transform.getMutable(e).scale = Vector3.create(COIN_SCALE, COIN_SCALE, COIN_SCALE)
    const ring = flatCircle(NEON_GOLD, 0.8, 0.05)
    hideEntity(ring)
    coins.push({
      entity: e, ring, active: false, x: 0, y: 0, z: 0,
      high: false, phase: Math.random() * Math.PI * 2, base: 0
    })
  }

  // Sack entity + glow pad
  sackEntity = engine.addEntity()
  Transform.create(sackEntity, { position: Vector3.create(0, -80, 0) })
  GltfContainer.create(sackEntity, { src: SACK_MODEL })
  Transform.getMutable(sackEntity).scale = Vector3.create(SACK_SCALE, SACK_SCALE, SACK_SCALE)
  sackGlowEntity = flatCircle(NEON_GOLD, 2.2, 0.3)
  hideEntity(sackGlowEntity)

  engine.addSystem(gameSystem)
}
