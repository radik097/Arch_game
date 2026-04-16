import React, { createContext, useContext, useState, useEffect } from 'react';
import { IExecutionEngine, SystemState } from '../../shared/types';

const EngineContext = createContext<IExecutionEngine | null>(null);

export const EngineProvider: React.FC<{ engine: IExecutionEngine; children: React.ReactNode }> = ({ engine, children }) => {
  const [state, setState] = useState<SystemState>(engine.getState());

  useEffect(() => {
    // Подписка на изменения состояния, если движок поддерживает события
    // Здесь можно добавить подписку на события, если потребуется
    setState(engine.getState());
  }, [engine]);

  return (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  );
};

export function useEngine(): IExecutionEngine {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}

export function useSystemState(): SystemState {
  const engine = useEngine();
  const [state, setState] = useState<SystemState>(engine.getState());
  useEffect(() => {
    setState(engine.getState());
    // Здесь можно добавить подписку на события, если потребуется
  }, [engine]);
  return state;
}
