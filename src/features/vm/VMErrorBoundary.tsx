import React from 'react';

interface VMErrorBoundaryProps {
  onSwitchToSim?: () => void;
  children: React.ReactNode;
}

interface VMErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VMErrorBoundary extends React.Component<VMErrorBoundaryProps, VMErrorBoundaryState> {
  constructor(props: VMErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    // Можно логировать ошибку
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#f44', background: '#111', padding: 32, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 16 }}>
            Ошибка загрузки виртуальной машины<br />VM loading error
          </div>
          <div style={{ marginBottom: 16 }}>{String(this.state.error)}</div>
          {this.props.onSwitchToSim && (
            <button onClick={this.props.onSwitchToSim} style={{ padding: '8px 24px', fontSize: 16, background: '#0ff', color: '#111', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Перейти в симулятор / Switch to simulator
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
