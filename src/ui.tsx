import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Input, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { state, setPlayerName } from './state'
import { NEON_GOLD, NEON_CYAN, NEON_GREEN, NEON_PURPLE, NEON_PINK, ROUND_DURATION, ARENA, PLATFORMS } from './config'
import { sendQuickChat, sendNameRegister } from './game'

let lastEmoteAt = 0

// ─── Palette ─────────────────────────────────────────────────────────────
const GOLD = Color4.create(NEON_GOLD.r, NEON_GOLD.g, NEON_GOLD.b, 1)
const CYAN = Color4.create(NEON_CYAN.r, NEON_CYAN.g, NEON_CYAN.b, 1)
const GREEN = Color4.create(NEON_GREEN.r, NEON_GREEN.g, NEON_GREEN.b, 1)
const PURPLE = Color4.create(NEON_PURPLE.r, NEON_PURPLE.g, NEON_PURPLE.b, 1)
const PINK = Color4.create(NEON_PINK.r, NEON_PINK.g, NEON_PINK.b, 1)
const PANEL = Color4.create(0.02, 0.015, 0.06, 0.94)
const PANEL_LIGHT = Color4.create(0.06, 0.04, 0.14, 0.9)
const TEXT_DIM = Color4.create(0.72, 0.78, 0.95, 0.9)
const TEXT_FAINT = Color4.create(0.5, 0.56, 0.75, 0.8)
const WHITE = Color4.create(1, 1, 1, 1)
const RUSH_GOLD = Color4.create(1, 0.85, 0.2, 1)

// ─── Quick Chat Messages ─────────────────────────────────────────────────
const EMOTES = [
  { icon: '🔥', text: 'Nice!' },
  { icon: '😤', text: 'So close!' },
  { icon: '🏆', text: 'gg' },
  { icon: '⚡', text: "Let's go!" },
  { icon: '😂', text: 'Haha!' },
  { icon: '👀', text: 'Watch this!' }
]

// ─── HUD (playing) ───────────────────────────────────────────────────────
function Hud() {
  if (state.phase !== 'playing') return null
  const m = Math.floor(state.timeLeft / 60)
  const s = state.timeLeft % 60
  const timeColor = state.timeLeft <= 10
    ? Color4.create(1, 0.2, 0.15, 1)
    : WHITE
  const combo = Math.min(state.combo, 5)

  return (
    <UiEntity>
      {/* Score — top left */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '2%', left: '2%' },
          padding: { top: 10, bottom: 10, left: 20, right: 20 },
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}
        uiBackground={{ color: PANEL }}>
        <Label value={'' + state.score} fontSize={52} color={GOLD} textAlign="middle-center" />
        <Label value="SCORE" fontSize={14} color={TEXT_FAINT} textAlign="middle-center" />
      </UiEntity>

      {/* Timer — top center */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '2%', left: '35%' },
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        uiBackground={{ color: PANEL }}>
        <Label value={m + ':' + (s < 10 ? '0' : '') + s} fontSize={40} color={timeColor} textAlign="middle-center" />
      </UiEntity>

      {/* Coins — top right */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '2%', right: '2%' },
          padding: { top: 10, bottom: 10, left: 20, right: 20 },
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        uiBackground={{ color: PANEL }}>
        <Label value={'🪙 ' + state.coinsCollected} fontSize={26} color={CYAN} textAlign="middle-center" />
      </UiEntity>

      {/* Combo — bottom center */}
      {combo >= 2 && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { bottom: '12%', left: '25%' },
            width: '50vw', padding: '16px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          uiBackground={{ color: Color4.create(0.16, 0.07, 0.02, 0.92) }}>
          <Label value={'⚡ COMBO x' + combo} fontSize={36}
            color={Color4.create(1, 0.55, 0.1, 1)} textAlign="middle-center" />
        </UiEntity>
      )}

      {/* Golden Rush banner */}
      {state.rushActive && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '16%', left: '20%' },
            width: '60vw', padding: '14px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          uiBackground={{ color: Color4.create(0.25, 0.18, 0.0, 0.95) }}>
          <Label value="⚡ GOLDEN RUSH — 2X SCORE!" fontSize={22} color={RUSH_GOLD} textAlign="middle-center" />
        </UiEntity>
      )}

      {/* Golden sack banner */}
      {state.sackActive && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '12%', left: '25%' },
            width: '50vw', padding: '8px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          uiBackground={{ color: Color4.create(0.2, 0.15, 0.02, 0.92) }}>
          <Label value="👑 GOLDEN SACK IS HERE" fontSize={18} color={GOLD} textAlign="middle-center" />
        </UiEntity>
      )}

      {/* GO! flash */}
      {Date.now() - state.roundStart < 800 && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '35%', left: '25%' },
            width: '50vw', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          <Label value="GO!" fontSize={110} color={GREEN} textAlign="middle-center" />
        </UiEntity>
      )}

      {/* Quick Chat Bar — bottom */}
      <EmoteBar />

      {/* Live chat log — left side */}
      <ChatLog />

      {/* Emote bubble above avatar */}
      <EmoteBubble />

      {/* Players online — under coins */}
      {state.playersOnline > 0 && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '9%', right: '2%' },
            padding: '6px 14px',
            display: 'flex', alignItems: 'center'
          }}
          uiBackground={{ color: PANEL }}>
          <Label
            value={'👥 ' + state.playersOnline + ' online'}
            fontSize={16} color={GREEN} textAlign="middle-center" />
        </UiEntity>
      )}

      {/* Golden Rush screen flash */}
      {Date.now() < state.rushFlashUntil && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute', position: { top: 0, left: 0 },
            width: '100vw', height: '100vh'
          }}
          uiBackground={{ color: Color4.create(1, 0.85, 0.2, 0.35) }} />
      )}

      {/* Remote player scores — right side */}
      <RemoteScores />

      {/* Mini-map — bottom right */}
      <MiniMap />
    </UiEntity>
  )
}

