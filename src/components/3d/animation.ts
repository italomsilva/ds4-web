import { useFrame } from '@react-three/fiber'
import { MathUtils, type Object3D } from 'three'
import { activeInput } from '../../hooks/useGamepad'
import type { ButtonKey, MeshName } from '../../types/gamepad'

// ---------------------------------------------------------------------------
// Constantes de animação (compartilhadas entre modelo .GLB real e procedural)
// ---------------------------------------------------------------------------

/** Recuo máximo dos botões no eixo Y local */
export const PRESS_DEPTH = 0.022
/**
 * Inclinação máxima dos analógicos: ±0.4 rad (~22°), dentro da faixa de
 * 20°-25° da spec — impede que a peça saia da cavidade do controle.
 */
export const MAX_STICK_TILT = 0.4
/** Rotação máxima dos gatilhos L2/R2, proporcional à pressão (0.4 rad) */
export const MAX_TRIGGER_ROT = 0.4

/**
 * Especificação de animação por parte. O mesmo pipeline alimenta o modelo
 * procedural e o modelo .GLB real — apenas a coleta das partes difere.
 *
 * Os tipos "merged" cobrem modelos reais cujas peças vêm mescladas em um
 * único mesh (ex.: exportações do Sketchfab), animando o grupo de forma
 * combinada.
 */
export type PartSpec =
  | {
      kind: 'press'
      name: MeshName
      obj: Object3D
      baseY: number
      button: ButtonKey
    }
  | {
      kind: 'pressAny'
      name: MeshName
      obj: Object3D
      baseY: number
      buttons: ButtonKey[]
      depthScale: number
    }
  | {
      kind: 'stick'
      name: MeshName
      obj: Object3D
      stick: 'leftStick' | 'rightStick'
    }
  | {
      kind: 'stickMerged'
      name: MeshName
      obj: Object3D
    }
  | {
      kind: 'trigger'
      name: MeshName
      obj: Object3D
      baseRotX: number
      trigger: 'l2' | 'r2'
    }
  | {
      kind: 'triggerMerged'
      name: MeshName
      obj: Object3D
      baseRotX: number
    }

export type SpecsRef = { current: PartSpec[] }

/**
 * Animação imperativa via `useFrame`, com `THREE.MathUtils.lerp` e fator de
 * suavização independente da taxa de quadros — sem re-renders do React.
 */
export function useDualShockAnimation(specsRef: SpecsRef): void {
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const alpha = 1 - Math.exp(-delta * 14)
    const input = activeInput()

    for (const spec of specsRef.current) {
      switch (spec.kind) {
        case 'press': {
          const target = input.buttons[spec.button] ? spec.baseY - PRESS_DEPTH : spec.baseY
          spec.obj.position.y = MathUtils.lerp(spec.obj.position.y, target, alpha)
          break
        }
        case 'pressAny': {
          const any = spec.buttons.some((b) => input.buttons[b])
          const target = any ? spec.baseY - PRESS_DEPTH * spec.depthScale : spec.baseY
          spec.obj.position.y = MathUtils.lerp(spec.obj.position.y, target, alpha)
          break
        }
        case 'stick': {
          const value = input[spec.stick]
          // Rotação ESTRITAMENTE sobre a origem local (rotation.x / rotation.z),
          // sem alterar position X/Y/Z. O clamp ±MAX_STICK_TILT trava a peça
          // dentro da cavidade do controle.
          const rotX = MathUtils.clamp(value.y, -1, 1) * MAX_STICK_TILT
          const rotZ = MathUtils.clamp(value.x, -1, 1) * MAX_STICK_TILT
          spec.obj.rotation.x = MathUtils.lerp(spec.obj.rotation.x, rotX, alpha)
          spec.obj.rotation.z = MathUtils.lerp(spec.obj.rotation.z, -rotZ, alpha)
          break
        }
        case 'stickMerged': {
          // Grupo mesclado: inclinação combinada (média dos dois analógicos)
          const x = MathUtils.clamp(
            (input.leftStick.x + input.rightStick.x) / 2,
            -1,
            1,
          )
          const y = MathUtils.clamp(
            (input.leftStick.y + input.rightStick.y) / 2,
            -1,
            1,
          )
          spec.obj.rotation.x = MathUtils.lerp(spec.obj.rotation.x, y * MAX_STICK_TILT, alpha)
          spec.obj.rotation.z = MathUtils.lerp(spec.obj.rotation.z, -x * MAX_STICK_TILT, alpha)
          break
        }
        case 'trigger': {
          const target = spec.baseRotX - input.triggers[spec.trigger] * MAX_TRIGGER_ROT
          spec.obj.rotation.x = MathUtils.lerp(spec.obj.rotation.x, target, alpha)
          break
        }
        case 'triggerMerged': {
          // Grupo mesclado: usa o gatilho com maior pressão
          const value = Math.max(input.triggers.l2, input.triggers.r2)
          const target = spec.baseRotX - value * MAX_TRIGGER_ROT
          spec.obj.rotation.x = MathUtils.lerp(spec.obj.rotation.x, target, alpha)
          break
        }
      }
    }
  })
}
