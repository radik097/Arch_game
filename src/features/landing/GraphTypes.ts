import type { InstallStage } from '../../shared/types';

export type InstallNodeData = {
  label: string;
  stage: InstallStage;
  status: 'locked' | 'available' | 'active' | 'completed' | 'failed';
  description: string;
  commands: string[];
};

export interface InstallNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: InstallNodeData;
}

export interface InstallEdge {
  id: string;
  source: string;
  target: string;
  data: { required: boolean };
}
