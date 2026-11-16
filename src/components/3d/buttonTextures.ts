import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * Gerador de texturas Canvas 2D (`THREE.CanvasTexture`) para os símbolos dos
 * botões de ação e as setas gravadas do D-Pad do modelo procedural.
 */

export type FaceSymbol = 'cross' | 'circle' | 'square' | 'triangle'
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

const SIZE = 128

/** Cores dos glifos conforme a spec */
export const SYMBOL_COLORS: Record<FaceSymbol, string> = {
  triangle: '#2eec71',
  circle: '#ff5555',
  cross: '#55aaff',
  square: '#ff77cc',
}

/** Fundo = cor do plástico da peça (evita transparência/alpha sorting) */
const SYMBOL_BG = '#24252b'
const ARROW_BG = '#1f2026'
/** Ranhura sutil (levemente mais clara que o plástico do D-Pad) */
const ARROW_COLOR = '#474853'

type DrawFn = (ctx: CanvasRenderingContext2D) => void

function makeCanvasTexture(draw: DrawFn, background: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D não suportado neste ambiente')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** Glifos em traço (estilo DualShock 4), centralizados no canvas */
function symbolTexture(symbol: FaceSymbol): CanvasTexture {
  return makeCanvasTexture(
    (ctx) => {
      ctx.strokeStyle = SYMBOL_COLORS[symbol]
      ctx.lineWidth = 9
      switch (symbol) {
        case 'triangle':
          ctx.beginPath()
          ctx.moveTo(64, 27)
          ctx.lineTo(102, 95)
          ctx.lineTo(26, 95)
          ctx.closePath()
          ctx.stroke()
          break
        case 'circle':
          ctx.beginPath()
          ctx.arc(64, 64, 36, 0, Math.PI * 2)
          ctx.stroke()
          break
        case 'cross':
          ctx.beginPath()
          ctx.moveTo(33, 33)
          ctx.lineTo(95, 95)
          ctx.moveTo(95, 33)
          ctx.lineTo(33, 95)
          ctx.stroke()
          break
        case 'square':
          ctx.beginPath()
          ctx.rect(32, 32, 64, 64)
          ctx.stroke()
          break
      }
    },
    SYMBOL_BG,
  )
}

/** Rotação do desenho no canvas (sentido horário, eixo da tela) */
const ARROW_ROTATION: Record<ArrowDirection, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
}

/** Chevron gravado apontando para a direção da ponta do D-Pad */
function arrowTexture(direction: ArrowDirection): CanvasTexture {
  return makeCanvasTexture(
    (ctx) => {
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(ARROW_ROTATION[direction])
      ctx.strokeStyle = ARROW_COLOR
      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.moveTo(-19, 9)
      ctx.lineTo(0, -11)
      ctx.lineTo(19, 9)
      ctx.stroke()
    },
    ARROW_BG,
  )
}

export interface ButtonTextures {
  symbols: Record<FaceSymbol, CanvasTexture>
  arrows: Record<ArrowDirection, CanvasTexture>
}

export function createButtonTextures(): ButtonTextures {
  return {
    symbols: {
      cross: symbolTexture('cross'),
      circle: symbolTexture('circle'),
      square: symbolTexture('square'),
      triangle: symbolTexture('triangle'),
    },
    arrows: {
      up: arrowTexture('up'),
      down: arrowTexture('down'),
      left: arrowTexture('left'),
      right: arrowTexture('right'),
    },
  }
}