// ─── Emote Bar (now tappable!) ─────────────────────────────────────
function EmoteBar() {
  if (state.phase !== 'playing') return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '2%', left: '5%' },
        display: 'flex', flexDirection: 'row'
      }}>
      {EMOTES.map((em, i) => (
        <Button
          key={'emote-' + i}
          value={em.icon}
          fontSize={22}
          color={WHITE}
          uiTransform={{ padding: '8px 12px' }}
          uiBackground={{ color: PANEL_LIGHT }}
          onMouseDown={() => {
            const now = Date.now()
            if (now - lastEmoteAt < 2000) return // anti-spam, matches server
            lastEmoteAt = now
            sendQuickChat(em.text)
          }}
        />
      ))}
    </UiEntity>
  )
}

// ─── Live Chat Log ──────────────────────────────────────────────────
function ChatLog() {
  if (state.phase !== 'playing') return null
  const now = Date.now()
  const visible = state.quickChatLog.filter(m => m.until > now)
  if (visible.length === 0) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '22%', left: '2%' },
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start'
      }}>
      {visible.map((m, i) => (
        <UiEntity
          key={'chat-' + i + '-' + m.until}
          uiTransform={{ padding: '5px 12px', margin: { bottom: 4 } }}
          uiBackground={{ color: PANEL }}>
          <Label value={m.name + ': ' + m.message} fontSize={15} color={WHITE} textAlign="middle-left" />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Emote Bubble (above avatar) ────────────────────────────────────
function EmoteBubble() {
  if (state.phase !== 'playing') return null
  if (Date.now() > state.emoteBubbleUntil) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '30%', left: '30%' },
        width: '40vw', padding: '10px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0.1, 0.55, 0.9, 0.92) }}>
      <Label value={state.emoteBubble} fontSize={18} color={WHITE} textAlign="middle-center" />
    </UiEntity>
  )
}

// ─── Remote Player Scores ────────────────────────────────────────────────
function RemoteScores() {
  const visible = state.remotePlayers.filter(p => p.phase === 'playing').slice(0, 3)
  if (visible.length === 0) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '20%', right: '2%' },
        display: 'flex', flexDirection: 'column'
      }}>
      {visible.map((p, i) => (
        <UiEntity
          key={'rp-' + i}
          uiTransform={{
            padding: '6px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
          }}
          uiBackground={{ color: PANEL }}>
          <Label value={p.name} fontSize={14} color={CYAN} textAlign="middle-right" />
          <Label value={'' + p.score} fontSize={20} color={GOLD} textAlign="middle-right" />
        </UiEntity>
      ))}
    </UiEntity>
  )
}

// ─── Mini Map ────────────────────────────────────────────────────────────
function MiniMap() {
  if (state.phase !== 'playing') return null
  const mapSize = 90
  const arenaW = ARENA.maxX - ARENA.minX
  const arenaH = ARENA.maxZ - ARENA.minZ

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '14%', right: '2%' },
        width: mapSize, height: mapSize,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0.02, 0.015, 0.06, 0.7) }}>
      <Label value="🗺️" fontSize={40} color={TEXT_FAINT} textAlign="middle-center" />
    </UiEntity>
  )
}

