import type { Object3D } from 'three'
import { isButtonKey, isMeshName, type ButtonKey, type MeshName } from '../../types/gamepad'
import type { PartSpec } from './animation'

/**
 * Mapeamento dos nós do .GLB real para as partes interativas padronizadas.
 *
 * Estratégia em 4 passes (por ordem de prioridade):
 *  0. `userData` (extras embutidos no .glb, ex.: `{ role: 'press', button: 'cross' }`)
 *     — autoritativo; nós com `role: 'static'` são terminais (nunca animados);
 *  1. Nome padronizado EXATO (ex.: "Button_Cross") — GLBs bem estruturados;
 *  2. Padrões de nome individuais (ex.: "cross_01", "l2", "left_stick");
 *  3. Grupos MESCLADOS (ex.: "Joysticks", "Triggers", "Buttons") — comuns em
 *     exportações do Sketchfab, onde as peças não vêm separadas; nestes casos
 *     o grupo inteiro é animado de forma combinada.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Ação de interação por ponteiro associada a um nó do GLB */
export interface NodeRole {
  type: 'press' | 'stick' | 'trigger' | 'stickMerged' | 'triggerMerged' | 'pressAny'
  button?: ButtonKey
  stick?: 'left' | 'right'
  side?: 'l2' | 'r2'
  buttons?: ButtonKey[]
}

export interface GltfMapping {
  specs: PartSpec[]
  roles: Map<string, NodeRole>
  /** Partes padronizadas encontradas ("Parte ← nome real no GLB") */
  matchedNames: string[]
  /** Partes da spec sem nó equivalente no GLB */
  unmatchedNames: string[]
  /** Notas sobre grupos mesclados encontrados */
  mergedNotes: string[]
  /** Objeto da Lightbar (para sincronizar a cor emissiva do LED) */
  lightbar?: Object3D
}

const FACE_BUTTONS: ButtonKey[] = ['cross', 'circle', 'square', 'triangle']

