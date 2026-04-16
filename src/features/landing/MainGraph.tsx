import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainGraph.css';

interface GraphNode {
  id: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  type: 'core' | 'info' | 'plugin';
  icon: string;
  route?: string;
  color: string;
  group?: string; // Node group identifier
  instructions?: string; // Node instructions
  trainInfo?: string; // Node train information
}


interface Connector {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

const INITIAL_NODES: GraphNode[] = [
  // Group 1: Simulations
  { id: 'sim1', label: 'Simulation 1', subtitle: 'Step 1', x: 100, y: 100, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 1', trainInfo: 'Train info 1' },
  { id: 'sim2', label: 'Simulation 2', subtitle: 'Step 2', x: 300, y: 100, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 2', trainInfo: 'Train info 2' },
  { id: 'sim3', label: 'Simulation 3', subtitle: 'Step 3', x: 500, y: 100, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 3', trainInfo: 'Train info 3' },
  { id: 'sim4', label: 'Simulation 4', subtitle: 'Step 4', x: 700, y: 100, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 4', trainInfo: 'Train info 4' },
  { id: 'sim5', label: 'Simulation 5', subtitle: 'Step 5', x: 900, y: 100, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 5', trainInfo: 'Train info 5' },
  { id: 'sim6', label: 'Simulation 6', subtitle: 'Step 6', x: 100, y: 300, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 6', trainInfo: 'Train info 6' },
  { id: 'sim7', label: 'Simulation 7', subtitle: 'Step 7', x: 300, y: 300, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 7', trainInfo: 'Train info 7' },
  { id: 'sim8', label: 'Simulation 8', subtitle: 'Step 8', x: 500, y: 300, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 8', trainInfo: 'Train info 8' },
  { id: 'sim9', label: 'Simulation 9', subtitle: 'Step 9', x: 700, y: 300, type: 'info', icon: 'ℹ️', color: '#00d4ff', group: 'simulations', instructions: 'Instruction for Simulation 9', trainInfo: 'Train info 9' },
  { id: 'sim-run', label: 'Run Simulation', subtitle: 'Start the simulation', x: 900, y: 300, type: 'core', icon: '▶️', color: '#22c55e', group: 'simulations', instructions: 'Run the simulation', trainInfo: 'Simulation runner', route: '/simulations' },

  // Group 2: VM Info
  { id: 'vm1', label: 'VM Info 1', subtitle: 'VM Step 1', x: 100, y: 550, type: 'info', icon: '💻', color: '#a855f7', group: 'vm', instructions: 'VM instruction 1', trainInfo: 'VM train info 1' },
  { id: 'vm2', label: 'VM Info 2', subtitle: 'VM Step 2', x: 300, y: 550, type: 'info', icon: '💻', color: '#a855f7', group: 'vm', instructions: 'VM instruction 2', trainInfo: 'VM train info 2' },
  { id: 'vm3', label: 'VM Info 3', subtitle: 'VM Step 3', x: 500, y: 550, type: 'info', icon: '💻', color: '#a855f7', group: 'vm', instructions: 'VM instruction 3', trainInfo: 'VM_train_info_3' },
  { id: 'vm4', label: 'VM Info 4', subtitle: 'VM Step 4', x: 700, y: 550, type: 'info', icon: '💻', color: '#a855f7', group: 'vm', instructions: 'VM instruction 4', trainInfo: 'VM_train_info_4' },
  { id: 'vm-run', label: 'Run VM', subtitle: 'Start the VM', x: 900, y: 550, type: 'core', icon: '▶️', color: '#f59e0b', group: 'vm', instructions: 'Run the VM', trainInfo: 'VM runner', route: '/vm' },

  // Group 3: About Project
  { id: 'about1', label: 'About Project', subtitle: 'Project Mission', x: 500, y: 800, type: 'info', icon: '◎', color: '#94a3b8', group: 'about', instructions: 'About the project', trainInfo: 'Project info', route: '/about' },
];

const INITIAL_CONNECTORS: Connector[] = [
  // Simulations group connectors
  { id: 'sim-c1', source: 'sim1', target: 'sim2', animated: true },
  { id: 'sim-c2', source: 'sim2', target: 'sim3', animated: true },
  { id: 'sim-c3', source: 'sim3', target: 'sim4', animated: true },
  { id: 'sim-c4', source: 'sim4', target: 'sim5', animated: true },
  { id: 'sim-c5', source: 'sim5', target: 'sim6', animated: true },
  { id: 'sim-c6', source: 'sim6', target: 'sim7', animated: true },
  { id: 'sim-c7', source: 'sim7', target: 'sim8', animated: true },
  { id: 'sim-c8', source: 'sim8', target: 'sim9', animated: true },
  { id: 'sim-c9', source: 'sim9', target: 'sim-run', animated: true },

  // VM group connectors
  { id: 'vm-c1', source: 'vm1', target: 'vm2', animated: true },
  { id: 'vm-c2', source: 'vm2', target: 'vm3', animated: true },
  { id: 'vm-c3', source: 'vm3', target: 'vm4', animated: true },
  { id: 'vm-c4', source: 'vm4', target: 'vm-run', animated: true },

  // About group (no connectors needed if only one node)
];

const NODE_W = 160;
const NODE_H = 64;

export const MainGraph: React.FC<{ onAddPlugin: (url: string) => void }> = ({ onAddPlugin }) => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [connectors] = useState<Connector[]>(INITIAL_CONNECTORS);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [pulsePhase, setPulsePhase] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  // Ambient pulse animation
  useEffect(() => {
    const interval = setInterval(() => setPulsePhase((p) => (p + 1) % 360), 50);
    return () => clearInterval(interval);
  }, []);

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      setDragging(id);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    setNodes((prev) =>
      prev.map((n) => (n.id === dragging ? { ...n, x: svgPt.x, y: svgPt.y } : n))
    );
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const navigateToNode = useCallback((node: GraphNode) => {
    if (node.id === 'plugin') {
      const url = prompt('Enter plugin config URL:', 'https://example.com/mod.json');
      if (url) onAddPlugin(url);
    } else if (node.route) {
      navigate(node.route);
    }
  }, [navigate, onAddPlugin]);

  const glowIntensity = (Math.sin((pulsePhase * Math.PI) / 180) + 1) / 2;

  return (
    <div className="graph-container">
      {/* Animated background particles */}
      <div className="graph-particles">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            animationDelay: `${(i * 0.7) % 5}s`,
            animationDuration: `${4 + (i % 4)}s`,
          }} />
        ))}
      </div>

      {/* Header overlay */}
      <div className="graph-overlay">
        <div className="overlay-badge">SYSTEM MAP</div>
        <h1>ARCH<span className="accent">_</span>TRAINER</h1>
        <p className="subtitle">Interactive Architecture Node Graph</p>
      </div>

      {/* Control panel */}
      <div className="graph-controls">
        <div className="control-group">
          <span className="control-label">CONTROLS</span>
          <button
            className={`control-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
          >
            GRID
          </button>
          <button
            className={`control-btn ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(!showLabels)}
          >
            LABELS
          </button>
          <button
            className="control-btn"
            onClick={() => setNodes(INITIAL_NODES)}
          >
            RESET
          </button>
        </div>
        <div className="control-stats">
          <span className="stat">NODES: {nodes.length}</span>
          <span className="stat">LINKS: {connectors.length}</span>
        </div>
      </div>

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        className="graph-svg"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filters per node color */}
          {nodes.map((n) => (
            <filter key={`glow-${n.id}`} id={`glow-${n.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feFlood floodColor={n.color} floodOpacity={0.6 + glowIntensity * 0.4} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
          {/* Connector glow */}
          <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Grid pattern */}
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-pattern-major" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Grid backgrounds */}
        {showGrid && (
          <>
            <rect width="800" height="600" fill="url(#grid-pattern)" />
            <rect width="800" height="600" fill="url(#grid-pattern-major)" />
          </>
        )}

        {/* Connectors */}
        {connectors.map((c) => {
          const src = nodes.find((n) => n.id === c.source)!;
          const tgt = nodes.find((n) => n.id === c.target)!;
          const srcNode = nodes.find((n) => n.id === c.source)!;
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2 - 30;
          const path = `M ${src.x + NODE_W / 2} ${src.y} Q ${midX} ${midY} ${tgt.x - NODE_W / 2} ${tgt.y}`;
          return (
            <g key={c.id}>
              {/* Glow layer */}
              <path
                d={path}
                fill="none"
                stroke={srcNode.color}
                strokeWidth="4"
                strokeOpacity={0.15 + glowIntensity * 0.1}
                filter="url(#line-glow)"
              />
              {/* Main line */}
              <path
                d={path}
                fill="none"
                stroke={srcNode.color}
                strokeWidth="1.5"
                strokeOpacity={0.5}
                strokeDasharray={c.animated ? '8 6' : 'none'}
                className={c.animated ? 'animated-connector' : ''}
              />
              {/* Data flow dot */}
              {c.animated && (
                <circle r="3" fill={srcNode.color} opacity={0.9}>
                  <animateMotion dur="3s" repeatCount="indefinite" path={path} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hovered === node.id;
          const isDraggingThis = dragging === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x - NODE_W / 2}, ${node.y - NODE_H / 2})`}
              className={`node-group ${node.type} ${isHovered ? 'hovered' : ''} ${isDraggingThis ? 'dragging' : ''}`}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              filter={isHovered ? `url(#glow-${node.id})` : undefined}
            >
              {/* Outer glow rect */}
              <rect
                x="-3" y="-3"
                width={NODE_W + 6} height={NODE_H + 6}
                rx="10" ry="10"
                fill="none"
                stroke={node.color}
                strokeWidth="1"
                strokeOpacity={0.1 + glowIntensity * 0.15}
                className="node-glow-ring"
              />

              {/* Main rect */}
              <rect
                width={NODE_W} height={NODE_H}
                rx="8" ry="8"
                className="node-rect"
                style={{
                  stroke: node.color,
                  strokeOpacity: isHovered ? 0.9 : 0.3,
                }}
              />

              {/* Accent strip */}
              <rect
                x="0"  y="0"
                width="4" height={NODE_H}
                rx="8" ry="0"
                fill={node.color}
                opacity={0.7 + glowIntensity * 0.3}
                className="node-accent"
              />

              {/* Icon */}
              <text x="22" y={NODE_H / 2 - 4} className="node-icon" fill={node.color}>
                {node.icon}
              </text>

              {/* Label */}
              <text x="40" y={NODE_H / 2 - 6} className="node-label" fill="#fff">
                {node.label}
              </text>

              {/* Subtitle */}
              {showLabels && (
                <text x="40" y={NODE_H / 2 + 10} className="node-subtitle" fill={node.color} fillOpacity="0.6">
                  {node.subtitle}
                </text>
              )}

              {/* Play Button */}

              <g 
                className="node-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToNode(node);
                }}
                transform={`translate(${NODE_W - 24}, ${NODE_H / 2})`}
              >
                <circle r="14" fill={node.color} fillOpacity="0.1" className="play-bg" />
                <path d="M -3 -4.5 L 5 0 L -3 4.5 Z" fill={node.color} />
              </g>

              {/* Sockets */}
              <circle cx="-2" cy={NODE_H / 2} r="5" className="socket input" style={{ fill: node.color }} />
              <circle cx="-2" cy={NODE_H / 2} r="2" className="socket-inner" />

              {/* Socket: Output (right) */}
              <circle cx={NODE_W + 2} cy={NODE_H / 2} r="5" className="socket output" style={{ fill: node.color }} />
              <circle cx={NODE_W + 2} cy={NODE_H / 2} r="2" className="socket-inner" />
            </g>
          );
        })}
      </svg>

      {/* Bottom status bar */}
      <div className="graph-statusbar">
        <span className="status-item">◉ SYSTEM ONLINE</span>
        <span className="status-item">CTRL + DRAG TO MOVE • CLICK ▶ TO RUN</span>
        <span className="status-item pulse-text">v0.1.0</span>
      </div>
    </div>
  );
};
