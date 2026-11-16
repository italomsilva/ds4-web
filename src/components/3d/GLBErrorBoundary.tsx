import { Component, type ErrorInfo, type ReactNode } from 'react'

interface GLBErrorBoundaryProps {
  children: ReactNode
  /** Chamado quando o .GLB falha (404, arquivo corrompido, parse inválido...) */
  onError: (error: unknown) => void
  /** Mudança de key reseta o boundary (permite nova tentativa manual) */
  resetKey?: string | number
}

interface GLBErrorBoundaryState {
  hasError: boolean
}

/**
 * Error Boundary dedicado ao carregamento do .GLB real.
 * Se o arquivo não existir, estiver corrompido ou falhar no parse,
 * o boundary captura o erro e o ModelRoot renderiza o modelo procedural.
 */
export class GLBErrorBoundary extends Component<GLBErrorBoundaryProps, GLBErrorBoundaryState> {
  state: GLBErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): GLBErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[DS4 GLB] Falha ao carregar o modelo real — ativando reserva procedural:', error, info.componentStack)
    this.props.onError(error)
  }

  componentDidUpdate(prev: GLBErrorBoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render(): ReactNode {
    if (this.state.hasError) return null
    return this.props.children
  }
}
