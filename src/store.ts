import { create } from 'zustand'
import type { AnalogTriggers, ButtonKey, GamepadConnection, Vec2 } from './types/gamepad'

/**
 * Estado reativo da UI (Zustand).
 *
 * O estado de input "cru" (60fps) vive fora do React, em refs exportadas por
 * `hooks/useGamepad`, e é lido imperativamente pelo `useFrame` do modelo 3D —
 * evitando re-renders da árvore 3D. Aqui na store vai apenas o *snapshot*
 * formatado consumido pelo Overlay, mais a cor do LED.
 */
interface UiState {
  connection: GamepadConnection
  leftStick: Vec2
  rightStick: Vec2
  triggers: AnalogTriggers
  pressed: ButtonKey[]
  ledColor: string
  /** Preferência do usuário: modelo real (.GLB) ou procedural (reserva) */
  preferredModel: 'real' | 'procedural'
  /** Status do carregamento do .GLB real */
  glbStatus: 'checking' | 'available' | 'failed'
  /** Incrementado a cada nova tentativa manual do .GLB (reset do boundary) */
  glbAttempt: number
  setLedColor: (color: string) => void
  setPreferredModel: (model: 'real' | 'procedural') => void
  setGlbStatus: (status: 'checking' | 'available' | 'failed') => void
}

export const DEFAULT_LED_COLOR = '#0b6cff'

export const LED_PRESETS = [
  '#0b6cff',
  '#ff0040',
  '#00e676',
  '#ffd600',
  '#a855f7',
  '#ffffff',
]

export const useStore = create<UiState>((set) => ({
  connection: { connected: false, id: null },
  leftStick: { x: 0, y: 0 },
  rightStick: { x: 0, y: 0 },
  triggers: { l2: 0, r2: 0 },
  pressed: [],
  ledColor: DEFAULT_LED_COLOR,
  preferredModel: 'real',
  glbStatus: 'checking',
  glbAttempt: 0,
  setLedColor: (ledColor) => set({ ledColor }),
  setPreferredModel: (preferredModel) =>
    set((state) => ({
      preferredModel,
      // Ao forçar "real" após uma falha, remonta o Error Boundary (nova tentativa)
      glbAttempt: preferredModel === 'real' && state.glbStatus === 'failed' ? state.glbAttempt + 1 : state.glbAttempt,
      glbStatus: preferredModel === 'real' && state.glbStatus === 'failed' ? 'checking' : state.glbStatus,
    })),
  setGlbStatus: (glbStatus) => set({ glbStatus }),
}))