// ─── Countdown ───────────────────────────────────────────────────────────
function CountdownOverlay() {
  if (state.phase !== 'countdown') return null
  const n = state.countdown
  const color = n === 3 ? CYAN : n === 2 ? GOLD : GREEN
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '20%', left: '25%' },
        width: '50vw', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
      <Label value={'' + n} fontSize={180} color={color} textAlign="middle-center" />
      <Label value="GET READY…" fontSize={24} color={TEXT_DIM} textAlign="middle-center" />
    </UiEntity>
  )
}

// ─── Name Input Modal (now functional!) ─────────────────────────────
function NameModal() {
  if (!state.showNameInput) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '0', left: '0' },
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.85) }}>
      <UiEntity
        uiTransform={{
          padding: '30px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}
        uiBackground={{ color: PANEL }}>
        <Label value="👤 ENTER YOUR NAME" fontSize={28} color={CYAN} textAlign="middle-center" />
        <Label value="Choose a name for the leaderboard" fontSize={16} color={TEXT_FAINT} textAlign="middle-center" />
        <Input
          placeholder="Your name..."
          value={state.nameInput}
          onChange={(v) => { state.nameInput = v }}
          onSubmit={(v) => {
            sendNameRegister(v || state.nameInput)
            state.showNameInput = false
          }}
          uiTransform={{ width: 280, height: 44 }}
          uiBackground={{ color: Color4.create(0.08, 0.06, 0.18, 1) }}
          color={WHITE}
          fontSize={20}
        />
        <Button
          value="▶  CONFIRM"
          fontSize={24}
          color={WHITE}
          uiTransform={{ padding: '14px 40px', margin: { top: 12 } }}
          uiBackground={{ color: Color4.create(0.12, 0.75, 0.35, 1) }}
          onMouseDown={() => {
            sendNameRegister(state.nameInput)
            state.showNameInput = false
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

// ─── How-to-play row ─────────────────────────────────────────────────────
function HowToRow(icon: string, text: string, color: Color4) {
  return (
    <UiEntity uiTransform={{ display: 'flex', flexDirection: 'row', alignItems: 'center', margin: { top: 8, bottom: 8 } }}>
      <Label value={icon} fontSize={28} color={color} textAlign="middle-left" />
      <Label value={'  ' + text} fontSize={22} color={TEXT_DIM} textAlign="middle-left" />
    </UiEntity>
  )
}

// ─── Lobby ───────────────────────────────────────────────────────────────
function LobbyScreen() {
  if (state.phase !== 'lobby') return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '3%', left: '3%' },
        width: '94vw', height: '92vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0.02, 0.015, 0.06, 0.92) }}>
      <Label value="🪙 SKY BOUNCE ⛰️" fontSize={56} color={CYAN} textAlign="middle-center" />
      <Label value="Jump & grab coins in the sky!" fontSize={22} color={TEXT_DIM} textAlign="middle-center" />

      {/* Players online / solo-graceful nudge */}
      {state.playersOnline > 1 ? (
        <Label value={'👥 ' + state.playersOnline + ' players online now'} fontSize={18} color={GREEN} textAlign="middle-center" />
      ) : (
        <Label value="🌅 You're the first one here — invite a friend to race!" fontSize={17} color={TEXT_FAINT} textAlign="middle-center" />
      )}

      {/* Tap to set name (opens the name modal) */}
      <Button
        value={'👤 Playing as: ' + state.playerName + '  (tap to change)'}
        fontSize={16}
        color={CYAN}
        uiTransform={{ margin: { top: 6 }, padding: '6px 18px' }}
        uiBackground={{ color: PANEL_LIGHT }}
        onMouseDown={() => {
          state.nameInput = state.playerName === 'Player' ? '' : state.playerName
          state.showNameInput = true
        }}
      />

      {/* How to play */}
      <UiEntity uiTransform={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: { top: 20 }, padding: { left: 28, right: 28 } }}>
        {HowToRow('🕹️', 'JUMP onto the sci-fi towers to grab coins', GOLD)}
        {HowToRow('🪙', 'Bigger coins float higher — jump higher!', CYAN)}
        {HowToRow('⚡', 'Collect fast = COMBO (up to x5)', Color4.create(1, 0.55, 0.1, 1))}
        {HowToRow('👑', 'Golden sack floats at the top — climb!', GOLD)}
        {HowToRow('🔥', 'Combo x15 = GOLDEN RUSH (2X score!)', PINK)}
        {HowToRow('⏱️', '' + ROUND_DURATION + ' seconds. Beat your best!', CYAN)}
      </UiEntity>

      {/* Leaderboard preview */}
      {state.leaderboard.length > 0 && (
        <UiEntity uiTransform={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: { top: 16 } }}>
          <Label value="🏆 LEADERBOARD" fontSize={18} color={GOLD} textAlign="middle-center" />
          {state.leaderboard.slice(0, 3).map((e, i) => (
            <Label key={'lb-' + i} value={(i + 1) + '. ' + e.name + ' — ' + e.score}
              fontSize={16} color={TEXT_DIM} textAlign="middle-center" />
          ))}
        </UiEntity>
      )}

      {/* PLAY button */}
      <UiEntity
        uiTransform={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: { top: 24 },
          padding: '20px 100px'
        }}
        uiBackground={{ color: Color4.create(0.12, 0.75, 0.35, 1) }}>
        <Label value={'▶  PLAY'} fontSize={38} color={WHITE} textAlign="middle-center" />
      </UiEntity>
      <Label value="Tap anywhere to start" fontSize={15} color={TEXT_FAINT} textAlign="middle-center" />

      {state.best > 0 && (
        <Label value={'🏆 Best: ' + state.best} fontSize={20} color={GOLD} textAlign="middle-center" />
      )}

      {/* Daily quest */}
      <UiEntity
        uiTransform={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          margin: { top: 12 }, padding: '10px 24px'
        }}
        uiBackground={{ color: PANEL_LIGHT }}>
        <Label value="📅 DAILY QUEST" fontSize={14} color={PINK} textAlign="middle-center" />
        <Label value={state.quest.icon + ' ' + state.quest.text}
          fontSize={16} color={TEXT_DIM} textAlign="middle-center" />
        {state.questDone && <Label value="✅ Done!" fontSize={14} color={GREEN} textAlign="middle-center" />}
      </UiEntity>
    </UiEntity>
  )
}

