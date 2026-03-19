import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainGraph.css';

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'core' | 'action' | 'info' | 'plugin';
  route?: string;
}

interface Connector {
  id: string;
  source: string;
  target: string;
}

export const MainGraph: React.FC<{ onAddPlugin: (url: string) => void }> = ({ onAddPlugin }) => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'sim', label: 'TERMINAL_SIM', x: 400, y: 300, type: 'core', route: '/simulations' },
    { id: 'vm', label: 'VIRTUAL_MACHINE', x: 600, y: 300, type: 'core', route: '/vm' },
    { id: 'about', label: 'ABOUT_PROJECT', x: 300, y: 450, type: 'info', route: '/about' },
    { id: 'help', label: 'CONTRIBUTE', x: 500, y: 450, type: 'info', route: '/help' },
    { id: 'plugin', label: 'AA_MOD', x: 200, y: 300, type: 'plugin' },
  ]);

  const [connectors, setConnectors] = useState<Connector[]>([
    { id: 'c1', source: 'plugin', target: 'sim' },
  ]);

  const [draggingNode, setDraggingNode] = useState<string | null>(null);

  const handleMouseDown = (id: string) => {
    setDraggingNode(id);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode) {
      const svg = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - svg.left;
      const y = e.clientY - svg.top;
      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNode ? { ...n, x, y } : n))
      );
    }
  }, [draggingNode]);

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const handleNodeClick = (node: Node) => {
    if (node.route) {
      if (node.id === 'plugin') {
        const url = prompt('Enter plugin JSON URL:', 'https://example.com/mod.json');
        if (url) onAddPlugin(url);
      } else {
        navigate(node.route);
      }
    }
  };

  const nodeWidth = 140;
  const nodeHeight = 50;

  return (
    <div className="graph-container">
      <div className="graph-overlay">
        <h1>ARCH_TRAINER // CORE_MAP</h1>
        <p>Interactive System Architecture</p>
      </div>
      <svg 
        className="graph-svg" 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp}
        viewBox="0 0 800 600"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {connectors.map((c) => {
          const source = nodes.find((n) => n.id === c.source)!;
          const target = nodes.find((n) => n.id === c.target)!;
          return (
            <line
              key={c.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className="connector-line"
            />
          );
        })}

        {nodes.map((node) => (
          <g 
            key={node.id} 
            transform={`translate(${node.x - nodeWidth/2}, ${node.y - nodeHeight/2})`}
            className={`node-group ${node.type}`}
            onMouseDown={() => handleMouseDown(node.id)}
            onClick={() => handleNodeClick(node)}
          >
            <rect 
              width={nodeWidth} 
              height={nodeHeight} 
              rx="4" 
              className="node-rect"
            />
            <text 
              x={nodeWidth/2} 
              y={nodeHeight/2} 
              dominantBaseline="middle" 
              textAnchor="middle"
              className="node-label"
            >
              {node.label}
            </text>
            <circle cx="0" cy={nodeHeight/2} r="4" className="socket input" />
            <circle cx={nodeWidth} cy={nodeHeight/2} r="4" className="socket output" />
          </g>
        ))}
      </svg>
    </div>
  );
};
