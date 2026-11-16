import { useEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import { useStore } from '../../store'
import { usePointerInput } from './usePointerInput'
import { useDualShockAnimation, type PartSpec, type SpecsRef } from './animation'
import {
  createButtonTextures,
  type ArrowDirection,
  type FaceSymbol,
} from './buttonTextures'
import { isMeshName, type ButtonKey, type MeshName } from '../../types/gamepad'

interface StickEntry {
  name: MeshName
  stick: 'leftStick' | 'rightStick'
}

const PRESS_PARTS: ReadonlyArray<readonly [MeshName, ButtonKey]> = [
  ['Button_Cross', 'cross'],
  ['Button_Circle', 'circle'],
  ['Button_Square', 'square'],
  ['Button_Triangle', 'triangle'],
  ['DPad_Up', 'dpadUp'],
  ['DPad_Down', 'dpadDown'],
  ['DPad_Left', 'dpadLeft'],
  ['DPad_Right', 'dpadRight'],
  ['Button_L1', 'l1'],
  ['Button_R1', 'r1'],
  ['Button_Share', 'share'],
  ['Button_Options', 'options'],
  ['Button_PS', 'ps'],
  ['Touchpad', 'touchpad'],
] as const

const STICK_PARTS: readonly StickEntry[] = [
  { name: 'Stick_Left', stick: 'leftStick' },
  { name: 'Stick_Right', stick: 'rightStick' },
] as const

const TRIGGER_PARTS: ReadonlyArray<readonly [MeshName, 'l2' | 'r2']> = [
  ['Trigger_L2', 'l2'],
  ['Trigger_R2', 'r2'],
] as const

const BODY_COLOR = '#1b1c22'
const STICK_RUBBER = '#2b2b30'
const PLASTIC_COLOR = '#24252b'
const DPAD_COLOR = '#1f2026'
const SHELL_DARK = '#0e0e12'

// ---------------------------------------------------------------------------
// Silhueta do chassi: UM único contorno (deck + grips) extrudado com bevel
// grande, em vez de caixa + duas "salsichas" coladas.
// Coordenadas do shape: x = largura, y = -z do mundo (frente do jogador = y negativo).
// Define-se só a metade direita; a esquerda é o espelho, gerado por código.
// ---------------------------------------------------------------------------
type Pt = readonly [number, number]
interface Seg {
  c1: Pt
  c2: Pt
  to: Pt
}

const OUTLINE_START: Pt = [0, 0.38]

const OUTLINE_RIGHT: readonly Seg[] = [
  // borda traseira, levemente arqueada até o ombro
  { c1: [0.25, 0.38], c2: [0.55, 0.36], to: [0.78, 0.3] },
  // ombro → lateral externa do deck
  { c1: [0.88, 0.24], c2: [0.9, 0.05], to: [0.88, -0.2] },
  // lateral externa do grip (abre para fora)
  { c1: [0.88, -0.5], c2: [0.9, -0.72], to: [0.8, -0.86] },
  // ponta arredondada do grip
  { c1: [0.76, -1.02], c2: [0.56, -1.02], to: [0.52, -0.88] },
  // lateral interna do grip (côncava) subindo até o deck
  { c1: [0.46, -0.7], c2: [0.4, -0.55], to: [0.4, -0.4] },
  // borda frontal do deck entre os grips
  { c1: [0.25, -0.38], c2: [0.12, -0.36], to: [0, -0.36] },
]

const mirror = (p: Pt): Pt => [-p[0], p[1]]

const BODY_DEPTH = 0.2
const BODY_BEVEL = 0.08

function buildBodyGeometry(): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(OUTLINE_START[0], OUTLINE_START[1])
  for (const { c1, c2, to } of OUTLINE_RIGHT) {
    shape.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], to[0], to[1])
  }
  for (let i = OUTLINE_RIGHT.length - 1; i >= 0; i--) {
    const start = i === 0 ? OUTLINE_START : OUTLINE_RIGHT[i - 1].to
    const a = mirror(OUTLINE_RIGHT[i].c2)
    const b = mirror(OUTLINE_RIGHT[i].c1)
    const e = mirror(start)
    shape.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1])
  }

  const geo = new ExtrudeGeometry(shape, {
    depth: BODY_DEPTH,
    bevelEnabled: true,
    bevelThickness: BODY_BEVEL,
    bevelSize: BODY_BEVEL,
    bevelSegments: 10,
    curveSegments: 40,
  })
  // shape (x, y, extrusão) → mundo (x, -z, y): topo do deck fica em y = 0
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, -(BODY_DEPTH + BODY_BEVEL), 0)
  geo.computeVertexNormals()
  return geo
}