// ─── Game over ───────────────────────────────────────────────────────────
function GameOverScreen() {
  if (state.phase !== 'gameover') return null
  const isBest = state.score > 0 && state.score >= state.best
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '10%', left: '6%' },
        width: '88vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}
      uiBackground={{ color: PANEL }}>
      <Label value="⏱️ TIME'S UP!" fontSize={34} color={CYAN} textAlign="middle-center" />
      <Label value={'' + state.score} fontSize={80} color={GOLD} textAlign="middle-center" />
      {isBest && <Label value="🎉 NEW BEST!" fontSize={22} color={Color4.create(1, 0.9, 0.4, 1)} textAlign="middle-center" />}

      <UiEntity uiTransform={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: { top: 8 } }}>
        <Label value={'BEST ' + state.best} fontSize={20} color={TEXT_DIM} textAlign="middle-center" />
        <Label value={'🪙 ' + state.coinsCollected + ' coins  •  👑 ' + state.sacksCollected + ' golden'}
          fontSize={18} color={TEXT_FAINT} textAlign="middle-center" />
        {state.comboMax > 1 && (
          <Label value={'⚡ Max combo x' + state.comboMax}
            fontSize={16} color={Color4.create(1, 0.55, 0.1, 1)} textAlign="middle-center" />
        )}
      </UiEntity>

      {/* Leaderboard */}
      {state.leaderboard.length > 0 && (
        <UiEntity uiTransform={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: { top: 12 } }}>
          <Label value="🏆 LEADERBOARD" fontSize={16} color={GOLD} textAlign="middle-center" />
          {state.leaderboard.slice(0, 5).map((e, i) => (
            <Label key={'lbgo-' + i}
              value={(i + 1) + '. ' + e.name + ' — ' + e.score}
              fontSize={15} color={i === 0 ? GOLD : TEXT_DIM} textAlign="middle-center" />
          ))}
        </UiEntity>
      )}

      <UiEntity
        uiTransform={{
          margin: { top: 20 }, padding: '22px 80px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        uiBackground={{ color: Color4.create(0.12, 0.75, 0.35, 1) }}>
        <Label value="▶  PLAY AGAIN" fontSize={30} color={WHITE} textAlign="middle-center" />
      </UiEntity>
    </UiEntity>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────
export const uiMenu = () => (
  <UiEntity>
    <Hud />
    <CountdownOverlay />
    <LobbyScreen />
    <GameOverScreen />
    <NameModal />
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiMenu, { virtualWidth: 1920, virtualHeight: 1080 })
}
