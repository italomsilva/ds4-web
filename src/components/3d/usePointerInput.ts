import { useMemo } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { MathUtils } from 'three'
import { setVirtualButton, setVirtualStick, setVirtualTrigger } from '../../hooks/useGamepad'
import type { ButtonKey, Vec2 } from '../../types/gamepad'

/**
 * Interação via Mouse/Touch (fallback sem controle físico), compartilhada
 * entre o modelo procedural e o modelo .GLB real. Desabilita temporariamente
 * o OrbitControls durante o arrasto/pressão.
 */
export interface PointerInput {
  setControlsEnabled: (enabled: boolean) => void
  pressButton: (key: ButtonKey) => (event: ThreeEvent<PointerEvent>) => void
  beginStickDrag: (
    stick: 'left' | 'right',
    clickKey: ButtonKey,
  ) => (event: ThreeEvent<PointerEvent>) => void
  beginTriggerDrag: (side: 'l2' | 'r2') => (event: ThreeEvent<PointerEvent>) => void
  /** Grupo com os dois sticks mesclados: arrasto define os dois eixos juntos */
  beginMergedStickDrag: (event: ThreeEvent<PointerEvent>) => void
  /** Grupo com os dois gatilhos mesclados: arrasto define L2 e R2 juntos */
  beginMergedTriggerDrag: (event: ThreeEvent<PointerEvent>) => void
  /** Efeito de cursor "pointer" ao passar sobre elementos interativos */
  pointerFx: {
    onPointerOver: () => void
    onPointerOut: () => void
  }
}

export function usePointerInput(): PointerInput {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null

  const setControlsEnabled = (enabled: boolean): void => {
    if (controls) controls.enabled = enabled
  }

  const pressButton =
    (key: ButtonKey) =>
    (event: ThreeEvent<PointerEvent>): void => {
      event.stopPropagation()
      setControlsEnabled(false)
      setVirtualButton(key, true)
      const release = (): void => {
        window.removeEventListener('pointerup', release)
        window.removeEventListener('pointercancel', release)
        setVirtualButton(key, false)
        setControlsEnabled(true)
      }
      window.addEventListener('pointerup', release)
      window.addEventListener('pointercancel', release)
    }

  const beginStickDrag =
    (stick: 'left' | 'right', clickKey: ButtonKey) =>
    (event: ThreeEvent<PointerEvent>): void => {
      event.stopPropagation()
      setControlsEnabled(false)
      setVirtualButton(clickKey, true)
      const startX = event.nativeEvent.clientX
      const startY = event.nativeEvent.clientY
      const onMove = (ev: PointerEvent): void => {
        const vec: Vec2 = {
          x: MathUtils.clamp((ev.clientX - startX) / 60, -1, 1),
          y: MathUtils.clamp((ev.clientY - startY) / 60, -1, 1),
        }
        setVirtualStick(stick, vec)
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        setVirtualStick(stick, { x: 0, y: 0 })
        setVirtualButton(clickKey, false)
        setControlsEnabled(true)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }

  const beginTriggerDrag =
    (side: 'l2' | 'r2') =>
    (event: ThreeEvent<PointerEvent>): void => {
      event.stopPropagation()
      setControlsEnabled(false)
      // Clique/manutenção: pressão imediata de 100% (telemetria da UI atualiza)
      setVirtualTrigger(side, 1)
      const startY = event.nativeEvent.clientY
      const onMove = (ev: PointerEvent): void => {
        // Arrasto refinado: pressão analógica proporcional (0..1)
        setVirtualTrigger(side, MathUtils.clamp((startY - ev.clientY) / 60, 0, 1))
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        setVirtualTrigger(side, 0)
        setControlsEnabled(true)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }

  const beginMergedStickDrag = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation()
    setControlsEnabled(false)
    setVirtualButton('l3', true)
    setVirtualButton('r3', true)
    const startX = event.nativeEvent.clientX
    const startY = event.nativeEvent.clientY
    const onMove = (ev: PointerEvent): void => {
      const vec: Vec2 = {
        x: MathUtils.clamp((ev.clientX - startX) / 60, -1, 1),
        y: MathUtils.clamp((ev.clientY - startY) / 60, -1, 1),
      }
      setVirtualStick('left', vec)
      setVirtualStick('right', vec)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setVirtualStick('left', { x: 0, y: 0 })
      setVirtualStick('right', { x: 0, y: 0 })
      setVirtualButton('l3', false)
      setVirtualButton('r3', false)
      setControlsEnabled(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const beginMergedTriggerDrag = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation()
    setControlsEnabled(false)
    // Clique/manutenção: ambos os gatilhos do grupo mesclado a 100%
    setVirtualTrigger('l2', 1)
    setVirtualTrigger('r2', 1)
    const startY = event.nativeEvent.clientY
    const onMove = (ev: PointerEvent): void => {
      const value = MathUtils.clamp((startY - ev.clientY) / 60, 0, 1)
      setVirtualTrigger('l2', value)
      setVirtualTrigger('r2', value)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setVirtualTrigger('l2', 0)
      setVirtualTrigger('r2', 0)
      setControlsEnabled(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const pointerFx = useMemo(
    () => ({
      onPointerOver: () => {
        document.body.style.cursor = 'pointer'
      },
      onPointerOut: () => {
        document.body.style.cursor = 'auto'
      },
    }),
    [],
  )

  return {
    setControlsEnabled,
    pressButton,
    beginStickDrag,
    beginTriggerDrag,
    beginMergedStickDrag,
    beginMergedTriggerDrag,
    pointerFx,
  }
}