export function DualShockModel(): React.ReactElement {
  const rootRef = useRef<Group>(null)
  const specsRef = useRef<PartSpec[]>([]) as SpecsRef
  const ledColor = useStore((s) => s.ledColor)
  const { pressButton, beginStickDrag, beginTriggerDrag, pointerFx } = usePointerInput()
  const textures = useMemo(() => createButtonTextures(), [])
  const bodyGeometry = useMemo(() => buildBodyGeometry(), [])

  useEffect(() => () => bodyGeometry.dispose(), [bodyGeometry])

  useEffect(() => {
    const specs: PartSpec[] = []
    rootRef.current?.traverse((obj) => {
      if (!obj.name || !isMeshName(obj.name)) return
      const name = obj.name as MeshName
      const baseY = obj.position.y
      const baseRotX = obj.rotation.x

      const pressEntry = PRESS_PARTS.find(([partName]) => partName === name)
      if (pressEntry) {
        specs.push({ kind: 'press', name, obj, baseY, button: pressEntry[1] })
        return
      }

      const stickEntry = STICK_PARTS.find((entry) => entry.name === name)
      if (stickEntry) {
        specs.push({ kind: 'stick', name, obj, stick: stickEntry.stick })
        return
      }

      const triggerEntry = TRIGGER_PARTS.find(([partName]) => partName === name)
      if (triggerEntry) {
        specs.push({ kind: 'trigger', name, obj, baseRotX, trigger: triggerEntry[1] })
      }
    })
    specsRef.current = specs
  }, [])

  useDualShockAnimation(specsRef)

  // Botões de ação (X, O, Quadrado, Triângulo)
  const faceButton = (
    name: MeshName,
    position: [number, number, number],
    symbol: FaceSymbol,
    key: ButtonKey,
  ): React.ReactElement => (
    <mesh
      key={name}
      name={name}
      position={position}
      castShadow
      onPointerDown={pressButton(key)}
      {...pointerFx}
    >
      <cylinderGeometry args={[0.07, 0.075, 0.05, 32]} />
      <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.4} metalness={0.05} />
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.065, 32]} />
        <meshStandardMaterial map={textures.symbols[symbol]} roughness={0.2} metalness={0.1} />
      </mesh>
    </mesh>
  )

  // Peças do D-Pad
  const dpadPiece = (
    name: MeshName,
    size: [number, number, number],
    position: [number, number, number],
    arrow: ArrowDirection,
    key: ButtonKey,
  ): React.ReactElement => (
    <RoundedBox
      key={name}
      name={name}
      args={size}
      radius={0.01}
      smoothness={4}
      position={position}
      castShadow
      onPointerDown={pressButton(key)}
      {...pointerFx}
    >
      <meshStandardMaterial color={DPAD_COLOR} roughness={0.5} metalness={0.05} />
      <mesh position={[0, size[1] / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 0.06]} />
        <meshStandardMaterial map={textures.arrows[arrow]} roughness={0.35} metalness={0.05} />
      </mesh>
    </RoundedBox>
  )

  // Analógicos (L3 / R3)
  const stick = (
    name: MeshName,
    x: number,
    stickKey: 'left' | 'right',
  ): React.ReactElement => (
    <>
      {/* Rebaixo escuro ao redor da base (dá profundidade ao deck) */}
      <mesh position={[x, 0.002, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.185, 48]} />
        <meshStandardMaterial color={SHELL_DARK} roughness={0.9} metalness={0} />
      </mesh>
      {/* Base fixa ancorada: mergulha fundo no plástico do chassi */}
      <mesh position={[x, -0.04, 0.12]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.15, 48]} />
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Grupo móvel do analógico (rotação apenas, pivô na base local) */}
      <group
        name={name}
        position={[x, 0.02, 0.12]}
        onPointerDown={beginStickDrag(stickKey, stickKey === 'left' ? 'l3' : 'r3')}
        {...pointerFx}
      >
        {/* Haste cónica de encaixe */}
        <mesh position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.08, 24]} />
          <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.5} metalness={0.05} />
        </mesh>
        {/* Topo do analógico (chapéu de borracha) */}
        <mesh position={[0, 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.1, 0.03, 48]} />
          <meshStandardMaterial color={STICK_RUBBER} roughness={0.85} metalness={0} />
        </mesh>
        {/* Aro superior da borracha */}
        <mesh position={[0, 0.105, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.095, 0.014, 12, 48]} />
          <meshStandardMaterial color={STICK_RUBBER} roughness={0.85} metalness={0} />
        </mesh>
        {/* Concavidade do topo (miolo mais escuro, estilo DualShock) */}
        <mesh position={[0, 0.1056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.082, 40]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.95} metalness={0} />
        </mesh>
      </group>
    </>
  )

  // Material compartilhado do casco: plástico brilhante com verniz
  const shell = (
    <meshPhysicalMaterial
      color={BODY_COLOR}
      roughness={0.38}
      metalness={0.05}
      clearcoat={0.6}
      clearcoatRoughness={0.3}
    />
  )

  return (
    <group ref={rootRef} rotation={[-0.45, 0, 0]} position={[0, 0, 0]}>
      {/* ========================================== */}
      {/* 1. CHASSI — contorno único extrudado (deck + grips fluindo      */}
      {/* juntos). Topo do deck em y = 0.                                 */}
      {/* ========================================== */}
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        {shell}
      </mesh>

      {/* ========================================== */}
      {/* 2. VOLUME DOS GRIPS — elipsoides que engordam a parte de baixo  */}
      {/* e arredondam a ponta; ficam dentro do contorno, sem emendas.    */}
      {/* ========================================== */}
      <mesh position={[-0.67, -0.28, 0.52]} rotation={[0.12, 0, 0]} scale={[0.25, 0.21, 0.52]} castShadow>
        <sphereGeometry args={[1, 40, 28]} />
        {shell}
      </mesh>
      <mesh position={[0.67, -0.28, 0.52]} rotation={[0.12, 0, 0]} scale={[0.25, 0.21, 0.52]} castShadow>
        <sphereGeometry args={[1, 40, 28]} />
        {shell}
      </mesh>

      {/* ========================================== */}
      {/* 3. TOUCHPAD — moldura fixa + superfície que afunda ao pressionar */}
      {/* ========================================== */}
      <RoundedBox
        args={[0.62, 0.008, 0.26]}
        radius={0.02}
        smoothness={4}
        position={[0, -0.002, -0.2]}
      >
        <meshStandardMaterial color={SHELL_DARK} roughness={0.8} metalness={0} />
      </RoundedBox>
      <RoundedBox
        name="Touchpad"
        args={[0.56, 0.015, 0.2]}
        radius={0.015}
        smoothness={5}
        position={[0, 0.004, -0.2]}
        castShadow
        onPointerDown={pressButton('touchpad')}
        {...pointerFx}
      >
        <meshStandardMaterial color="#2a2b32" roughness={0.45} metalness={0.1} />
      </RoundedBox>

      {/* ========================================== */}
      {/* 4. LIGHTBAR — faixa rente à borda traseira do deck, como no     */}
      {/* controle real (não flutua mais)                                 */}
      {/* ========================================== */}
      <RoundedBox
        name="Lightbar"
        args={[0.56, 0.014, 0.03]}
        radius={0.006}
        smoothness={4}
        position={[0, 0.003, -0.345]}
      >
        <meshStandardMaterial
          color={ledColor}
          emissive={ledColor}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </RoundedBox>
      <pointLight position={[0, 0.2, -0.5]} intensity={1.8} distance={2.6} color={ledColor} />

      {/* ========================================== */}
      {/* 5. BOTÕES DE AÇÃO — losango (△ topo, ◯ externo, ✕ base, ▢ interno) */}
      {/* ========================================== */}
      {faceButton('Button_Triangle', [0.72, 0.025, -0.2], 'triangle', 'triangle')}
      {faceButton('Button_Circle', [0.86, 0.025, -0.1], 'circle', 'circle')}
      {faceButton('Button_Cross', [0.72, 0.025, 0.0], 'cross', 'cross')}
      {faceButton('Button_Square', [0.58, 0.025, -0.1], 'square', 'square')}

      {/* ========================================== */}
      {/* 6. D-PAD — losango espelhado com rebaixo                        */}
      {/* ========================================== */}
      <RoundedBox
        args={[0.26, 0.012, 0.26]}
        radius={0.006}
        smoothness={4}
        position={[-0.72, -0.007, -0.1]}
      >
        <meshStandardMaterial color={SHELL_DARK} roughness={0.8} metalness={0} />
      </RoundedBox>
      {dpadPiece('DPad_Up', [0.07, 0.02, 0.1], [-0.72, 0.01, -0.2], 'up', 'dpadUp')}
      {dpadPiece('DPad_Down', [0.07, 0.02, 0.1], [-0.72, 0.01, 0.0], 'down', 'dpadDown')}
      {dpadPiece('DPad_Left', [0.1, 0.02, 0.07], [-0.61, 0.01, -0.1], 'left', 'dpadLeft')}
      {dpadPiece('DPad_Right', [0.1, 0.02, 0.07], [-0.83, 0.01, -0.1], 'right', 'dpadRight')}

      {/* ========================================== */}
      {/* 7. ANALÓGICOS (L3/R3) — centro inferior                         */}
      {/* ========================================== */}
      {stick('Stick_Left', -0.38, 'left')}
      {stick('Stick_Right', 0.38, 'right')}

      {/* ========================================== */}
      {/* 8. OMBROS (L1/R1) E GATILHOS (L2/R2)                            */}
      {/* L1/R1 encaixados na quina traseira do chassi (metade dentro,    */}
      {/* metade para fora) em vez de flutuando atrás.                    */}
      {/* ========================================== */}
      <RoundedBox
        name="Button_L1"
        args={[0.42, 0.1, 0.16]}
        radius={0.04}
        smoothness={6}
        position={[-0.56, -0.03, -0.41]}
        rotation={[-0.12, 0, 0]}
        castShadow
        onPointerDown={pressButton('l1')}
        {...pointerFx}
      >
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.45} metalness={0.05} />
      </RoundedBox>
      <RoundedBox
        name="Button_R1"
        args={[0.42, 0.1, 0.16]}
        radius={0.04}
        smoothness={6}
        position={[0.56, -0.03, -0.41]}
        rotation={[-0.12, 0, 0]}
        castShadow
        onPointerDown={pressButton('r1')}
        {...pointerFx}
      >
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.45} metalness={0.05} />
      </RoundedBox>

      {/* Gatilhos: encostados/embutidos na parede traseira do chassi (sem vão), pivô no topo */}
      <group name="Trigger_L2" position={[-0.56, -0.02, -0.45]}>
        <RoundedBox
          args={[0.36, 0.2, 0.14]}
          radius={0.04}
          smoothness={6}
          position={[0, -0.09, 0.01]}
          rotation={[0.15, 0, 0]}
          castShadow
          onPointerDown={beginTriggerDrag('l2')}
          {...pointerFx}
        >
          <meshStandardMaterial color="#1a1b1f" roughness={0.5} metalness={0.05} />
        </RoundedBox>
      </group>
      <group name="Trigger_R2" position={[0.56, -0.02, -0.45]}>
        <RoundedBox
          args={[0.36, 0.2, 0.14]}
          radius={0.04}
          smoothness={6}
          position={[0, -0.09, 0.01]}
          rotation={[0.15, 0, 0]}
          castShadow
          onPointerDown={beginTriggerDrag('r2')}
          {...pointerFx}
        >
          <meshStandardMaterial color="#1a1b1f" roughness={0.5} metalness={0.05} />
        </RoundedBox>
      </group>

      {/* ========================================== */}
      {/* 9. BOTÕES AUXILIARES (Share, Options, PS)                       */}
      {/* ========================================== */}
      <RoundedBox
        name="Button_Share"
        args={[0.1, 0.03, 0.06]}
        radius={0.012}
        smoothness={4}
        position={[-0.36, 0.005, -0.27]}
        rotation={[0, 0.25, 0]}
        castShadow
        onPointerDown={pressButton('share')}
        {...pointerFx}
      >
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.5} metalness={0.05} />
      </RoundedBox>
      <RoundedBox
        name="Button_Options"
        args={[0.1, 0.03, 0.06]}
        radius={0.012}
        smoothness={4}
        position={[0.36, 0.005, -0.27]}
        rotation={[0, -0.25, 0]}
        castShadow
        onPointerDown={pressButton('options')}
        {...pointerFx}
      >
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.5} metalness={0.05} />
      </RoundedBox>

      {/* Botão PS com anel de base */}
      <mesh position={[0, 0.001, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.045, 0.065, 40]} />
        <meshStandardMaterial color={SHELL_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <mesh
        name="Button_PS"
        position={[0, 0.005, 0.02]}
        castShadow
        onPointerDown={pressButton('ps')}
        {...pointerFx}
      >
        <cylinderGeometry args={[0.045, 0.045, 0.03, 40]} />
        <meshStandardMaterial color={PLASTIC_COLOR} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  )
}
