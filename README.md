# DS4 Web — DualShock 4 Interativo 3D

Aplicação web 3D interativa do controle **PlayStation DualShock 4**, construída conforme as
orientações de `prompt.md`.

## Tech Stack

- **React 18 + TypeScript** (Strict Mode)
- **@react-three/fiber** + **@react-three/drei** (Three.js)
- **Tailwind CSS v4** (via plugin Vite)
- **Zustand** para o estado de UI + refs transitórias para o input a 60fps
- **Gamepad API** (`navigator.getGamepads()`)

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. Conecte um DualShock 4 (USB ou Bluetooth) e **pressione qualquer
botão** — o navegador só expõe o gamepad após a primeira interação (política da Gamepad API).

## Funcionalidades

| Recurso | Descrição |
| --- | --- |
| Detecção de gamepad | Badge mostra "Gamepad Conectado: [Nome]" ou "Modo Interativo (Mouse/Touch)" |
| Animação 3D | Botões com recuo suave, analógicos rotacionando até ~23°, L2/R2 com rotação proporcional à pressão — tudo via `useFrame` + `THREE.MathUtils.lerp`, sem re-render da árvore React |
| Modo Mouse/Touch | Sem controle físico, é possível clicar/arrastar os elementos diretamente no 3D (botões, sticks e gatilhos) |
| Lightbar LED | Material emissivo (`emissiveIntensity={1.5}`) + `pointLight` sincronizados com o Color Picker da UI |
| Iluminação | `<Environment preset="city" />` (reflexos PBR) + luzes direcionais com `castShadow` |
| Telemetria | Valores numéricos dos eixos dos analógicos, visualização 2D, barras de progresso de L2/R2 e chips dos botões pressionados |

## Estrutura

```
src/
├── types/gamepad.ts            # Tipagem de botões, vetores, gatilhos e nós do modelo
├── hooks/useGamepad.ts         # Gamepad API: eventos + leitura continuada (refs fora do React)
├── store.ts                    # Zustand: snapshot p/ UI + ledColor
├── components/
│   ├── 3d/DualShockModel.tsx   # Malha nomeada + transformações imperativas no useFrame
│   ├── 3d/Scene.tsx            # <Canvas>, câmera, sombras, luzes e OrbitControls
│   └── ui/Overlay.tsx          # Status, Color Picker e Telemetria de Inputs
├── App.tsx
└── main.tsx
```

## Nós do modelo (nomes padronizados)

A aplicação tenta carregar o **modelo real** em `public/models/dualshock4_layers.glb` (via `useGLTF`)
e, em caso de falha (arquivo ausente, corrompido ou parse inválido), um **Error Boundary**
captura o erro e o **Modelo Procedural** assume automaticamente — o sistema nunca quebra.
O seletor manual "Real (.GLB) ↔ Procedural (Reserva)" no topo esquerdo do overlay permite
alternar entre os dois a qualquer momento.

O carregador inspeciona os nós no console (`[DS4 GLB] nodes:`) e mapeia as malhas em 4 níveis:

0. **`userData` (extras embutidos no .glb)** — cada nó carrega `{ role, button, stick }`
   (`press`, `stick`, `trigger`, `led`, `static`); peças marcadas `static` (casco, bases dos
   analógicos, portas, parafusos) ficam fixas por declaração;
1. **Nomes padronizados exatos** — `Button_Cross`, `Button_Circle`, `Button_Square`,
   `Button_Triangle`, `DPad_Up/Down/Left/Right`, `Button_L1`, `Button_R1`, `Trigger_L2`,
   `Trigger_R2`, `Stick_Left`, `Stick_Right`, `Button_L3`, `Button_R3`, `Button_Share`,
   `Button_Options`, `Button_PS`, `Touchpad`, `Lightbar`;
2. **Padrões de nome individuais** de GLBs de terceiros (ex.: `cross_01`, `l2`, `left_stick`);
3. **Grupos mesclados** (ex.: `Joysticks`, `Triggers`, `Buttons` — comum em exportações do
   Sketchfab): o grupo é animado de forma combinada, com aviso no console.

A animação (`useFrame` + `THREE.MathUtils.lerp`) e a interação por ponteiro são
**compartilhadas** entre os dois modelos (`components/3d/animation.ts` e
`components/3d/usePointerInput.ts`) — a diferença é apenas a coleta das partes.

> Nota: o `dualshock4_layers.glb` incluído tem **26 peças separadas** — uma por botão,
> analógicos divididos em base fixa (`Stick_*_Base`) e capa móvel, pivô próprio por peça
> e `extras` de função (`role`/`button`/`stick`) em cada nó. O modelo procedural é mantido
> como reserva caso o arquivo falhe.

## Notas

- **Fallback**: `GLBErrorBoundary` + status na store garantem que qualquer falha no `.glb`
  alterne automaticamente para o modelo procedural, sem travar a aplicação. Forçar "Real"
  no seletor após uma falha dispara uma nova tentativa (remonta o boundary).
- A rotação dos sticks ocorre em torno do pivô na base; os gatilhos giram em torno da dobradiça
  superior, ambos limitados conforme a spec (sticks ~20°–25°, gatilhos proporcionais a 0–100%).
