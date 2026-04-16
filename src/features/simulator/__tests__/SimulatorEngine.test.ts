import { SimulatorEngine } from '../SimulatorEngine';
import { createDefaultContext } from '../simulatorUtils';
import { installStages } from '../installationFSM';

describe('SimulatorEngine', () => {
  it('should initialize with the first stage', () => {
    const engine = new SimulatorEngine(createDefaultContext());
    expect(engine.getCurrentStage()).toBe(installStages[0]);
  });

  it('should advance stages on success', () => {
    const engine = new SimulatorEngine(createDefaultContext());
    for (let i = 1; i < installStages.length; i++) {
      engine.advanceStage('success');
      expect(engine.getCurrentStage()).toBe(installStages[i]);
    }
  });

  it('should not advance past the last stage', () => {
    const engine = new SimulatorEngine(createDefaultContext());
    for (let i = 1; i < installStages.length + 2; i++) {
      engine.advanceStage('success');
    }
    expect(engine.getCurrentStage()).toBe(installStages[installStages.length - 1]);
  });
});
