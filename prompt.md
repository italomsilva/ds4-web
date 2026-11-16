Crie uma aplicação web 3D interativa do controle PlayStation DualShock 4 utilizando React 18+, TypeScript, React Three Fiber (@react-three/fiber), @react-three/drei e Tailwind CSS.

### 1. Arquitetura da Aplicação & Tech Stack
- Framework: React + TypeScript (Strict Mode)
- 3D Engine: @react-three/fiber (R3F) e @react-three/drei
- Estilização UI: Tailwind CSS
- Gerenciamento de Estado: React Context ou Zustand (se necessário) + Custom Hook para Gamepad API

### 2. Estrutura de Componentes & Tipagem (TypeScript)
Organize o código de forma modular e tipada:
- types/gamepad.ts: Interfaces para estados dos botões, vetores dos analógicos ({ x: number, y: number }), gatilhos analógicos e tipagem das malhas do modelo GLTF.
- hooks/useGamepad.ts: Custom hook para escutar eventos gamepadconnected / gamepaddisconnected e executar a leitura continuada do estado dos botões via navigator.getGamepads().
- components/3d/DualShockModel.tsx: Componente responsável por carregar a malha 3D e aplicar as transformações imperativas no useFrame.
- components/3d/Scene.tsx: Configuração do componente <Canvas>, câmera, sombras, iluminação e <OrbitControls>.
- components/ui/Overlay.tsx: Interface de controle (Status do controle, Color Picker do LED e Telemetria de Inputs).

### 3. Modelo 3D (.glb / .gltf) & Tipagem de Nós
Utilize o carregador useGLTF do @react-three/drei tipando a estrutura retornada:
- As sub-malhas (Mesh) do modelo devem ser acessadas via o objeto `nodes` com nomes padronizados:
  - Ação: Button_Cross, Button_Circle, Button_Square, Button_Triangle
  - D-Pad: DPad_Up, DPad_Down, DPad_Left, DPad_Right
  - Ombro e Gatilhos: Button_L1, Button_R1, Trigger_L2, Trigger_R2
  - Analógicos: Stick_Left, Stick_Right (e cliques Button_L3, Button_R3)
  - Extras: Button_Share, Button_Options, Button_PS, Touchpad, Lightbar

### 4. Animação e Interatividade 3D (R3F `useFrame`)
Utilize o hook `useFrame` para atualizar imperativamente as transformações das malhas (refs) usando THREE.MathUtils.lerp, evitando re-renders desnecessários na árvore do React:
- Botões: Recuo suave no eixo Z/Y local ao ser pressionado.
- Analógicos: Rotação nos eixos X e Y limitada a ~20°-25° calculada a partir dos eixos do gamepad [-1.0, 1.0].
- Gatilhos (L2/R2): Rotação progressiva proporcional à pressão do gatilho (0 a 100%).
- Interação via Mouse/Touch: Se nenhum controle físico estiver conectado, permitir clicar/arrastar as malhas diretamente no 3D utilizando os eventos de ponteiro do R3F (onPointerDown, onPointerUp, onPointerMove).

### 5. Configuração de Materiais, Iluminação e Lightbar (LED)
- Barra de LED (Lightbar):
  - Aplicar um MeshStandardMaterial com propriedades emissive e emissiveIntensity={1.5}.
  - Sincronizar a cor emissiva a um estado do React (ledColor: string) ajustável pela UI.
- Iluminação da Cena:
  - Posicionar um <pointLight> próximo à Lightbar com a mesma cor do estado ledColor.
  - Usar <Environment preset="city" /> do Drei para reflexos realistas nos plásticos e borrachas do controle, combinado com luzes direcionais com castShadow ativo.

### 6. Interface de Usuário (UI Overlay)
Interface limpa sobreposta ao 3D usando Tailwind CSS:
- Status de Conexão: Badge indicando "Gamepad Conectado: [Nome]" ou "Modo Interativo (Mouse/Touch)".
- Color Picker: Input de seleção de cor para alterar o LED da Lightbar em tempo real.
- Telemetria de Inputs: Exibição visual dos valores numéricos dos eixos dos analógicos e barras de progresso para a pressão dos gatilhos L2/R2.