import type { Group, Mesh } from 'three'

/** Vetor 2D normalizado (analógicos do gamepad variam em [-1.0, 1.0]) */
export interface Vec2 {
  x: number
  y: number
}

/** Gatilhos analógicos (0 = solto, 1 = totalmente pressionado) */
export interface AnalogTriggers {
  l2: number
  r2: number
}

/** Botões lógicos do DualShock 4 */
export type ButtonKey =
  | 'cross'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'dpadUp'
  | 'dpadDown'
  | 'dpadLeft'
  | 'dpadRight'
  | 'l1'
  | 'r1'
  | 'l2'
  | 'r2'
  | 'l3'
  | 'r3'
  | 'share'
  | 'options'
  | 'ps'
  | 'touchpad'

/** Estado completo dos inputs, lido a cada frame */
export interface GamepadState {
  buttons: Record<ButtonKey, boolean>
  leftStick: Vec2
  rightStick: Vec2
  triggers: AnalogTriggers
}

/** Status da conexão física via Gamepad API */
export interface GamepadConnection {
  connected: boolean
  id: string | null
}

/**
 * Nomes padronizados das sub-malhas / nós do modelo 3D.
 * Um `.glb` em `public/models/dualshock4_layers.glb` deve seguir estes nomes;
 * o modelo procedural embutido já os utiliza nativamente.
 */
export type MeshName =
  | 'Button_Cross'
  | 'Button_Circle'
  | 'Button_Square'
  | 'Button_Triangle'
  | 'DPad_Up'
  | 'DPad_Down'
  | 'DPad_Left'
  | 'DPad_Right'
  | 'Button_L1'
  | 'Button_R1'
  | 'Trigger_L2'
  | 'Trigger_R2'
  | 'Stick_Left'
  | 'Stick_Right'
  | 'Button_L3'
  | 'Button_R3'
  | 'Button_Share'
  | 'Button_Options'
  | 'Button_PS'
  | 'Touchpad'
  | 'Lightbar'

/** Mapa tipado de nós retornados pelo useGLTF (ou coletados do modelo procedural) */
export type DualShockNodes = Partial<Record<MeshName, Mesh | Group>>

export const MESH_NAMES: readonly MeshName[] = [
  'Button_Cross',
  'Button_Circle',
  'Button_Square',
  'Button_Triangle',
  'DPad_Up',
  'DPad_Down',
  'DPad_Left',
  'DPad_Right',
  'Button_L1',
  'Button_R1',
  'Trigger_L2',
  'Trigger_R2',
  'Stick_Left',
  'Stick_Right',
  'Button_L3',
  'Button_R3',
  'Button_Share',
  'Button_Options',
  'Button_PS',
  'Touchpad',
  'Lightbar',
] as const

const MESH_NAME_SET: ReadonlySet<string> = new Set(MESH_NAMES)

export function isMeshName(name: string): name is MeshName {
  return MESH_NAME_SET.has(name)
}

/** Índices do "standard mapping" da Gamepad API -> botão lógico do DS4 */
export const STANDARD_BUTTON_MAP: Record<number, ButtonKey> = {
  0: 'cross',
  1: 'circle',
  2: 'square',
  3: 'triangle',
  4: 'l1',
  5: 'r1',
  6: 'l2',
  7: 'r2',
  8: 'share',
  9: 'options',
  10: 'l3',
  11: 'r3',
  12: 'dpadUp',
  13: 'dpadDown',
  14: 'dpadLeft',
  15: 'dpadRight',
  16: 'ps',
  17: 'touchpad',
}

const BUTTON_KEY_SET: ReadonlySet<string> = new Set(Object.values(STANDARD_BUTTON_MAP))

/** Type guard de ButtonKey a partir de string (ex.: extras/userData embutidos em GLBs) */
export function isButtonKey(value: string): value is ButtonKey {
  return BUTTON_KEY_SET.has(value)
}

export function createInitialGamepadState(): GamepadState {
  const buttons = {} as Record<ButtonKey, boolean>
  // Os VALORES de STANDARD_BUTTON_MAP são os ButtonKey válidos.
  for (const key of Object.values(STANDARD_BUTTON_MAP)) {
    buttons[key] = false
  }
  return {
    buttons,
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    triggers: { l2: 0, r2: 0 },
  }
}
