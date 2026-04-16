import React, { Suspense } from 'react';

const VMPanel = React.lazy(() => import('./VmPanel'));

const VMLoadingScreen: React.FC = () => (
  <div style={{ color: '#0ff', fontFamily: 'monospace', textAlign: 'center', padding: 40 }}>
    <div style={{ fontSize: 24, marginBottom: 16 }}>Загрузка виртуальной машины…<br />Loading virtual machine…</div>
    <div style={{ border: '2px solid #0ff', borderRadius: 8, padding: 16, background: '#111' }}>
      <div className="cyberpunk-progress" style={{ width: 200, height: 12, background: '#222', borderRadius: 6, overflow: 'hidden', margin: '0 auto' }}>
        <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #0ff 0%, #08f 100%)', animation: 'cyberpunk-bar 2s infinite' }} />
      </div>
      <style>{`@keyframes cyberpunk-bar { 0%{width:0;} 100%{width:100%;} }`}</style>
    </div>
  </div>
);

export const LazyVMPanel: React.FC = () => (
  <Suspense fallback={<VMLoadingScreen />}>
    <VMPanel />
  </Suspense>
);
