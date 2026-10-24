import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state" role="alert">
        <h1>Algo interrompeu a interface</h1>
        <p>Seus dados não foram enviados.</p>
        <button
          className="nova-button button-secondary"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
