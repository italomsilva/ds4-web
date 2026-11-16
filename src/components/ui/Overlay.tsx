import { useStore, LED_PRESETS, DEFAULT_LED_COLOR } from '../../store'
import type { ButtonKey, Vec2 } from '../../types/gamepad'

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function StickPad({ label, value }: { label: string; value: Vec2 }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-11 w-11 shrink-0 rounded-full border border-white/15 bg-white/5">
        <div className="absolute inset-0 m-auto h-px w-full bg-white/10" />
        <div className="absolute inset-0 m-auto h-full w-px bg-white/10" />
        <div
          className="absolute h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"
          style={{
            left: `calc(${50 + value.x * 40}% - 5px)`,
            top: `calc(${50 - value.y * 40}% - 5px)`,
          }}
        />
      </div>
      <div className="font-mono text-[11px] leading-4 text-white/60">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
          {label}
        </div>
        X: {value.x.toFixed(2)}
        <br />
        Y: {value.y.toFixed(2)}
      </div>
    </div>
  )
}

function TriggerBar({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="w-32">
      <div className="mb-1 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span className="text-white/80">{label}</span>
        <span className="font-mono text-sky-300">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  )
}

const BUTTON_LABELS: Record<ButtonKey, string> = {
  cross: '✕ Cross',
  circle: '◯ Circle',
  square: '▢ Square',
  triangle: '△ Triangle',
  dpadUp: 'D-Pad ↑',
  dpadDown: 'D-Pad ↓',
  dpadLeft: 'D-Pad ←',
  dpadRight: 'D-Pad →',
  l1: 'L1',
  r1: 'R1',
  l2: 'L2',
  r2: 'R2',
  l3: 'L3',
  r3: 'R3',
  share: 'Share',
  options: 'Options',
  ps: 'PS',
  touchpad: 'Touchpad',
}

// ---------------------------------------------------------------------------
// Seletor manual de modelo 3D (Real .GLB ↔ Procedural de reserva)
// ---------------------------------------------------------------------------

function ModelSwitcher(): React.ReactElement {
  const preferredModel = useStore((s) => s.preferredModel)
  const glbStatus = useStore((s) => s.glbStatus)
  const setPreferredModel = useStore((s) => s.setPreferredModel)

  const btnClass = (active: boolean): string =>
    `rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
      active
        ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/40'
        : 'text-white/50 hover:bg-white/5 hover:text-white/90'
    }`

  const statusText =
    glbStatus === 'available'
      ? 'GLB carregado'
      : glbStatus === 'failed'
        ? 'GLB indisponível — reserva ativa'
        : 'carregando GLB…'
  const statusColor =
    glbStatus === 'available' ? 'bg-emerald-400' : glbStatus === 'failed' ? 'bg-red-400' : 'animate-pulse bg-amber-400'

  return (
    <div className="pointer-events-auto w-fit rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
          Modelo 3D
        </span>
        <span className="text-[9px] text-white/40">{statusText}</span>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => setPreferredModel('real')} className={btnClass(preferredModel === 'real')}>
          Real (.GLB)
        </button>
        <button
          type="button"
          onClick={() => setPreferredModel('procedural')}
          className={btnClass(preferredModel === 'procedural')}
        >
          Procedural (Reserva)
        </button>
      </div>
      <div className="mt-1.5 font-mono text-[9px] text-white/30">public/models/dualshock4.glb</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlay principal
// ---------------------------------------------------------------------------

export function Overlay(): React.ReactElement {
  const connection = useStore((s) => s.connection)
  const leftStick = useStore((s) => s.leftStick)
  const rightStick = useStore((s) => s.rightStick)
  const triggers = useStore((s) => s.triggers)
  const pressed = useStore((s) => s.pressed)
  const ledColor = useStore((s) => s.ledColor)
  const setLedColor = useStore((s) => s.setLedColor)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
      {/* ---------------- Linha superior: status + color picker -------------- */}
      <div className="flex items-start justify-between gap-4">
        {/* Coluna esquerda: badge de status + seletor de modelo */}
        <div className="flex flex-col items-start gap-2.5">
          {/* Badge de status de conexão */}
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
          {connection.connected ? (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-emerald-300">Gamepad Conectado</div>
                <div className="max-w-[220px] truncate text-[10px] text-white/50">
                  {connection.id}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <div>
                <div className="text-xs font-semibold text-amber-300">Modo Interativo</div>
                <div className="text-[10px] text-white/50">Mouse/Touch — clique e arraste no 3D</div>
              </div>
            </div>
          )}
          </div>

          {/* Seletor manual: Modelo Real (.GLB) ↔ Procedural (Reserva) */}
          <ModelSwitcher />
        </div>

        {/* Color Picker do LED (Lightbar) */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Lightbar LED
            </div>
            <div className="flex items-center gap-1.5 pt-1.5">
              {LED_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`LED ${color}`}
                  onClick={() => setLedColor(color)}
                  className={`h-4 w-4 rounded-full ring-2 transition-transform hover:scale-125 ${
                    ledColor === color ? 'ring-white/80' : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
              ))}
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-lg ring-2 ring-white/20">
            <span
              className="absolute inset-0"
              style={{ backgroundColor: ledColor, boxShadow: `0 0 10px ${ledColor}` }}
            />
            <input
              type="color"
              value={ledColor}
              onChange={(e) => setLedColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <button
            type="button"
            onClick={() => setLedColor(DEFAULT_LED_COLOR)}
            className="text-[10px] text-white/40 underline-offset-2 hover:text-white/80 hover:underline"
          >
            reset
          </button>
        </div>
      </div>

      {/* ---------------- Rodapé: telemetria de inputs ----------------------- */}
      <div className="pointer-events-auto w-fit rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-6">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Telemetria de Inputs
          </span>
          {/* Chips dos botões pressionados */}
          <div className="flex max-w-[280px] flex-wrap justify-end gap-1">
            {pressed.length === 0 ? (
              <span className="font-mono text-[10px] text-white/30">—</span>
            ) : (
              pressed.map((key) => (
                <span
                  key={key}
                  className="rounded-md bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-200 ring-1 ring-sky-400/30"
                >
                  {BUTTON_LABELS[key]}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex gap-5">
            <StickPad label="L-Stick" value={leftStick} />
            <StickPad label="R-Stick" value={rightStick} />
          </div>
          <div className="h-16 w-px bg-white/10" />
          <div className="flex flex-col gap-2.5">
            <TriggerBar label="L2" value={triggers.l2} />
            <TriggerBar label="R2" value={triggers.r2} />
          </div>
        </div>
      </div>
    </div>
  )
}
