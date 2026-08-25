import { engine, Entity, Material, MeshRenderer, Transform, TextShape, Billboard } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { NEON_GOLD } from './config'

// ─── Shard particle pool ─────────────────────────────────────────────────
type Shard = {
  entity: Entity
  vx: number; vy: number; vz: number
  life: number; maxLife: number
  sx: number; sy: number; sz: number
}
const shards: Shard[] = []
const HIDDEN = Vector3.create(0, -80, 0)
let booted = false
const POOL = 60

function rand(a: number, b: number) { return a + Math.random() * (b - a) }

function makeBox(): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.clone(HIDDEN), scale: Vector3.create(0.01, 0.01, 0.01) })
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, { albedoColor: Color4.create(1, 1, 1, 1), roughness: 1, metallic: 0 })
  return e
}

function boot() {
  if (booted) return
  booted = true
  for (let i = 0; i < POOL; i++) {
    shards.push({
      entity: makeBox(),
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 0.5,
      sx: 0.1, sy: 0.1, sz: 0.1
    })
  }
  engine.addSystem(tickParticles)
}

function takeShard(): Shard | null {
  let oldest: Shard | null = null
  for (const s of shards) {
    if (s.life <= 0) return s
    if (!oldest || s.life < oldest.life) oldest = s
  }
  return oldest
}

function fire(origin: Vector3, ox: number, oy: number, oz: number,
  speed: number, color: Color4, size: number, life: number) {
  const s = takeShard()
  if (!s) return
  const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1
  s.vx = (ox / len) * speed
  s.vy = (oy / len) * speed + rand(1, 3)
  s.vz = (oz / len) * speed
  s.life = life; s.maxLife = life
  s.sx = size; s.sy = size; s.sz = size
  Material.setPbrMaterial(s.entity, {
    albedoColor: color, roughness: 1, metallic: 0,
    emissiveColor: Color3.create(color.r, color.g, color.b),
    emissiveIntensity: 10
  })
  const t = Transform.getMutable(s.entity)
  t.position = Vector3.create(origin.x + ox, origin.y + oy, origin.z + oz)
  t.scale = Vector3.create(size, size, size)
  t.rotation = Quaternion.fromAngleAxis(rand(0, 360), Vector3.Up())
}

export function spawnGoldBurst(origin: Vector3, big = false) {
  boot()
  const c = Color4.create(NEON_GOLD.r, NEON_GOLD.g, NEON_GOLD.b, 1)
  const count = big ? 28 : 12
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const r = rand(0.2, big ? 1.2 : 0.6)
    fire(origin, Math.cos(a) * r, rand(0.4, big ? 2.4 : 1.4), Math.sin(a) * r,
      rand(4, big ? 10 : 7), c, rand(0.06, 0.12), big ? 0.8 : 0.55)
  }
}

// ── GOLDEN RUSH burst ──
export function spawnRushBurst(center: Vector3) {
  boot()
  const gold = Color4.create(1, 0.85, 0.2, 1)
  const white = Color4.create(1, 1, 1, 1)
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    fire(center, Math.cos(a) * 2, rand(0.5, 2), Math.sin(a) * 2,
      rand(8, 14), gold, rand(0.1, 0.2), 1.2)
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    fire(center, Math.cos(a) * 4, rand(0.2, 1), Math.sin(a) * 4,
      rand(6, 10), white, rand(0.08, 0.15), 1.0)
  }
  for (let i = 0; i < 15; i++) {
    fire(center, rand(-1, 1), rand(1, 4), rand(-1, 1),
      rand(5, 9), gold, rand(0.12, 0.2), 1.4)
  }
}

function tickParticles(dt: number) {
  for (const s of shards) {
    if (s.life <= 0) continue
    s.life -= dt
    if (s.life <= 0) {
      Transform.getMutable(s.entity).position = HIDDEN
      Transform.getMutable(s.entity).scale = Vector3.create(0.01, 0.01, 0.01)
      continue
    }
    s.vy -= 6 * dt
    const t = Transform.getMutable(s.entity)
    t.position.x += s.vx * dt
    t.position.y += s.vy * dt
    t.position.z += s.vz * dt
    const u = Math.max(0, s.life / s.maxLife)
    t.scale = Vector3.create(s.sx * u, s.sy * u, s.sz * u)
  }
}

// ─── Floating "+30" popup texts ──────────────────────────────────────────
type Popup = { entity: Entity; until: number }
const popups: Popup[] = []
const popupPool: Entity[] = []
let fxBooted = false

function makePopupEntity(): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.clone(HIDDEN) })
  Billboard.create(e, { billboardMode: 1 })
  TextShape.create(e, { text: '', fontSize: 1.8, textColor: Color4.create(1, 0.85, 0.2, 1) })
  popupPool.push(e)
  return e
}

function ensureFx() {
  if (fxBooted) return
  fxBooted = true
  for (let i = 0; i < 5; i++) makePopupEntity()
  engine.addSystem(tickPopups)
}

export function spawnPopup(world: { x: number; y: number; z: number }, text: string, color?: Color4) {
  ensureFx()
  let pop = popups.find(p => p.until <= Date.now())
  if (!pop) {
    if (popups.length < 5) {
      const ent = popupPool.length > 0 ? popupPool.shift()! : makePopupEntity()
      pop = { entity: ent, until: 0 }
      popups.push(pop)
    } else {
      pop = popups[0]
    }
  }
  pop.until = Date.now() + 1000
  TextShape.getMutable(pop.entity).text = text
  if (color) TextShape.getMutable(pop.entity).textColor = color
  Transform.getMutable(pop.entity).position = Vector3.create(world.x, world.y + 0.5, world.z)
}

function tickPopups() {
  const now = Date.now()
  for (const p of popups) {
    if (p.until <= now) {
      Transform.getMutable(p.entity).position = Vector3.clone(HIDDEN)
    }
  }
}
