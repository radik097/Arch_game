import type { Node, Edge } from '@xyflow/react';
import type { InstallStage } from '../../shared/types';

export type InstallNodeData = {
  label: string;
  stage: InstallStage;
  status: 'locked' | 'available' | 'active' | 'completed' | 'failed';
  description: string;
  commands: string[];
};
export type InstallNode = Node<InstallNodeData>;
export type InstallEdge = Edge<{ required: boolean }>;
