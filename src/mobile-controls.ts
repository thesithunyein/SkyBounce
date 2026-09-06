import { engine, Transform, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { state } from './state'

// ─── Mobile-first jump controller ──────────────────────────────────────
// One tap = jump (like every real mobile game). Double-tap = jump higher,
// reaching the golden sack layer. Horizontal movement stays on the DCL
// joystick / WASD: mid-air steering works, so you can land on platforms
// while airborne, exactly like a touch platformer.
//
// Implementation: movePlayerTo lifts the avatar in an interpolated arc
// (MOVE_PLAYER permission in scene.json); the explorer's own gravity
// brings it down onto whatever surface is underneath.

const JUMP_APEX = 2.6        // single tap reaches coins up to ~2.5 high
const JUMP_DOUBLE_APEX = 4.4 // double tap reaches the sack layer
const DOUBLE_TAP_MS = 280
const ARC_MS = 300           // rise duration; gravity handles the fall

let lastTapAt = 0
let busy = false

async function doJump(apex: number, force = false) {
  if (busy && !force) return
  busy = true
  try {
    const p = Transform.get(engine.PlayerEntity).position
    await movePlayerTo({
      newRelativePosition: Vector3.create(p.x, p.y + apex, p.z),
      duration: ARC_MS
    })
  } catch {
    // permission missing or interrupted: fail silent, never block gameplay
  }
  busy = false
}

export function setupMobileControls() {
  engine.addSystem(() => {
    // Jumps only during active play (lobby taps start the round instead)
    if (state.phase !== 'playing') {
      lastTapAt = 0
      return
    }

    // ─── Input: tap / double-tap anywhere ───────────────────────────
    if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
      const now = Date.now()
      const isDouble = now - lastTapAt < DOUBLE_TAP_MS
      lastTapAt = now
      state.wantJump = true
      if (isDouble) {
        void doJump(JUMP_DOUBLE_APEX, true) // upgrade the arc mid-flight
      } else {
        void doJump(JUMP_APEX)
      }
    }

    // Spacebar / gamepad button on desktop
    if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) {
      void doJump(JUMP_DOUBLE_APEX)
    }
  })
}

export function isJumping(): boolean {
  return busy
}
