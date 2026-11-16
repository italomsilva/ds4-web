import { memo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { ModelRoot } from './ModelRoot'

/**
 * Configuração do <Canvas>: câmera, sombras, iluminação e OrbitControls.
 * Memoizado para que o snapshot de telemetria (60fps) nunca re-renderize a cena.
 */
export const Scene = memo(function Scene(): React.ReactElement {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 2.6, 4.2], fov: 40 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0b0d12']} />

      {/* Iluminação: ambiente + direcionais com sombras */}
      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={[4, 6, 4]}
        intensity={1.6}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 3, -4]} intensity={0.5} />
      <directionalLight position={[0, 2, 5]} intensity={0.35} />

      {/* Modelo do controle: tenta o .GLB real com fallback procedural.
          O Error Boundary + Suspense ficam dentro do ModelRoot. */}
      <ModelRoot />

      {/* Environment "city" para reflexos realistas nos plásticos e borrachas.
          Em Suspense próprio para não bloquear o modelo caso falhe o download. */}
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      {/* Sombra de contato no "chão" */}
      <ContactShadows
        position={[0, -0.75, 0]}
        opacity={0.55}
        scale={12}
        blur={2.4}
        far={3}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
      />
    </Canvas>
  )
})
