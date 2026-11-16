# Seminário — DS4 Web: Controle DualShock 4 Interativo em 3D na Web

> **Roteiro completo de apresentação** do projeto `ds4-web`.
> Aplicação web 3D interativa que exibe um controle PlayStation **DualShock 4**, anima cada
> peça em tempo real a partir de um controle físico (Gamepad API) ou de Mouse/Touch,
> com telemetria de inputs e Lightbar LED colorida.

---

## Sumário

1. [Abertura — O que é o projeto](#1-abertura--o-que-é-o-projeto)
2. [Objetivos e requisitos](#2-objetivos-e-requisitos)
3. [Tech Stack e Bibliotecas importadas](#3-tech-stack-e-bibliotecas-importadas)
4. [Arquitetura e fluxo de dados](#4-arquitetura-e-fluxo-de-dados)
5. [Estrutura de pastas e arquivos](#5-estrutura-de-pastas-e-arquivos)
6. [Camada de tipos — `types/gamepad.ts`](#6-camada-de-tipos--typesgamepadts)
7. [Gamepad API — `hooks/useGamepad.ts`](#7-gamepad-api--hooksusegamepadts)
8. [Estado — `store.ts` (Zustand)](#8-estado--storets-zustand)
9. [Cena 3D — `Scene.tsx`](#9-cena-3d--scenetxsx)
10. [Estratégia de dupla modelo — `ModelRoot.tsx` + Error Boundary](#10-estratégia-de-dupla-modelo--modelroottsx--error-boundary)
11. [Modelo Procedural — `DualShockModel.tsx`](#11-modelo-procedural--dualshockmodeltsx)
12. [Modelo Real — `GltfModel.tsx` + `mapGltfNodes.ts`](#12-modelo-real--gltfmodeltsx--mapgltfnodests)
13. [Motor de animação — `animation.ts`](#13-motor-de-animação--animationts)
14. [Interação Mouse/Touch — `usePointerInput.ts`](#14-interação-mousetouch--usepointerinputts)
15. [Texturas geradas por código — `buttonTextures.ts`](#15-texturas-geradas-por-código--buttontexturests)
16. [Interface — `Overlay.tsx` (Tailwind CSS)](#16-interface--overlaytsx-tailwind-css)
17. [Decisões técnicas de destaque (para "vender" no seminário)](#17-decisões-técnicas-de-destaque-para-vender-no-seminário)
18. [Como rodar e roteiro de demo ao vivo](#18-como-rodar-e-roteiro-de-demo-ao-vivo)
19. [Conclusão e melhorias futuras](#19-conclusão-e-melhorias-futuras)
20. [Apêndice — Perguntas prováveis da banca e respostas](#20-apêndice--perguntas-prováveis-da-banca-e-respostas)

---

## 1. Abertura — O que é o projeto

**DS4 Web** é uma aplicação **100% front-end** que renderiza um controle **DualShock 4 em 3D**
no navegador e o torna **vivo**:

- Conecte um controle físico (USB ou Bluetooth) → **cada botão, analógico e gatilho que você
  toca no controle real se anima no modelo 3D em tempo real**.
- Não tem controle em mãos? → **clique e arraste diretamente nas peças do modelo 3D**
  (botões afundam, analógicos inclinam, gatilhos correm), com telemetria completa na tela.
- A **Lightbar** (barra de LED frontal do DS4) muda de cor em tempo real via Color Picker,
  com material emissivo + luz pontual sincronizadas.

```
┌──────────────────────────────────────────────────────────┐
│  Controle físico ──► Gamepad API ──► Refs (60fps)        │
│                                            │             │
│                          useFrame lê ──────┴──► Animação │
│                                            │             │
│                          Snapshot ──► Zustand ──► UI     │
└──────────────────────────────────────────────────────────┘
```

**Frase de abertura sugerida:**
> "Este projeto transforma o navegador em uma bancada de teste de gamepad: um controle
> DualShock 4 em 3D, construído com WebGL, que responde em tempo real tanto a um controle
> físico quanto ao mouse — sem nenhum backend, tudo rodando no cliente."

---

## 2. Objetivos e requisitos

O projeto segue uma especificação formal (documentada em `prompt.md`), que define:

| # | Requisito | Como foi atendido |
|---|-----------|-------------------|
| 1 | React 18+ + TypeScript **Strict Mode** | `main.tsx` com `<StrictMode>`; `tsconfig.json` com `strict: true`, `noUnusedLocals`, `noFallthroughCasesInSwitch` |
| 2 | 3D com `@react-three/fiber` + `@react-three/drei` | `<Canvas>` em `Scene.tsx`; helpers drei (`RoundedBox`, `Environment`, `OrbitControls`, `ContactShadows`, `useGLTF`) |
| 3 | Estilização com **Tailwind CSS** | Tailwind v4 via plugin oficial do Vite, classes utilitárias em todo o `Overlay.tsx` |
| 4 | Tipagem completa dos inputs | `types/gamepad.ts` — `ButtonKey` (união literal de 18 botões), `Vec2`, `AnalogTriggers`, `GamepadState` |
| 5 | Custom Hook para Gamepad API | `hooks/useGamepad.ts` — eventos `gamepadconnected`/`gamepaddisconnected` + loop `requestAnimationFrame` |
| 6 | Nós do modelo com nomes padronizados | `MeshName` — 21 nomes (`Button_Cross`, `DPad_Up`, `Trigger_L2`, `Stick_Left`, `Lightbar`…) |
| 7 | Animação **imperativa** no `useFrame` com `THREE.MathUtils.lerp` | `animation.ts` — zero re-render da árvore React durante a animação |
| 8 | Fallback interativo Mouse/Touch | `usePointerInput.ts` — eventos de ponteiro do R3F (`onPointerDown/Move/Up`) |
| 9 | Lightbar com `emissiveIntensity` + `pointLight` sincronizados ao estado | `ledColor` na store; material emissivo (`emissiveIntensity={2.0}`, `toneMapped={false}`) |
| 10 | `Environment preset="city"` + luzes direcionais com `castShadow` | `Scene.tsx` — reflexos PBR + sombras 1024×1024 |
| 11 | UI com badge de status, Color Picker e Telemetria | `Overlay.tsx` — os três blocos, sobrepostos ao 3D |

---

## 3. Tech Stack e Bibliotecas importadas

### 3.1 Dependências de produção (`package.json` → `dependencies`)

| Biblioteca | Versão | O que é | Onde/por que é usada no projeto |
|---|---|---|---|
| **react** | ^18.3.1 | Biblioteca de UI declarativa baseada em componentes e hooks | Base de toda a árvore de componentes; hooks `useEffect`, `useMemo`, `useRef` |
| **react-dom** | ^18.3.1 | Renderizador do React para o DOM | `createRoot` em `main.tsx`, montando `<App />` no `#root` dentro do `<StrictMode>` |
| **three** | ^0.170.0 | Engine 3D (WebGL) — geometrias, materiais, math | `ExtrudeGeometry`/`Shape` (chassi do controle), `MathUtils.lerp/clamp` (animação), `Box3`/`Vector3` (normalização do GLB), `CanvasTexture`/`SRGBColorSpace` (texturas), `MeshStandardMaterial` (LED do GLB), tipos `Group`/`Mesh`/`Object3D` |
| **@react-three/fiber** | ^8.17.10 | **R3F** — renderizador React para o Three.js: transforma a cena declarativa em JSX | `<Canvas>` em `Scene.tsx`; `<mesh>`, `<group>`, geometrias e materiais como componentes; hook `useFrame` (loop de animação por frame); hook `useThree` (acesso aos `controls` do OrbitControls); tipo `ThreeEvent` (eventos de ponteiro com raycast) |
| **@react-three/drei** | ^9.121.4 | Cofre de helpers prontos para o R3F (ecossistema oficial) | `useGLTF` (carrega o `.glb` com cache), `OrbitControls` (orbitar/zoom), `Environment preset="city"` (iluminação HDR + reflexos PBR), `ContactShadows` (sombra de contato no "chão"), `RoundedBox` (caixas com cantos arredondados — botões, D-Pad, touchpad, gatilhos) |
| **zustand** | ^5.0.2 | Gerenciador de estado minimalista (sem Provider, baseado em hooks) | `store.ts` — estado da UI (conexão, telemetria, `ledColor`, preferência de modelo); `useStore((s) => …)` para assinaturas seletivas; `useStore.setState()` e `useStore.getState()` escritos **fora** do React (no loop do gamepad) |

### 3.2 Dependências de desenvolvimento (`devDependencies`)

| Pacote | Versão | Papel |
|---|---|---|
| **typescript** | ~5.6.3 | Compilador/checador de tipos (`npm run build` roda `tsc && vite build`); `strict: true` |
| **vite** | ^6.0.7 | Bundler/dev server (HMR instantâneo, build otimizado, `npm run dev/preview`) |
| **@vitejs/plugin-react** | ^4.3.4 | Plugin oficial React para o Vite (Fast Refresh, JSX transform automático) |
| **tailwindcss** | ^4.0.6 | Framework CSS utilitário (v4 — configuração zero, CSS-first) |
| **@tailwindcss/vite** | ^4.0.6 | Plugin do Tailwind v4 integrado ao Vite (registrado em `vite.config.ts`) |
| **@types/react** / **@types/react-dom** | ^18.3.x | Tipagem do React para o TypeScript |
| **@types/three** | ^0.170.0 | Tipagem do Three.js (essencial para o strict mode com `three`) |

### 3.3 Importações indiretas importantes (do código)

| Import | Vem de | Uso |
|---|---|---|
| `SkeletonUtils` | **three-stdlib** (dependência transitiva do drei, importada diretamente em `GltfModel.tsx`) | `SkeletonUtils.clone(gltf.scene)` — clona a cena do GLB para que as animações imperativas não corrompam o recurso **compartilhado em cache** entre remounts |
| `vite/client` | Vite | Tipos de assets no `tsconfig.json` (`types: ["vite/client"]`) |

### 3.4 APIs nativas do navegador (sem biblioteca)

- **Gamepad API**: `navigator.getGamepads()`, eventos `gamepadconnected` / `gamepaddisconnected`,
  `Gamepad.buttons[i].pressed/value`, `Gamepad.axes[0..3]` — lida diretamente em `useGamepad.ts`.
- **Pointer Events**: `pointerdown`, `pointermove`, `pointerup`, `pointercancel` no `window`
  para o modo Mouse/Touch.
- **Canvas 2D**: `document.createElement('canvas')` para gerar as texturas dos símbolos
  (△ ◯ ✕ ▢ e setas do D-Pad) em `buttonTextures.ts`.

### 3.5 Asset externo

- `public/models/dualshock4.glb` — modelo 3D binário glTF do DualShock 4
  (fonte Sketchfab, licença **CC-BY**), carregado pelo `useGLTF` do drei.

---

## 4. Arquitetura e fluxo de dados

### 4.1 O princípio central: **"estado cru fora do React"**

Esta é a decisão de arquitetura mais importante do projeto e vale destaque no seminário:

- O input do gamepad muda **60 vezes por segundo**. Se cada mudança fosse estado React,
  a árvore inteira (incluindo a cena 3D) re-renderizaria 60×/s → travaria.
- **Solução**: o estado cru vive em **refs exportadas do módulo** (`gamepadRef`, `virtualRef`),
  **fora do React**. O `useFrame` do Three.js lê essas refs **imperativamente** e muta
  `position`/`rotation` dos objetos 3D diretamente — o React não sabe (e não precisa saber).
- Para a **UI** (que só precisa de precisão visual, não física), o loop publica a cada frame
  um **snapshot arredondado** (`.toFixed(2)`) na **store Zustand** — só o `Overlay` re-renderiza,
  e apenas quando os valores arredondados mudam.

### 4.2 Diagrama de fluxo completo

```mermaid
flowchart TD
    subgraph FÍSICO
        GP[Controle DS4<br/>USB / Bluetooth] -->|Gamepad API| LOOP
    end

    subgraph HOOK["hooks/useGamepad.ts"]
        LOOP["requestAnimationFrame tick()<br/>leitura continuada 60fps"] --> GR["gamepadRef<br/>(estado cru)"]
        LOOP --> VR["virtualRef<br/>(estado do Mouse/Touch)"]
    end

    PT["usePointerInput.ts<br/>cliques/arrastos no 3D"] -->|setVirtualButton/Stick/Trigger| VR

    LOOP -->|"activeInput():<br/>físico se conectado,<br/>senão virtual"| ANIM

    subgraph CENA["Cena 3D (R3F)"]
        ANIM["animation.ts<br/>useFrame + MathUtils.lerp"] -->|mutação imperativa de<br/>position / rotation| MESH["Meshes do modelo<br/>(GLB real ou procedural)"]
    end

    LOOP -->|snapshot toFixed(2)| STORE
    PTRFX["onPointerDown handlers"] --> STORE2["connection / glbStatus<br/>ledColor / preferredModel"]

    subgraph UI["UI React (Zustand)"]
        STORE["store.ts<br/>telemetria + pressed[]"] --> OV["Overlay.tsx<br/>badge, chips, pads, barras"]
        STORE2["store.ts<br/>ledColor / preferredModel"] --> OV
        STORE2 --> MR["ModelRoot.tsx<br/>escolhe GLB × procedural"]
    end
```

### 4.3 Seleção da fonte de input

```ts
// hooks/useGamepad.ts
export function activeInput(): GamepadState {
  return useStore.getState().connection.connected ? gamepadRef.current : virtualRef.current
}
```

Uma única função decide a fonte: **controle físico tem prioridade**; sem controle, o
Mouse/Touch assume. O `useFrame` chama `activeInput()` a cada frame — o mesmo pipeline de
animação serve aos dois modos sem nenhum `if` na animação.

---

## 5. Estrutura de pastas e arquivos

```
ds4-web/
├── index.html                      # Entry HTML (pt-BR) — monta /src/main.tsx
├── vite.config.ts                  # plugins: react() + tailwindcss()
├── tsconfig.json                   # Strict Mode completo (target ES2022)
├── package.json                    # scripts dev / build (tsc && vite build) / preview
├── prompt.md                       # Spec original que orientou o desenvolvimento
├── README.md                       # Documentação do projeto
├── apresentacao.md                 # Este roteiro de seminário
├── public/
│   └── models/
│       └── dualshock4.glb          # Modelo real (Sketchfab, CC-BY) — carregado pelo useGLTF
└── src/
    ├── main.tsx                    # createRoot + <StrictMode>
    ├── App.tsx                     # Composição: useGamepad() + <Scene/> + <Overlay/>
    ├── index.css                   # Base do Tailwind v4
    ├── store.ts                    # Zustand: snapshot p/ UI + ledColor + status do GLB
    ├── types/
    │   └── gamepad.ts              # Tipos: ButtonKey, Vec2, GamepadState, MeshName + standard map
    ├── hooks/
    │   └── useGamepad.ts           # Gamepad API + refs globais + loop rAF
    └── components/
        ├── 3d/
        │   ├── Scene.tsx           # <Canvas>, câmera, luzes, Environment, OrbitControls
        │   ├── ModelRoot.tsx       # Orquestrador: GLB real ↔ procedural + Error Boundary
        │   ├── GltfModel.tsx       # Modelo real: useGLTF, normalização, LED, ponteiro
        │   ├── mapGltfNodes.ts     # Mapeamento dos nós do GLB em 3 passes (regex)
        │   ├── DualShockModel.tsx  # Modelo procedural: chassi extrudado + primitivas
        │   ├── animation.ts        # Motor de animação useFrame (compartilhado)
        │   ├── usePointerInput.ts  # Interação Mouse/Touch (compartilhada)
        │   ├── buttonTextures.ts   # Texturas Canvas 2D dos símbolos/setas
        │   └── GLBErrorBoundary.tsx# Error Boundary (class component) do .glb
        └── ui/
            └── Overlay.tsx         # Badge de status, ModelSwitcher, LED picker, telemetria
```

---

## 6. Camada de tipos — `types/gamepad.ts`

Contrato tipado de **todo** o sistema de input. Arquivo pequeno, mas é a fundação.

### 6.1 Tipos de input

- **`Vec2 { x: number; y: number }`** — vetor 2D normalizado. Analógicos variam em
  `[-1.0, +1.0]` nos dois eixos.
- **`AnalogTriggers { l2: number; r2: number }`** — gatilhos **analógicos**: `0.0` (solto)
  a `1.0` (totalmente pressionado). Diferente dos botões digitais, têm valor contínuo.
- **`ButtonKey`** — união literal com os **18 botões lógicos** do DS4:
  `cross | circle | square | triangle | dpadUp | dpadDown | dpadLeft | dpadRight | l1 | r1 |
  l2 | r2 | l3 | r3 | share | options | ps | touchpad`.
  TypeScript passa a recusar qualquer nome de botão inválido em todo o código.
- **`GamepadState`** — o estado completo lido a cada frame:
  `buttons: Record<ButtonKey, boolean>` + `leftStick/rightStick: Vec2` + `triggers`.
- **`GamepadConnection { connected: boolean; id: string | null }`** — status da conexão física.

### 6.2 Tipagem dos nós do modelo 3D

- **`MeshName`** — união literal com os **21 nomes padronizados** das sub-malhas:
  - Ação: `Button_Cross`, `Button_Circle`, `Button_Square`, `Button_Triangle`
  - D-Pad: `DPad_Up`, `DPad_Down`, `DPad_Left`, `DPad_Right`
  - Ombros/gatilhos: `Button_L1`, `Button_R1`, `Trigger_L2`, `Trigger_R2`
  - Analógicos: `Stick_Left`, `Stick_Right`, `Button_L3`, `Button_R3`
  - Extras: `Button_Share`, `Button_Options`, `Button_PS`, `Touchpad`, `Lightbar`
- **`DualShockNodes`** — `Partial<Record<MeshName, Mesh | Group>>`: mapa tipado do que o
  `useGLTF` retorna (ou o modelo procedural coleta). `Partial` porque um GLB real pode
  não ter todos os nós.
- **`isMeshName(name): name is MeshName`** — *type guard* que valida nomes contra um
  `Set` pré-computado (O(1)), usado no traverse do modelo para filtrar só peças conhecidas.

### 6.3 Standard Mapping da Gamepad API

```ts
export const STANDARD_BUTTON_MAP: Record<number, ButtonKey> = {
  0: 'cross', 1: 'circle', 2: 'square', 3: 'triangle',   // face
  4: 'l1', 5: 'r1', 6: 'l2', 7: 'r2',                    // ombros/gatilhos
  8: 'share', 9: 'options', 10: 'l3', 11: 'r3',          // centrais
  12: 'dpadUp', 13: 'dpadDown', 14: 'dpadLeft', 15: 'dpadRight',
  16: 'ps', 17: 'touchpad',
}
```

O W3C define o **"standard mapping"**: índice 0 é sempre o botão "inferior da face"
(no DS4, ✕), eixo 0/1 é o analógico esquerdo, eixo 2/3 o direito, etc.
A tradução índice → nome lógico acontece **uma única vez**, aqui.

- **`createInitialGamepadState()`** — fábrica do estado "tudo solto", reaproveitada na
  inicialização e no reset ao desconectar o controle.

---

## 7. Gamepad API — `hooks/useGamepad.ts`

O coração da captura de input. Três responsabilidades: **eventos de conexão**,
**leitura continuada** e **estado virtual do Mouse/Touch**.

### 7.1 Refs fora do React

```ts
export const gamepadRef  = { current: createInitialGamepadState() } // controle físico
export const virtualRef  = { current: createInitialGamepadState() } // Mouse/Touch
```

Objetos simples `{ current: … }` (mesma "shape" de um `useRef`), exportados no nível do
módulo. O `useFrame` da cena 3D os lê diretamente — **sem passar pelo ciclo de
renderização do React**.

### 7.2 Eventos de conexão

```ts
window.addEventListener('gamepadconnected',    onConnect)
window.addEventListener('gamepaddisconnected', onDisconnect)
```

- `onConnect` → grava `{ connected: true, id: e.gamepad.id }` na store (o badge vira verde).
- `onDisconnect` → atualiza a store **só se o id corresponde** ao que estava conectado e
  **reseta** `gamepadRef` para o estado inicial (evita botões "presos" na animação).

**Detalhe importante (edge case tratado):** um gamepad conectado **antes** da página carregar
**não dispara** o evento `gamepadconnected`. Por isso o próprio loop de leitura também
detecta conexões: se `navigator.getGamepads()` retorna um pad e a store diz "desconectado",
a conexão é registrada ali mesmo.

### 7.3 Loop de leitura continuada

```ts
let raf = 0
const tick = (): void => {
  const pads = navigator.getGamepads?.() ?? []
  const gp   = Array.from(pads).find((p) => p !== null)
  if (gp) readPhysicalGamepad(gp)
  // ...publica snapshot na store...
  raf = requestAnimationFrame(tick)   // agenda o próximo frame
}
raf = requestAnimationFrame(tick)
```

- `requestAnimationFrame` (rAF) sincroniza a leitura com o **refresh do monitor** (~60fps).
- O `return` do `useEffect` cancela tudo (`cancelAnimationFrame` + remove listeners) —
  sem memory leak no unmount (e no duplo-mount do StrictMode em dev).

### 7.4 `readPhysicalGamepad` e a deadzone

- Botões: `gp.buttons[i].pressed` → mapeado por `STANDARD_BUTTON_MAP`.
- Analógicos: `gp.axes[0..3]` passam pela função **deadzone**:

```ts
function deadzone(v: number, dz = 0.06): number {
  return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz)
}
```

  **Por que?** Analógicos reais têm desgaste: mesmo parados, reportam ±0.05 de "ruído"
  (drift). A deadzone zera tudo abaixo de 6% e **renormaliza** o restante para o intervalo
  completo `[-1, 1]` — sem degrau perceptível, o stick continua chegando a 100% nos extremos.
- Gatilhos: `gp.buttons[6].value` e `gp.buttons[7].value` — a Gamepad API expõe L2/R2 como
  botões **analógicos**, com `value` contínuo de 0 a 1.

### 7.5 Publicação do snapshot para a UI

Ao fim de cada `tick`, a store recebe:

- `leftStick`/`rightStick`/`triggers` com `Number(x.toFixed(2))` (2 casas decimais —
  reduz re-renders inúteis da UI);
- `pressed: ButtonKey[]` — array só com os botões **pressionados** agora
  (o Overlay renderiza os "chips" a partir dele).

### 7.6 API virtual (Mouse/Touch)

`setVirtualButton`, `setVirtualStick`, `setVirtualTrigger` escrevem em `virtualRef` com
**cópia imutável** (`cloneVirtual()` cria um novo objeto a cada escrita) — garantindo que a
referência mude, o que simplifica o raciocínio sobre quem lê quando.

---

## 8. Estado — `store.ts` (Zustand)

```ts
export const useStore = create<UiState>((set) => ({ ... }))
```

### 8.1 Por que Zustand (e não Context/Redux)?

- **Sem Provider** — um `create()` e pronto; funciona inclusive **fora** de componentes
  (`useStore.getState()` / `useStore.setState()` chamados dentro do loop rAF do hook e da
  função `activeInput()`).
- **Assinaturas seletivas** — `useStore((s) => s.ledColor)` re-renderiza o componente **só**
  quando aquele slice muda. A telemetria 60fps não re-renderiza o Color Picker.
- ~1 kB, zero boilerplate — adequado ao tamanho do estado da UI.

### 8.2 O que mora na store (e o que NÃO mora)

| Campo | Tipo | Descrição |
|---|---|---|
| `connection` | `GamepadConnection` | Conectado? Qual `id`? (badge de status) |
| `leftStick`, `rightStick` | `Vec2` | Snapshot arredondado p/ os pads 2D da telemetria |
| `triggers` | `AnalogTriggers` | Snapshot p/ as barras L2/R2 |
| `pressed` | `ButtonKey[]` | Botões pressionados agora (chips) |
| `ledColor` | `string` | Cor hex da Lightbar (default `#0b6cff`) |
| `preferredModel` | `'real' \| 'procedural'` | Seletor manual do modelo 3D |
| `glbStatus` | `'checking' \| 'available' \| 'failed'` | Resultado do carregamento do `.glb` |
| `glbAttempt` | `number` | Incrementado a cada nova tentativa manual — **reseta** o Error Boundary |
| `setLedColor`, `setPreferredModel`, `setGlbStatus` | — | Actions |

**NÃO mora na store**: o input cru de 60fps (fica nas refs do `useGamepad`) — a store carrega
apenas o *snapshot* formatado que a UI consome.

### 8.3 Lógica embutida de transição

`setPreferredModel('real')` quando `glbStatus === 'failed'` também incrementa `glbAttempt`
e devolve o status para `'checking'`. Como `glbAttempt` é usado como **`key`** do
`GLBErrorBoundary`, mudar esse valor **remonta o boundary** e dispara uma nova tentativa de
carregar o `.glb` — o usuário pode "tentar de novo" sem recarregar a página.

### 8.4 Presets do LED

```ts
export const DEFAULT_LED_COLOR = '#0b6cff'
export const LED_PRESETS = ['#0b6cff', '#ff0040', '#00e676', '#ffd600', '#a855f7', '#ffffff']
```

Seis swatches (azul, vermelho, verde, amarelo, roxo, branco) + input `<input type="color">`
+ botão *reset*.

---

## 9. Cena 3D — `Scene.tsx`

Componente **memoizado** (`memo`) — garantia de que o snapshot de telemetria (60fps na store)
**nunca** re-renderiza a cena.

### 9.1 O `<Canvas>`

```tsx
<Canvas
  shadows                     // habilita shadow maps
  dpr={[1, 2]}                // device pixel ratio entre 1× e 2× (nitidez × performance)
  camera={{ position: [0, 2.6, 4.2], fov: 40 }}
  gl={{ antialias: true }}    // anti-aliasing MSAA do WebGL
>
```

- `dpr={[1, 2]}`: em telas retina renderiza em até 2× a resolução CSS, com teto — evita
  processar 4× pixels em monitores 4K.
- `fov: 40` + câmera elevada: enquadra o controle como numa mesa de produto.

### 9.2 Iluminação (4 fontes)

| Luz | Configuração | Papel |
|---|---|---|
| `ambientLight` | `intensity 0.35` | Base uniforme — nada fica 100% preto |
| `directionalLight` principal | `position [4,6,4]`, `intensity 1.6`, **`castShadow`**, `shadow-mapSize 1024×1024`, `shadow-bias -0.0004` | Luz-chave com sombras; o *bias* elimina *shadow acne* nas superfícies curvas |
| `directionalLight` traseira | `[-4,3,-4]`, `0.5` | Luz de recorte (contorno) |
| `directionalLight` frontal | `[0,2,5]`, `0.35` | Preenchimento frontal suave |
| `pointLight` da Lightbar | cor = `ledColor`, dentro do modelo | Brilho colorido refletido no ambiente, sincronizado ao LED |
| `<Environment preset="city" />` | do drei | **HDR de ambiente** — reflexos realistas nos plásticos e borrachas (PBR). Isolado em `<Suspense fallback={null}>` próprio: se o download falhar, não bloqueia o modelo |

### 9.3 Sombras e controles

- `<ContactShadows position={[0,-0.75,0]} opacity={0.55} scale={12} blur={2.4} far={3} />` —
  sombra de contato suave no "chão", ancora o objeto visualmente.
- `<OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={9}
  maxPolarAngle={Math.PI / 2.05} enableDamping />`:
  - `makeDefault` → registra os controls no estado do R3F, permitindo que o
    `usePointerInput` desative a órbita **durante** um arrasto de analógico/gatilho;
  - `maxPolarAngle ≈ 90°` impede a câmera de ir para baixo do "chão";
  - `enableDamping` dá inércia suave ao giro;
  - zoom limitado entre 2 e 9 unidades.

---

## 10. Estratégia de dupla modelo — `ModelRoot.tsx` + Error Boundary

O projeto carrega **duas versões do controle**, com degradação elegante:

```
preferredModel === 'real' && glbStatus !== 'failed'?
├── SIM → <GLBErrorBoundary> → <Suspense> → <GltfDualShockModel/>   (useGLTF)
└── NÃO → <DualShockModel/>                                          (procedural)
```

### 10.1 `GLBErrorBoundary.tsx` — Class Component

Error Boundaries só existem como **class components** (API de classe do React):

- `static getDerivedStateFromError()` — captura o erro e troca o render por `null`;
- `componentDidCatch(error, info)` — loga no console (`[DS4 GLB] Falha…`) e chama
  `onError(error)` → a store marca `glbStatus: 'failed'` → o `ModelRoot` renderiza o
  procedural no próximo render;
- `resetKey` (o `glbAttempt` da store): quando muda e havia erro, `componentDidUpdate`
  limpa `hasError` — **nova tentativa manual** de carregar o GLB;
- Motivação real: o `.glb` pode estar ausente (404), corrompido ou falhar no parse.
  **O sistema nunca quebra** — qualquer falha cai no fallback.

### 10.2 Por que manter o procedural se existe o `.glb`?

O `.glb` incluído (exportação do Sketchfab) tem parte das peças **mescladas** num único mesh
— o que limita a animação por peça. O modelo procedural, construído por primitivas, tem
**cada peça como objeto separado** com nomes 100% padronizados. O seletor
"Real (.GLB) ↔ Procedural (Reserva)" no overlay deixa alternar a qualquer momento, com
indicador de status (bolinha verde "GLB carregado" / vermelha "GLB indisponível — reserva
ativa" / âmbar pulsante "carregando…").

---

## 11. Modelo Procedural — `DualShockModel.tsx`

O fallback de alta fidelidade: **o controle inteiro construído por código**, sem nenhum
asset externo — apenas geometrias primitivas do Three.js compostas em JSX.

### 11.1 O chassi: uma `ExtrudeGeometry` com espelho

A peça mais interessante tecnicamente. Em vez de "caixa + duas alças coladas":

1. Define-se **só a metade direita** do contorno do controle (deck + grip) como uma
   sequência de **curvas Bézier cúbicas** (`shape.bezierCurveTo`) — 6 segmentos, do
   ombro traseiro até a borda frontal, passando pela ponta arredondada do grip;
2. A metade esquerda é gerada por código com a função `mirror` (`[-x, y]`), percorrendo os
   segmentos de trás pra frente — **silhueta perfeitamente simétrica sem duplicar dados**;
3. `new ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness/Size: 0.08,
   bevelSegments: 10, curveSegments: 40 })` — extrusão com **chanfro (bevel) grande**, que
   arredonda as bordas como o plástico real;
4. `geo.rotateX(-π/2)` + `translate` reposicionam o topo do deck em `y = 0`.

Os dois "grips" ganham volume com **elipsoides** (`sphereGeometry` escalada
`[0.25, 0.21, 0.52]`) metade enterradas no chassi — sem emendas visíveis.

### 11.2 Inventário de peças (todas com `name` padronizado)

| Peça | Geometria | Detalhe |
|---|---|---|
| Botões de ação (△◯✕▢) | `cylinderGeometry` + disco superior | Disposição em **losango** real do DS4; símbolos via texturas canvas (`meshStandardMaterial map`); `onPointerDown` |
| D-Pad | 4× `RoundedBox` sobre um rebaixo escuro | Setas "chevron" gravadas por textura |
| Analógicos L/R | haste cônica + "chapéu" de borracha + `torusGeometry` (aro) + concavidade | Grupo **móvel** com pivô na base (`group name="Stick_Left"`); anel de rebaixo no deck; `onPointerDown` |
| L1 / R1 | `RoundedBox` 0.42×0.1×0.16 | Encaixados **na quina** do chassi (metade dentro/fora) |
| L2 / R2 | `RoundedBox` dentro de um `<group name="Trigger_L2">` | O **grupo** é a peça animada — pivô no topo (dobradiça); `onPointerDown` |
| Touchpad | `RoundedBox` 0.56×0.015×0.2 sobre moldura fixa | Superfície clica e afunda |
| Share / Options | `RoundedBox` pequenos inclinados (`rotation-y ±0.25`) | Seguem o ângulo do gabinete |
| Botão PS | `cylinderGeometry` + `ringGeometry` de base | Centro inferior |
| Lightbar | `RoundedBox` 0.56×0.014×0.03 rente à borda traseira | Material **emissivo** sincronizado ao `ledColor` |

### 11.3 Materiais

- **Casco**: `meshPhysicalMaterial` com **`clearcoat = 0.6`** (verniz) e
  `clearcoatRoughness 0.3` — plástico brilhante de eletrônico.
- **Peças internas**: `meshStandardMaterial` com `roughness 0.4–0.95` e `metalness ~0.05`
  (borracha dos sticks: `roughness 0.85`, quase sem metal).
- **Lightbar**: `emissive = ledColor`, `emissiveIntensity = 2.0`, **`toneMapped = false`**
  (pula o tone mapping — cor "esticada" que parece realmente acesa).

### 11.4 Coleta das peças para animação

No `useEffect` de mount, um `rootRef.current.traverse(...)` varre a árvore e, para cada
objeto cujo nome passa no `isMeshName`, classifica a peça consultando as tabelas estáticas
`PRESS_PARTS` (14 peças de pressão), `STICK_PARTS` (2 sticks) e `TRIGGER_PARTS` (2 gatilhos) —
gerando os `PartSpec[]` (seção 13) com a posição/rotação **base** capturada na hora
(`baseY`, `baseRotX`).

### 11.5 Texturas e limpeza

- `createButtonTextures()` (memoizado com `useMemo`) — seção 15;
- `buildBodyGeometry()` (memoizado) e **`bodyGeometry.dispose()`** no unmount — geometria
  de GPU é liberada explicitamente (boa prática de memória WebGL).

---

## 12. Modelo Real — `GltfModel.tsx` + `mapGltfNodes.ts`

### 12.1 Carregamento e clone defensivo

```tsx
const gltf = useGLTF(GLB_URL) as unknown as GltfResult           // cache do drei
const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
```

- `useGLTF('/models/dualshock4.glb')` carrega e **cacheia** o glTF binário;
- O clone com `SkeletonUtils` é essencial: o cache do drei **compartilha a mesma instância
  de cena** entre montagens. Sem o clone, as rotações/posições imperativas da animação
  "vazariam" para a próxima montagem (botões tortos ao remontar).

### 12.2 Normalização de escala (`Box3`)

Modelos da web vêm com **escalas arbitrárias** (o arquivo incluso tem ~30 unidades). Um
`Box3.setFromObject` mede a bounding box, e o grupo `fitRef` recebe:

```ts
const scale = FIT_SIZE / maxDim            // FIT_SIZE = 3.4 (largura compatível c/ o procedural)
fit.scale.setScalar(scale)
fit.position.set(-center.x*scale, -center.y*scale, -center.z*scale)  // centraliza
```

Resultado: qualquer GLB entra no enquadramento correto, do tamanho do procedural.

### 12.3 O mapeamento em 3 passes — `mapGltfNodes.ts`

GLBs de terceiros têm **nomes imprevisíveis**. O mapeador roda um `root.traverse` com três
estratégias em ordem de prioridade:

**Passo 1 — Nome padronizado exato.** `isMeshName(name)` bate com `Button_Cross` etc.

**Passo 2 — Padrões individuais (regex).** 21 regras cobrem convenções comuns:
`/cross/i`, `/_x_/i`, `/l2/i`, `/\blt_/i`, `/left_?stick/i`, `/dpad_?_?up/i`, `/playstation_?logo/i`,
`/light_?bar/i`… Primeiro match não atribuído vence.

**Passo 3 — Grupos mesclados.** Se as peças não existem separadas (Sketchfab mescla tudo),
grupos como `Joysticks`, `Triggers`, `Buttons` são detectados e animados **combinadamente**:

| Grupo mesclado | Spec gerada | Estratégia |
|---|---|---|
| `Joysticks` / `Analog` | `stickMerged` | inclina pela **média** dos dois sticks |
| `Triggers` / `Shoulders` | `triggerMerged` | usa o gatilho de **maior** pressão |
| `Buttons` / `Face Buttons` | `pressAny` | recuo combinado (com `depthScale: 0.5`) quando **qualquer** botão de ação está pressionado |

Saídas do mapeamento (`GltfMapping`):
- `specs: PartSpec[]` — alimenta o mesmo motor de animação do procedural;
- `roles: Map<uuid, NodeRole>` — usado pelos cliques (por `uuid`, pois nomes podem se repetir);
- `matchedNames` / `unmatchedNames` / `mergedNotes` — diagnóstico honesto no console:
  o que casou (`"Button_Cross ← "cross_01""`), o que **não** casou (fica estático) e quais
  grupos foram animados combinados;
- `lightbar` — referência do nó para o LED.

### 12.4 Resolução **dinâmica** do clique — `resolveActionFromName`

No `onPointerDown` do grupo raiz, o nó atingido pelo raycast (`event.object`) é resolvido
**duas vezes**:

1. **Dinâmica**: `resolveActionFromName(event.object.name)` — regex aplicada ao nome real
   da malha clicada **no momento do clique** (zero referências estáticas);
2. **Fallback**: sobe a hierarquia (`obj = obj.parent`) consultando o `roles` por `uuid`.

Se nada casa → `return` sem `stopPropagation` → **o clique cai no OrbitControls** (girar a
cena a partir do casco). Se casa → `event.stopPropagation()` e despacha a ação
(`pressButton`, `beginStickDrag`, `beginTriggerDrag` ou variantes *merged*).

### 12.5 LED no GLB

A Lightbar do GLB não tem material emissivo por padrão — o `useEffect` de `ledColor`
percorre os meshes do nó `lightbar` e, para cada `MeshStandardMaterial`:

```ts
material.color.set(ledColor)
material.emissive.set(ledColor)
material.emissiveIntensity = 2.0
material.toneMapped = false
```

Mais um `pointLight` colorido na cena — mesmo comportamento do procedural. Se o GLB nem
tiver nó de Lightbar, o `pointLight` ainda funciona (nota do código: "mesmo sem nó dedicado").

---

## 13. Motor de animação — `animation.ts`

**Um único pipeline** anima os dois modelos. Só a *coleta* das peças difere; a animação é
compartilhada via `useDualShockAnimation(specsRef)`.

### 13.1 Constantes da spec

| Constante | Valor | Significado |
|---|---|---|
| `PRESS_DEPTH` | `0.022` | Recuo máximo do botão no eixo Y local |
| `MAX_STICK_TILT` | `0.4 rad ≈ 23°` | Inclinação máxima dos analógicos — dentro da faixa **20°–25°** da spec, impede o stick de sair da cavidade |
| `MAX_TRIGGER_ROT` | `0.4 rad` | Rotação máxima de L2/R2, **proporcional** à pressão (0–100%) |

### 13.2 O pulo do gato: `PartSpec` (união discriminada)

```ts
export type PartSpec =
  | { kind: 'press';         obj; baseY;    button }           // botão digital
  | { kind: 'pressAny';      obj; baseY;    buttons[]; depthScale } // cluster mesclado
  | { kind: 'stick';         obj;           stick: 'leftStick' | 'rightStick' }
  | { kind: 'stickMerged';   obj }                             // grupo mesclado
  | { kind: 'trigger';       obj; baseRotX; trigger: 'l2'|'r2' }
  | { kind: 'triggerMerged'; obj; baseRotX }
```

Cada peça coletada vira um `spec` com o `obj` (o `Object3D` real do Three.js) e os dados
necessários. O `switch (spec.kind)` do loop é exaustivo — o compilador garante que todo
`kind` é tratado (`noFallthroughCasesInSwitch` + união discriminada).

### 13.3 `useFrame` com lerp **independente do framerate**

```ts
useFrame((_, rawDelta) => {
  const delta = Math.min(rawDelta, 0.1)        // trava após tab inativa (evita salto)
  const alpha = 1 - Math.exp(-delta * 14)      // suavização exponencial
  const input = activeInput()                  // físico OU virtual
  for (const spec of specsRef.current) { ... }
})
```

- **`1 - Math.exp(-delta * 14)`**: um lerp com fator constante (`lerp(a, b, 0.2)`) chega
  mais rápido em 144Hz que em 60Hz — a velocidade da animação dependeria do monitor. A
  forma exponencial baseada em `delta` produz **a mesma curva em qualquer taxa de quadros**.
- **Sem `setState`**: `spec.obj.position.y = lerp(...)` e `spec.obj.rotation.x = lerp(...)`
  mutam o objeto do Three.js **direto** — a árvore React não re-renderiza nada.
- Movimentos por tipo:
  - `press` → `position.y = baseY − PRESS_DEPTH` quando pressionado, `baseY` quando solto;
  - `stick` → `rotation.x` (de `value.y`) e `rotation.z` (de `-value.x`), ambos com
    `MathUtils.clamp(±1)` × `MAX_STICK_TILT`. **Só rotação** — a posição nunca muda, o pivô
    fica na base do stick;
  - `trigger` → `rotation.x = baseRotX − pressão × MAX_TRIGGER_ROT` (gira na dobradiça
    superior);
  - variantes `*Merged` → estratégias combinadas da tabela da seção 12.3.

---

## 14. Interação Mouse/Touch — `usePointerInput.ts`

Fallback completo: **sem controle físico, tudo é clicável/arrastável no 3D**. Compartilhado
pelos dois modelos.

### 14.1 Controle de órbita

```ts
const controls = useThree((s) => s.controls)   // OrbitControls (via makeDefault)
const setControlsEnabled = (enabled) => { if (controls) controls.enabled = enabled }
```

Ao **pressionar** uma peça: `controls.enabled = false` (a câmera não gira enquanto você
arrasta o stick). Ao **soltar**: volta a `true`.

### 14.2 As quatro interações

| Ação | Comportamento |
|---|---|
| `pressButton(key)` | `pointerdown` na peça → `setVirtualButton(key, true)`; listeners no **`window`** por `pointerup`/`pointercancel` → solta o botão. Funciona mesmo com o cursor saindo da peça |
| `beginStickDrag(stick, clickKey)` | Guarda o ponto inicial; a cada `pointermove`, `Vec2 = clamp(Δ/60px, −1, 1)` → `setVirtualStick`. **Também pressiona L3/R3** ao clicar. Ao soltar, retorna `{0,0}` |
| `beginTriggerDrag(side)` | Clique = **100% de pressão imediata** (feedback imediato na telemetria); arrastar para cima refina: `clamp(Δy/60px, 0, 1)` — pressão analógica de verdade |
| `beginMergedStickDrag` / `beginMergedTriggerDrag` | Variantes para grupos mesclados do GLB: um arrasto controla os **dois** lados simultaneamente |

**Detalhes de robustez:**
- `event.stopPropagation()` em todas as interações — o clique não "sobe" para grupos pais
  nem chega ao OrbitControls;
- Listeners de movimento/soltura vão no `window` (não na malha) — o arrasto continua mesmo
  com o cursor fora do objeto;
- `pointercancel` tratado (touch pode ser interrompido pelo sistema);
- Conversão de pixels → valores normalizados: **60 px = 100%** de curso.

### 14.3 Feedback de cursor

`pointerFx = { onPointerOver, onPointerOut }` — troca `document.body.style.cursor` para
`'pointer'` ao passar sobre peças interativas. Memoizado (`useMemo([])`) para não recriar
handlers e invalidar o memo das meshes a cada render.

---

## 15. Texturas geradas por código — `buttonTextures.ts`

Nenhuma imagem PNG no projeto: **os símbolos △ ◯ ✕ ▢ e as setas do D-Pad são desenhados
com Canvas 2D em runtime** e viram `THREE.CanvasTexture`.

- `makeCanvasTexture(draw, background)` — cria canvas 128×128, pinta o fundo com a **cor do
  plástico da peça** (evita transparência/alpha sorting), desenha o glifo e devolve a
  textura com `colorSpace = SRGBColorSpace` e `anisotropy = 8` (nitidez em ângulo raso).
- Cores oficiais dos símbolos (traço, estilo DS4):
  △ verde `#2eec71` · ◯ vermelho `#ff5555` · ✕ azul `#55aaff` · ▢ rosa `#ff77cc`.
- Setas do D-Pad: "chevron" na cor `#474853` (levemente mais clara que o plástico) girado
  por direção (`ARROW_ROTATION`: up 0, right π/2, down π, left −π/2).
- `createButtonTextures()` devolve `{ symbols: Record<FaceSymbol,…>, arrows:
  Record<ArrowDirection,…> }` — 8 texturas criadas uma única vez (`useMemo`).

**Vantagem discutível no seminário:** zero requests de rede, resolução nítida, cores
centralizadas em constantes, e o bundle não carrega imagens.

---

## 16. Interface — `Overlay.tsx` (Tailwind CSS)

Overlay `absolute inset-0` com `pointer-events-none` no container e
`pointer-events-auto` nos painéis — **o mouse atravessa o overlay e alcança o 3D**, exceto
nos controles reais da UI. Tudo em **Tailwind v4** (glassmorphism: `bg-white/5`,
`backdrop-blur-md`, `border-white/10`).

### 16.1 Badge de status de conexão

- Conectado: bolinha verde com **animação `animate-ping`** (pulso radial) +
  "Gamepad Conectado" + o `id` do dispositivo (truncado com `truncate`);
- Desconectado: bolinha âmbar + "Modo Interativo — Mouse/Touch — clique e arraste no 3D".

### 16.2 `ModelSwitcher`

Painel com status do GLB (verde/vermelho/âmbar-pulsante + texto), botões
**"Real (.GLB)"** / **"Procedural (Reserva)"** (com anel `ring-sky-400` no ativo) e o
caminho do arquivo em fonte mono.

### 16.3 Color Picker da Lightbar

- 6 swatches (`LED_PRESETS`) com `boxShadow: 0 0 8px ${color}` (brilho) e anel branco no
  ativo;
- `<input type="color">` sobreposto com `opacity-0` a um swatch customizável (o input
  nativo invisível, o visual é nosso);
- Botão **reset** para `DEFAULT_LED_COLOR`.

### 16.4 Telemetria de Inputs (rodapé)

- **`StickPad`** — mini-pad 2D circular (cruzeta em `bg-white/10`); o ponto
  (`bg-sky-400` com glow) se move por `left/top` calculados de `value.x/value.y`
  (invertido no Y, como manda a coordenada de tela); valores X/Y em fonte mono com 2 casas;
- **`TriggerBar`** — barra de progresso L2/R2 com gradiente `from-sky-500 to-cyan-300`,
  largura `%` e leitura em `%` (mono, `text-sky-300`);
- **Chips de botões** — `pressed.map(...)` com rótulos amigáveis (`BUTTON_LABELS`:
  '✕ Cross', 'D-Pad ↑', 'L1'…) em `rounded-md bg-sky-500/20 ring-sky-400/30`.

---

## 17. Decisões técnicas de destaque (para "vender" no seminário)

1. **Estado de 60fps fora do React** — refs de módulo lidas imperativamente pelo `useFrame`;
   zero re-render da cena durante a animação. A store Zustand recebe só um snapshot
   arredondado para a UI.
2. **Lerp com correção de framerate** — `alpha = 1 − e^(−Δt·14)`: curva idêntica em 30,
   60 ou 144 Hz.
3. **Pipeline de animação único para dois modelos** — `PartSpec[]` como contrato: o GLB real
   e o procedural compartilham `animation.ts` e `usePointerInput.ts` integralmente.
4. **Mapeamento defensivo do GLB em 3 passes** (nomes exatos → regex → grupos mesclados) +
   resolução **dinâmica** do clique pelo nome da malha + relatório honesto no console
   (`matched` / `unmatched` / `merged`).
5. **Resiliência total** — Error Boundary dedicado + status na store + fallback procedural
   automático + retentativa manual via `key={glbAttempt}`. O `.glb` pode faltar, corromper
   ou falhar: **a aplicação nunca quebra**.
6. **Normalização de escala com `Box3`** — qualquer GLB (escala arbitrária) é centralizado e
   ajustado para a largura de referência (3.4 unidades).
7. **Deadzone renormalizada** (6%) — compensa drift de analógicos reais sem degrau perceptível.
8. **Modelo procedural por código** — chassi por extrusão de Bézier com espelho + bevel,
   20+ peças de primitivas, texturas de símbolos desenhadas em Canvas 2D: **zero dependência
   de asset externo para funcionar**.
9. **UX de ponteiro cuidadosa** — `stopPropagation` em tudo, OrbitControls desligado durante
   arrastos, listeners no `window` (arrasto contínuo), `pointercancel` tratado, cursor
   `pointer` sobre peças interativas.
10. **TypeScript estrito ponta a ponta** — uniões literais (`ButtonKey`, `MeshName`), type
    guard `isMeshName`, união discriminada `PartSpec` com switch exaustivo, standard map
    tipado. Nomes de botões/nós inválidos simplesmente não compilam.

---

## 18. Como rodar e roteiro de demo ao vivo

### 18.1 Instalação

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc (checa tipos) && vite build (produção)
npm run preview  # serve o build de produção
```

### 18.2 Roteiro de demo sugerido (~5 min)

1. **Abrir sem controle** → badge "Modo Interativo" (âmbar).
2. **Clicar no ✕** → botão afunda; **chip "✕ Cross"** acende na telemetria.
3. **Arrastar o stick esquerdo** → inclina até ~23°; o `StickPad` L-Stick acompanha;
   soltar → volta ao centro suavemente (lerp visível).
4. **Clicar e arrastar para cima no L2** → pressão 0→100%; barra L2 preenche; soltar = 0%.
5. **Arrastar o fundo da cena** → OrbitControls (prova de que a interação por peça não
   conflita com a órbita).
6. **Mudar o LED** para vermelho → Lightbar emissiva + `pointLight` mudam instantaneamente.
7. **Conectar o DS4** (USB/Bluetooth) e **pressionar qualquer botão** → badge verde com o
   nome do dispositivo (lembtrar: a Gamepad API só expõe o pad após a primeira interação).
8. **Mover sticks e apertar L2/R2** no controle físico → animação idêntica ao modo virtual.
9. **Console** (`F12`): mostrar `[DS4 GLB] nodes:` e `Partes mapeadas` — o diagnóstico do
   mapeamento.
10. **Seletor de modelo** → alternar Real ↔ Procedural ao vivo; comentar o Error Boundary.

---

## 19. Conclusão e melhorias futuras

### 19.1 O que o projeto demonstra

- Integração **React + Three.js** com o padrão declarativo do R3F **sem abrir mão da
  performance imperativa** quando o frame importa;
- Uso correto da **Gamepad API** (standard mapping, eventos, gatilhos analógicos, edge case
  de conexão prévia);
- Arquitetura de estado em **duas camadas** (refs de alta frequência × store reativa);
- **Resiliência** por design (fallbacks, boundaries, normalização, mapeamento defensivo);
- **TypeScript estrito** como ferramenta de modelagem, não apenas de anotação.

### 19.2 Extensões possíveis

- Suporte a múltiplos gamepads (o código já lê `getGamepads()` como array);
- Vibração via `gamepad.vibrationActuator` (Chrome);
- Botão de tela cheia / captura de canvas (`toDataURL`) para exportar a cena;
- Troca de preset de `Environment` (studio, sunset…) e modo "mostruário" com rotação automática;
- Testes unitários do mapeador (`mapGltfNodes`) com GLBs sintéticos;
- Perf: `frustumCulled` seletivo e `InstancedMesh` se o número de peças crescer.

---

## 20. Apêndice — Perguntas prováveis da banca e respostas

**P1 — Por que não usar `useState` para o input do gamepad?**
R: O input muda 60×/s; cada `setState` re-renderizaria a árvore (cena 3D incluída). Refs de
módulo são lidas imperativamente pelo `useFrame`; a UI reativa só vê um snapshot arredondado
via Zustand.

**P2 — O que é o `lerp` com `1 − e^(−Δt·k)` e por que não um fator fixo?**
R: Fator fixo torna a velocidade dependente do framerate (a 144Hz chega mais rápido que a
60Hz). A exponencial com o delta do frame produz a mesma constante de tempo (k=14) em
qualquer monitor. O `min(delta, 0.1)` evita o salto gigante ao voltar de aba inativa.

**P3 — Como o sistema lida com um GLB de qualquer fonte?**
R: Três passes de mapeamento (nomes exatos → regexes individuais → grupos mesclados),
normalização de escala por bounding box, relatório `matched/unmatched/merged` no console,
resolução de clique dinâmica pelo nome, e Error Boundary que cai no procedural em qualquer
falha.

**P4 — Por que o Error Boundary é uma classe?**
R: A API de Error Boundaries do React só existe em class components
(`getDerivedStateFromError` + `componentDidCatch`); hooks ainda não expõem esse ciclo.

**P5 — Por que `SkeletonUtils.clone` no GLB?**
R: O `useGLTF` cacheia a cena compartilhando a instância entre montagens. Sem clonar, as
transformações imperativas persistiriam entre remounts (controle "torto" após trocar de
modelo).

**P6 — O que é a deadzone e por que renormalizar?**
R: Analógicos reais reportam ruído perto de zero (drift). Abaixo de 6% zera; acima,
subtrai a deadzone e divide por `(1 − dz)`, reestirando o intervalo para `[-1, 1]` — sem
degrau e sem perder alcance nos extremos.

**P7 — Como os gatilhos analógicos funcionam na Gamepad API?**
R: L2/R2 são índices 6 e 7 do array `buttons` com `value` contínuo `0..1` (não apenas
`pressed`). A animação multiplica esse valor por `MAX_TRIGGER_ROT`.

**P8 — Por que Zustand e não Context?**
R: Context re-renderiza todos os consumidores a cada mudança de valor; a telemetria a 60fps
com Context re-renderizaria a UI toda. Zustand tem assinatura por seletor e funciona fora de
componentes (`getState/setState` no loop rAF).

**P9 — O modelo procedural não é "menos realista"?**
R: Ele é o **fallback de alta fidelidade de animação**: cada peça é um objeto separado com
nome padronizado, então anima por peça. O `.glb` incluso tem peças mescladas (limitação do
asset, documentada no README) — por isso os dois modos coexistem com seletor manual.

**P10 — Funciona no celular?**
R: Sim — o modo Mouse/Touch usa Pointer Events (touch incluído); o render usa `dpr` limitado
e sombras 1024² para caber no mobile. Controle físico via Bluetooth também pareia com o
navegador mobile em alguns casos (Chrome Android).