const SPEC_PARTS: readonly MeshName[] = [
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

/** Botão lógico animado por cada parte padronizada (null = sem animação) */
const PART_TO_BUTTON: Partial<Record<MeshName, ButtonKey>> = {
  Button_Cross: 'cross',
  Button_Circle: 'circle',
  Button_Square: 'square',
  Button_Triangle: 'triangle',
  DPad_Up: 'dpadUp',
  DPad_Down: 'dpadDown',
  DPad_Left: 'dpadLeft',
  DPad_Right: 'dpadRight',
  Button_L1: 'l1',
  Button_R1: 'r1',
  Trigger_L2: 'l2',
  Trigger_R2: 'r2',
  Stick_Left: 'l3',
  Stick_Right: 'r3',
  Button_L3: 'l3',
  Button_R3: 'r3',
  Button_Share: 'share',
  Button_Options: 'options',
  Button_PS: 'ps',
  Touchpad: 'touchpad',
}

/** Padrões para encontrar cada parte individual em GLBs de terceiros */
const INDIVIDUAL_PATTERNS: ReadonlyArray<{ part: MeshName; regexes: RegExp[] }> = [
  { part: 'Button_Cross', regexes: [/cross/i, /_x_/i] },
  { part: 'Button_Circle', regexes: [/circle/i, /_o_/i] },
  { part: 'Button_Square', regexes: [/square/i, /_sq_/i] },
  { part: 'Button_Triangle', regexes: [/triangle/i, /_tri_/i] },
  { part: 'DPad_Up', regexes: [/dpad_?_?up/i, /d_?pad.*up/i] },
  { part: 'DPad_Down', regexes: [/dpad_?_?down/i, /d_?pad.*down/i] },
  { part: 'DPad_Left', regexes: [/dpad_?_?left/i, /d_?pad.*left/i] },
  { part: 'DPad_Right', regexes: [/dpad_?_?right/i, /d_?pad.*right/i] },
  { part: 'Button_L1', regexes: [/l1/i, /\blb_/i] },
  { part: 'Button_R1', regexes: [/r1/i, /\brb_/i] },
  { part: 'Trigger_L2', regexes: [/l2/i, /\blt_/i] },
  { part: 'Trigger_R2', regexes: [/r2/i, /\brt_/i] },
  { part: 'Stick_Left', regexes: [/left_?stick/i, /stick_?l\b/i, /stick.*left/i] },
  { part: 'Stick_Right', regexes: [/right_?stick/i, /stick_?r\b/i, /stick.*right/i] },
  { part: 'Button_L3', regexes: [/l3/i] },
  { part: 'Button_R3', regexes: [/r3/i] },
  { part: 'Button_Share', regexes: [/share/i, /\bback_?button/i] },
  { part: 'Button_Options', regexes: [/options/i, /\bstart_?button/i] },
  { part: 'Button_PS', regexes: [/ps_?button/i, /home/i, /guide/i, /playstation_?logo/i] },
  { part: 'Touchpad', regexes: [/touch/i] },
  { part: 'Lightbar', regexes: [/light_?bar/i] },
]

/** Padrões para grupos MESCLADOS (peças não separadas no GLB) */
const MERGED_PATTERNS: ReadonlyArray<{
  kind: 'stick' | 'trigger' | 'faceButtons'
  regexes: RegExp[]
  note: (name: string) => string
}> = [
  {
    kind: 'stick',
    regexes: [/joysticks?/i, /analog/i],
    note: (n) => `Analógicos mesclados em "${n}" — inclinação combinada (média L/R)`,
  },
  {
    kind: 'trigger',
    regexes: [/triggers?/i, /shoulders?/i],
    note: (n) => `Gatilhos/ombros mesclados em "${n}" — usa o gatilho com maior pressão`,
  },
  {
    kind: 'faceButtons',
    regexes: [/buttons/i, /face_?buttons/i],
    note: (n) => `Botões de ação mesclados em "${n}" — recuo combinado (qualquer botão)`,
  },
]

// ---------------------------------------------------------------------------
// Passo 0: extras embutidos no .glb (node.extras → Object3D.userData)
// ---------------------------------------------------------------------------

/** Formato dos extras gravados por nó no dualshock4_layers.glb */
interface GlbNodeExtras {
  role?: string
  button?: string
  stick?: string
  trigger?: string
}

/** Inverso de PART_TO_BUTTON: botão lógico (do userData) → parte padronizada */
const BUTTON_TO_PART: Partial<Record<ButtonKey, MeshName>> = {
  cross: 'Button_Cross',
  circle: 'Button_Circle',
  square: 'Button_Square',
  triangle: 'Button_Triangle',
  dpadUp: 'DPad_Up',
  dpadDown: 'DPad_Down',
  dpadLeft: 'DPad_Left',
  dpadRight: 'DPad_Right',
  l1: 'Button_L1',
  r1: 'Button_R1',
  l2: 'Trigger_L2',
  r2: 'Trigger_R2',
  // L3/R3 animam o stick inteiro (a base Stick_*_Base fica estática)
  l3: 'Stick_Left',
  r3: 'Stick_Right',
  share: 'Button_Share',
  options: 'Button_Options',
  ps: 'Button_PS',
  touchpad: 'Touchpad',
}

/**
 * Resolve a parte padronizada a partir dos extras do nó. Cobre os roles
 * 'press' | 'stick' | 'trigger' | 'led'; 'static' (peça fixa declarada) e
 * roles desconhecidos devolvem null.
 */
function partFromUserData(data: GlbNodeExtras): MeshName | null {
  switch (data.role) {
    case 'press':
      return isButtonKey(data.button ?? '') ? BUTTON_TO_PART[data.button as ButtonKey] ?? null : null
    case 'stick':
      return data.stick === 'leftStick' ? 'Stick_Left' : data.stick === 'rightStick' ? 'Stick_Right' : null
    case 'trigger':
      return data.trigger === 'l2' ? 'Trigger_L2' : data.trigger === 'r2' ? 'Trigger_R2' : null
    case 'led':
      return 'Lightbar'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Resolução DINÂMICA de ação pelo nome da malha clicada (e.object.name)
// ---------------------------------------------------------------------------

/**
 * Identifica a ação correspondente à malha efetivamente atingida pelo
 * raycasting, lendo o nome dela no momento do clique — sem referências
 * estáticas a um botão específico. Usado pelo modelo .GLB real, cujos
 * nomes de nós variam entre exportações.
 */
export function resolveActionFromName(name: string | undefined): NodeRole | null {
  if (!name) return null
  for (const rule of NAME_ACTION_PATTERNS) {
    if (rule.regexes.some((rx) => rx.test(name))) return rule.role
  }
  return null
}

const pressRole = (button: ButtonKey): NodeRole => ({ type: 'press', button })

/** Ordem importa: padrões mais específicos primeiro */
const NAME_ACTION_PATTERNS: ReadonlyArray<{ regexes: RegExp[]; role: NodeRole }> = [
  // Gatilhos analógicos (antes dos genéricos)
  { regexes: [/trigger_?l2/i, /_l2\b/i, /\bl2\b/i, /\blt\b/i], role: { type: 'trigger', side: 'l2' } },
  { regexes: [/trigger_?r2/i, /_r2\b/i, /\br2\b/i, /\brt\b/i], role: { type: 'trigger', side: 'r2' } },
  // Ombros
  { regexes: [/button_?l1/i, /\bl1\b/i, /\blb\b/i, /shoulder.*l/i], role: pressRole('l1') },
  { regexes: [/button_?r1/i, /\br1\b/i, /\brb\b/i, /shoulder.*r/i], role: pressRole('r1') },
  // Botões de ação
  { regexes: [/triangle/i, /_tri_/i], role: pressRole('triangle') },
  { regexes: [/circle/i, /_o_/i], role: pressRole('circle') },
  { regexes: [/cross/i, /_x_/i], role: pressRole('cross') },
  { regexes: [/square/i, /_sq_/i], role: pressRole('square') },
  // D-Pad
  { regexes: [/dpad.*up|d_?pad.*up/i], role: pressRole('dpadUp') },
  { regexes: [/dpad.*down|d_?pad.*down/i], role: pressRole('dpadDown') },
  { regexes: [/dpad.*left|d_?pad.*left/i], role: pressRole('dpadLeft') },
  { regexes: [/dpad.*right|d_?pad.*right/i], role: pressRole('dpadRight') },
  // Analógicos individuais (drag)
  { regexes: [/left_?stick/i, /stick_?l\b/i, /stick.*left/i, /_l3\b/i], role: { type: 'stick', stick: 'left' } },
  { regexes: [/right_?stick/i, /stick_?r\b/i, /stick.*right/i, /_r3\b/i], role: { type: 'stick', stick: 'right' } },
  // Especiais
  { regexes: [/share/i, /\bback_?button/i], role: pressRole('share') },
  { regexes: [/options/i, /\bstart_?button/i], role: pressRole('options') },
  { regexes: [/ps_?button/i, /home/i, /guide/i, /playstation_?logo/i], role: pressRole('ps') },
  { regexes: [/touch/i], role: pressRole('touchpad') },
  // Genéricos de grupos mesclados (por último)
  { regexes: [/triggers?/i], role: { type: 'triggerMerged' } },
  { regexes: [/joysticks?/i, /analog/i], role: { type: 'stickMerged' } },
]

// ---------------------------------------------------------------------------
// Mapeamento
// ---------------------------------------------------------------------------

export function mapGltfNodes(root: Object3D): GltfMapping {
  const specs: PartSpec[] = []
  const roles = new Map<string, NodeRole>()
  const assigned = new Set<MeshName>()
  const mergedKinds = new Set<'stick' | 'trigger' | 'faceButtons'>()
  const matchedNames: string[] = []
  const mergedNotes: string[] = []
  const unmatchedNames: string[] = []
  let lightbar: Object3D | undefined

  const addIndividual = (part: MeshName, obj: Object3D): void => {
    if (assigned.has(part)) return
    assigned.add(part)
    matchedNames.push(`${part} ← "${obj.name}"`)

    if (part === 'Lightbar') {
      lightbar = obj
      return
    }

    if (part === 'Stick_Left' || part === 'Stick_Right') {
      specs.push({
        kind: 'stick',
        name: part,
        obj,
        stick: part === 'Stick_Left' ? 'leftStick' : 'rightStick',
      })
      roles.set(obj.uuid, { type: 'stick', stick: part === 'Stick_Left' ? 'left' : 'right' })
      return
    }

    if (part === 'Trigger_L2' || part === 'Trigger_R2') {
      specs.push({ kind: 'trigger', name: part, obj, baseRotX: obj.rotation.x, trigger: part === 'Trigger_L2' ? 'l2' : 'r2' })
      roles.set(obj.uuid, { type: 'trigger', side: part === 'Trigger_L2' ? 'l2' : 'r2' })
      return
    }

    // Button_L3 / Button_R3 separados dos sticks: recuo simples no próprio nó
    const button = PART_TO_BUTTON[part]
    if (!button) return
    specs.push({ kind: 'press', name: part, obj, baseY: obj.position.y, button })
    roles.set(obj.uuid, { type: 'press', button })
  }

  const addMerged = (kind: 'stick' | 'trigger' | 'faceButtons', obj: Object3D): void => {
    mergedKinds.add(kind)
    switch (kind) {
      case 'stick':
        specs.push({ kind: 'stickMerged', name: 'Stick_Left', obj })
        roles.set(obj.uuid, { type: 'stickMerged' })
        break
      case 'trigger':
        specs.push({ kind: 'triggerMerged', name: 'Trigger_L2', obj, baseRotX: obj.rotation.x })
        roles.set(obj.uuid, { type: 'triggerMerged' })
        break
      case 'faceButtons':
        specs.push({
          kind: 'pressAny',
          name: 'Button_Cross',
          obj,
          baseY: obj.position.y,
          buttons: FACE_BUTTONS,
          depthScale: 0.5,
        })
        roles.set(obj.uuid, { type: 'pressAny', buttons: FACE_BUTTONS })
        break
    }
    mergedNotes.push(
      MERGED_PATTERNS.find((rule) => rule.kind === kind)!.note(obj.name || '(sem nome)'),
    )
  }

  root.traverse((obj) => {
    // 0) Extras embutidos no .glb (userData) — prioridade máxima sobre nomes.
    //    Nós com role 'static' (casco, bases dos analógicos, portas, parafusos)
    //    são TERMINAIS: não podem cair nos padrões por nome, que dariam
    //    falso-positivo ("Stick_Left_Base" casa com /stick.*left/i).
    const userData = obj.userData as GlbNodeExtras | undefined
    if (userData?.role) {
      const part = partFromUserData(userData)
      if (part && !assigned.has(part)) addIndividual(part, obj)
      return
    }

    const name = obj.name
    if (!name) return

    // 1) Nomes padronizados exatos
    if (isMeshName(name)) {
      addIndividual(name, obj)
      return
    }

    // 2) Padrões individuais
    for (const rule of INDIVIDUAL_PATTERNS) {
      if (assigned.has(rule.part)) continue
      if (rule.regexes.some((rx) => rx.test(name))) {
        addIndividual(rule.part, obj)
        return
      }
    }

    // 3) Grupos mesclados
    for (const rule of MERGED_PATTERNS) {
      if (mergedKinds.has(rule.kind)) continue
      if (rule.regexes.some((rx) => rx.test(name))) {
        addMerged(rule.kind, obj)
        return
      }
    }
  })

  for (const part of SPEC_PARTS) {
    if (!assigned.has(part)) unmatchedNames.push(part)
  }

  return { specs, roles, matchedNames, unmatchedNames, mergedNotes, lightbar }
}
