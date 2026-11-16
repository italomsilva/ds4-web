import { Scene } from './components/3d/Scene'
import { Overlay } from './components/ui/Overlay'
import { useGamepad } from './hooks/useGamepad'

export default function App(): React.ReactElement {
  // Escuta conexão e mantém a leitura continuada do estado do gamepad
  useGamepad()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b0d12] text-white">
      <Scene />
      <Overlay />
    </div>
  )
}
