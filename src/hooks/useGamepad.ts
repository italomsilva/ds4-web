import { useEffect } from 'react'
import { useStore } from '../store'
import {
  STANDARD_BUTTON_MAP,
  createInitialGamepadState,
  type ButtonKey,
  type GamepadState,
  type Vec2,
} from '../types/gamepad'

/**
 * Estado contínuo FORA do React (lido imperativamente pelo useFrame no 3D):
 * - `gamepadRef`: estado do controle físico via Gamepad API
 * - `virtualRef`: estado gerado por Mouse/Touch (fallback interativo)
 */
export const gamepadRef = { current: createInitialGamepadState() }
export const virtualRef = { current: createInitialGamepadState() }

/** Fonte de input ativa: físico quando conectado, senão mouse/touch. */
export function activeInput(): GamepadState {
  return useStore.getState().connection.connected ? gamepadRef.current : virtualRef.current
}

// ---------------------------------------------------------------------------
// Helpers para o modo interativo (Mouse/Touch) — escrevem em `virtualRef`
// ---------------------------------------------------------------------------

function cloneVirtual(): GamepadState {
  return {
    buttons: { ...virtualRef.current.buttons },
    leftStick: { ...virtualRef.current.leftStick },
    rightStick: { ...virtualRef.current.rightStick },
    triggers: { ...virtualRef.current.triggers },
  }
}

export function setVirtualButton(key: ButtonKey, pressed: boolean): void {
  virtualRef.current = cloneVirtual()
  virtualRef.current.buttons[key] = pressed
}

export function setVirtualStick(stick: 'left' | 'right', value: Vec2): void {
  virtualRef.current = cloneVirtual()
  if (stick === 'left') virtualRef.current.leftStick = value
  else virtualRef.current.rightStick = value
}

export function setVirtualTrigger(side: 'l2' | 'r2', value: number): void {
  virtualRef.current = cloneVirtual()
  virtualRef.current.triggers[side] = value
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function deadzone(v: number, dz = 0.06): number {
  return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz)
}

function readPhysicalGamepad(gp: Gamepad): void {
  const buttons = { ...gamepadRef.current.buttons }
  for (let i = 0; i < gp.buttons.length; i++) {
    const key = STANDARD_BUTTON_MAP[i]
    if (key) buttons[key] = gp.buttons[i].pressed
  }
  gamepadRef.current = {
    buttons,
    leftStick: {
      x: deadzone(gp.axes[0] ?? 0),
      y: deadzone(gp.axes[1] ?? 0),
    },
    rightStick: {
      x: deadzone(gp.axes[2] ?? 0),
      y: deadzone(gp.axes[3] ?? 0),
    },
    triggers: {
      l2: gp.buttons[6]?.value ?? 0,
      r2: gp.buttons[7]?.value ?? 0,
    },
  }
}

/**
 * Escuta `gamepadconnected` / `gamepaddisconnected` e executa o loop de
 * leitura continuada via `navigator.getGamepads()`, publicando um snapshot
 * na store para o Overlay.
 */
export function useGamepad(): void {
  useEffect(() => {
    const onConnect = (e: GamepadEvent): void => {
      useStore.setState({ connection: { connected: true, id: e.gamepad.id } })
    }
    const onDisconnect = (e: GamepadEvent): void => {
      if (useStore.getState().connection.id === e.gamepad.id) {
        useStore.setState({ connection: { connected: false, id: null } })
      }
      gamepadRef.current = createInitialGamepadState()
    }
    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    let raf = 0
    const tick = (): void => {
      // Um gamepad já conectado antes do mount não dispara o evento:
      // detectamos na leitura continuada.
      const pads = navigator.getGamepads?.() ?? []
      const gp = Array.from(pads).find((p) => p !== null)
      const state = useStore.getState()
      if (gp && !state.connection.connected) {
        useStore.setState({ connection: { connected: true, id: gp.id } })
      }

      if (gp) readPhysicalGamepad(gp)

      const connected = useStore.getState().connection.connected
      const source = connected ? gamepadRef.current : virtualRef.current
      useStore.setState({
        leftStick: {
          x: Number(source.leftStick.x.toFixed(2)),
          y: Number(source.leftStick.y.toFixed(2)),
        },
        rightStick: {
          x: Number(source.rightStick.x.toFixed(2)),
          y: Number(source.rightStick.y.toFixed(2)),
        },
        triggers: {
          l2: Number(source.triggers.l2.toFixed(2)),
          r2: Number(source.triggers.r2.toFixed(2)),
        },
        pressed: (Object.keys(source.buttons) as ButtonKey[]).filter(
          (key) => source.buttons[key],
        ),
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])
}
