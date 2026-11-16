import { Suspense } from 'react'
import { useStore } from '../../store'
import { DualShockModel } from './DualShockModel'
import { GLBErrorBoundary } from './GLBErrorBoundary'
import { GltfDualShockModel } from './GltfModel'

/**
 * Decide qual modelo renderizar:
 * - "real": tenta o .GLB de public/models/dualshock4.glb (via useGLTF)
 * - "procedural": modelo construído por primitivas (fallback garantido)
 *
 * Se o .GLB falhar (ausente/corrompido/parse inválido), o GLBErrorBoundary
 * captura o erro, marca o status na store e o fallback assume automaticamente.
 */
export function ModelRoot(): React.ReactElement {
  const preferredModel = useStore((s) => s.preferredModel)
  const glbStatus = useStore((s) => s.glbStatus)
  const glbAttempt = useStore((s) => s.glbAttempt)
  const setGlbStatus = useStore((s) => s.setGlbStatus)

  const tryReal = preferredModel === 'real' && glbStatus !== 'failed'

  if (!tryReal) return <DualShockModel />

  return (
    <GLBErrorBoundary
      key={glbAttempt}
      resetKey={glbAttempt}
      onError={() => setGlbStatus('failed')}
    >
      <Suspense fallback={null}>
        <GltfDualShockModel />
      </Suspense>
    </GLBErrorBoundary>
  )
}
