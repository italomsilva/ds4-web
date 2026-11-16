import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { SkeletonUtils } from 'three-stdlib'
import {
  Box3,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import { useStore } from '../../store'
import { useDualShockAnimation, type PartSpec } from './animation'
import { mapGltfNodes, resolveActionFromName, type NodeRole } from './mapGltfNodes'
import { usePointerInput } from './usePointerInput'

/** Caminho público do modelo real (coloque o arquivo em public/models/) */
export const GLB_URL = '/models/dualshock4.glb'

/**
 * Tamanho alvo (maior dimensão, em unidades de cena) após a normalização.
 * Compatível com o enquadramento do modelo procedural (~3.4 de largura).
 */
const FIT_SIZE = 3.4

interface GltfResult {
  scene: Group
  nodes: Record<string, Object3D | undefined>
  materials: Record<string, Material | Material[]>
}

// ---------------------------------------------------------------------------
// Modelo Real (.GLB)
// ---------------------------------------------------------------------------

export function GltfDualShockModel(): React.ReactElement {
  // useGLTF (drei) — resultado tipado com { scene, nodes, materials }
  const gltf = useGLTF(GLB_URL) as unknown as GltfResult

  // Clona a cena do cache para que as transformações imperativas não
  // corrompam o recurso compartilhado entre remounts.
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])

  const fitRef = useRef<Group>(null)
  const specsRef = useRef<PartSpec[]>([])
  const rolesRef = useRef<Map<string, NodeRole>>(new Map())
  const lightbarRef = useRef<Object3D | null>(null)
  const ledColor = useStore((s) => s.ledColor)
  const setGlbStatus = useStore((s) => s.setGlbStatus)
  const { pressButton, beginStickDrag, beginTriggerDrag, beginMergedStickDrag, beginMergedTriggerDrag } =
    usePointerInput()

  // --- Normalização: centraliza e escala o GLB para o tamanho da cena -------
  // Modelos reais podem vir com escala arbitrária (ex.: ~30 unidades no
  // Sketchfab); sem isso o controle gigante invade a câmera.
  useEffect(() => {
    const fit = fitRef.current
    if (!fit) return
    const box = new Box3().setFromObject(fit)
    if (box.isEmpty()) return
    const size = box.getSize(new Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scale = FIT_SIZE / maxDim
    const center = box.getCenter(new Vector3())
    fit.scale.setScalar(scale)
    fit.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
    console.log(
      '[DS4 GLB] Normalização:',
      { dimensaoOriginal: size, escala: Number(scale.toFixed(4)), centralizado: true },
    )
  }, [scene])

  // --- Inspeção e mapeamento dos nós reais (spec §1) -------------------------
  useEffect(() => {
    console.log('[DS4 GLB] URL:', GLB_URL)
    console.log('[DS4 GLB] nodes:', gltf.nodes) // inspecione a hierarquia aqui

    const mapping = mapGltfNodes(scene)
    specsRef.current = mapping.specs
    rolesRef.current = mapping.roles
    lightbarRef.current = mapping.lightbar ?? null

    console.log('[DS4 GLB] Partes mapeadas:', mapping.matchedNames)
    if (mapping.mergedNotes.length > 0) {
      console.info('[DS4 GLB] Grupos mesclados (animação combinada):', mapping.mergedNotes)
    }
    if (mapping.unmatchedNames.length > 0) {
      console.warn('[DS4 GLB] Partes da spec sem nó equivalente (ficam estáticas):', mapping.unmatchedNames)
    }

    setGlbStatus('available')
  }, [scene, gltf.nodes, setGlbStatus])

  useDualShockAnimation(specsRef)

  // --- Lightbar: sincroniza o material emissivo do GLB com o ledColor --------
  useEffect(() => {
    const bar = lightbarRef.current
    if (!bar) return
    bar.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          material.color.set(ledColor)
          material.emissive.set(ledColor)
          material.emissiveIntensity = 2.0
          material.toneMapped = false
        }
      }
    })
  }, [ledColor, scene])

  // --- Interação por ponteiro: resolve o "role" a partir do nó atingido -----
  const findRole = (object: Object3D | null): NodeRole | null => {
    let obj: Object3D | null = object
    while (obj) {
      const role = rolesRef.current.get(obj.uuid)
      if (role) return role
      obj = obj.parent
    }
    return null
  }

  const handlePointerOver = (event: ThreeEvent<PointerEvent>): void => {
    if (findRole(event.object)) document.body.style.cursor = 'pointer'
  }
  const handlePointerOut = (): void => {
    document.body.style.cursor = 'auto'
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    // 1) Resolução DINÂMICA: identifica a malha clicada pelo nome real dela
    //    (e.object.name — ex.: "Button_Triangle", "DPad_Up", "Trigger_L2"),
    //    sem referências estáticas a um botão específico.
    // 2) Fallback: role mapeado por uuid (grupos mesclados sem nome resolúvel).
    const role = resolveActionFromName(event.object.name) ?? findRole(event.object)
    if (!role) return // shell não-interativa: deixa o OrbitControls agir

    // Obrigatório: impede que o clique suba para grupos/meshes pais
    event.stopPropagation()

    switch (role.type) {
      case 'press':
        pressButton(role.button!)(event)
        break
      case 'pressAny':
        // Último recurso: cluster totalmente mesclado (nomes individuais
        // indisponíveis no GLB) — recuo/pressão combinados.
        pressButton(role.buttons![0]!)(event)
        break
      case 'stick':
        beginStickDrag(role.stick!, role.stick === 'left' ? 'l3' : 'r3')(event)
        break
      case 'stickMerged':
        beginMergedStickDrag(event)
        break
      case 'trigger':
        beginTriggerDrag(role.side!)(event)
        break
      case 'triggerMerged':
        beginMergedTriggerDrag(event)
        break
    }
  }

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <group rotation={[-0.35, 0, 0]} position={[0, 0.05, 0]}>
        <group ref={fitRef}>
          <primitive object={scene} />
        </group>
      </group>
      {/* pointLight da Lightbar (mesma cor do LED, mesmo sem nó dedicado) */}
      <pointLight position={[0, 0.7, 1.1]} intensity={2.4} distance={4} color={ledColor} />
    </group>
  )
}
