/**
 * Reusable room assets and furniture components for detailed map rooms
 */

import { motion } from "framer-motion";

// ============ FLOOR PATTERNS ============

export function CheckeredFloor({ x, y, width, height, color1 = "#4a5568", color2 = "#3a4558" }: {
  x: number; y: number; width: number; height: number; color1?: string; color2?: string;
}) {
  const tileSize = 40;
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);

  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y, width, height }}>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={col * tileSize}
            y={row * tileSize}
            width={tileSize}
            height={tileSize}
            fill={(row + col) % 2 === 0 ? color1 : color2}
            opacity={0.6}
          />
        ))
      )}
    </svg>
  );
}

export function GratingFloor({ x, y, width, height }: {
  x: number; y: number; width: number; height: number;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width,
        height,
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.3) 8px, rgba(0,0,0,0.3) 10px),
          repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.3) 8px, rgba(0,0,0,0.3) 10px)
        `,
      }}
    />
  );
}

// ============ FURNITURE ============

export function RoundTable({ x, y, color = "#5a8ba0" }: { x: number; y: number; color?: string }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x - 60, top: y - 60 }} width="120" height="120">
      {/* Shadow */}
      <ellipse cx="60" cy="70" rx="55" ry="15" fill="rgba(0,0,0,0.3)" />
      {/* Table surface */}
      <ellipse cx="60" cy="60" rx="55" ry="45" fill={color} />
      <ellipse cx="60" cy="55" rx="50" ry="40" fill={color} opacity="0.8" />
      {/* Highlight */}
      <ellipse cx="60" cy="45" rx="30" ry="20" fill="white" opacity="0.2" />
      {/* Items on table */}
      <rect x="35" y="50" width="12" height="15" rx="2" fill="#d4af37" opacity="0.7" />
      <rect x="70" y="48" width="15" height="10" rx="1" fill="#c0c0c0" opacity="0.6" />
    </svg>
  );
}

export function Console({ x, y, width = 80, height = 60, color = "#2d3748" }: {
  x: number; y: number; width?: number; height?: number; color?: string;
}) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width={width} height={height}>
      {/* Base */}
      <rect x="0" y={height * 0.3} width={width} height={height * 0.7} fill={color} rx="4" />
      {/* Screen */}
      <rect x={width * 0.1} y={height * 0.1} width={width * 0.8} height={height * 0.5} fill="#1a2332" rx="2" />
      {/* Screen glow */}
      <rect x={width * 0.15} y={height * 0.15} width={width * 0.7} height={height * 0.4} fill="#22c55e" opacity="0.3" />
      {/* Buttons */}
      <circle cx={width * 0.3} cy={height * 0.8} r="3" fill="#ef4444" opacity="0.8" />
      <circle cx={width * 0.5} cy={height * 0.8} r="3" fill="#22c55e" opacity="0.8" />
      <circle cx={width * 0.7} cy={height * 0.8} r="3" fill="#3b82f6" opacity="0.8" />
    </svg>
  );
}

export function WallPanel({ x, y, width = 100, height = 120, vertical = false }: {
  x: number; y: number; width?: number; height?: number; vertical?: boolean;
}) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width={width} height={height}>
      <rect x="0" y="0" width={width} height={height} fill="#374151" rx="4" />
      <rect x="5" y="5" width={width - 10} height={height - 10} fill="#4b5563" rx="2" />
      {/* Panel lines */}
      {vertical ? (
        <>
          <line x1={width / 2} y1="10" x2={width / 2} y2={height - 10} stroke="#6b7280" strokeWidth="2" />
          <line x1="10" y1={height / 3} x2={width - 10} y2={height / 3} stroke="#6b7280" strokeWidth="1" />
          <line x1="10" y1={height * 2 / 3} x2={width - 10} y2={height * 2 / 3} stroke="#6b7280" strokeWidth="1" />
        </>
      ) : (
        <>
          <line x1="10" y1={height / 2} x2={width - 10} y2={height / 2} stroke="#6b7280" strokeWidth="2" />
          <line x1={width / 3} y1="10" x2={width / 3} y2={height - 10} stroke="#6b7280" strokeWidth="1" />
          <line x1={width * 2 / 3} y1="10" x2={width * 2 / 3} y2={height - 10} stroke="#6b7280" strokeWidth="1" />
        </>
      )}
      {/* Indicator lights */}
      <circle cx={width - 15} cy="15" r="4" fill="#22c55e" opacity="0.8">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function TaskStation({ x, y, type = "default" }: {
  x: number; y: number; type?: "default" | "scan" | "wires" | "fuel";
}) {
  const colors = {
    default: "#3b82f6",
    scan: "#22c55e",
    wires: "#f59e0b",
    fuel: "#ef4444",
  };

  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="60" height="80">
      {/* Base */}
      <rect x="10" y="40" width="40" height="40" fill="#2d3748" rx="3" />
      {/* Screen/Panel */}
      <rect x="15" y="10" width="30" height="35" fill="#1a2332" rx="2" />
      {/* Active indicator */}
      <rect x="20" y="15" width="20" height="25" fill={colors[type]} opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
      </rect>
      {/* Button */}
      <circle cx="30" cy="65" r="5" fill={colors[type]} opacity="0.8" />
    </svg>
  );
}

export function Crate({ x, y, size = 60 }: { x: number; y: number; size?: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width={size} height={size}>
      {/* Shadow */}
      <rect x="5" y={size - 10} width={size - 10} height="10" fill="rgba(0,0,0,0.3)" rx="2" />
      {/* Crate */}
      <rect x="0" y="0" width={size} height={size - 10} fill="#5a4a3a" rx="2" />
      <rect x="2" y="2" width={size - 4} height={size - 12} fill="#6a5a4a" rx="1" />
      {/* Lines */}
      <line x1={size / 2} y1="5" x2={size / 2} y2={size - 15} stroke="#4a3a2a" strokeWidth="2" />
      <line x1="5" y1={size / 2} x2={size - 5} y2={size / 2} stroke="#4a3a2a" strokeWidth="2" />
    </svg>
  );
}

export function VendingMachine({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="70" height="100">
      {/* Shadow */}
      <rect x="5" y="95" width="60" height="5" fill="rgba(0,0,0,0.3)" rx="2" />
      {/* Machine body */}
      <rect x="0" y="0" width="70" height="95" fill="#e11d48" rx="4" />
      <rect x="5" y="5" width="60" height="85" fill="#dc2626" rx="2" />
      {/* Glass window */}
      <rect x="10" y="15" width="50" height="50" fill="#1e3a8a" opacity="0.3" rx="2" />
      <rect x="12" y="17" width="46" height="46" fill="#60a5fa" opacity="0.1" />
      {/* Dispenser */}
      <rect x="20" y="70" width="30" height="15" fill="#1a1a1a" rx="2" />
      {/* Logo */}
      <circle cx="35" cy="40" r="8" fill="#fbbf24" opacity="0.8" />
    </svg>
  );
}

// ============ ROOM-SPECIFIC ASSETS ============

export function NavigationConsole({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="150" height="100">
      {/* Main console */}
      <rect x="0" y="40" width="150" height="60" fill="#1e3a5a" rx="4" />
      {/* Screen */}
      <rect x="10" y="10" width="130" height="70" fill="#0a1929" rx="3" />
      {/* Star map */}
      <circle cx="40" cy="35" r="2" fill="#fbbf24" opacity="0.9" />
      <circle cx="75" cy="45" r="3" fill="#60a5fa" opacity="0.8" />
      <circle cx="110" cy="30" r="2" fill="#f472b6" opacity="0.9" />
      <circle cx="95" cy="55" r="2" fill="#a78bfa" opacity="0.8" />
      {/* Grid lines */}
      <line x1="10" y1="40" x2="140" y2="40" stroke="#22c55e" strokeWidth="0.5" opacity="0.3" />
      <line x1="75" y1="10" x2="75" y2="80" stroke="#22c55e" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

export function WeaponsTurret({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="80" height="90">
      {/* Base */}
      <rect x="20" y="70" width="40" height="20" fill="#374151" rx="2" />
      {/* Turret body */}
      <ellipse cx="40" cy="50" rx="30" ry="25" fill="#4b5563" />
      <ellipse cx="40" cy="45" rx="28" ry="22" fill="#6b7280" />
      {/* Barrel */}
      <rect x="35" y="10" width="10" height="40" fill="#374151" rx="1" />
      <rect x="33" y="8" width="14" height="8" fill="#4b5563" rx="1" />
      {/* Targeting laser */}
      <circle cx="40" cy="30" r="3" fill="#ef4444" opacity="0.8">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function MedScanner({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="100" height="140">
      {/* Scanner pod */}
      <ellipse cx="50" cy="70" rx="45" ry="65" fill="#22c55e" opacity="0.1" />
      {/* Base */}
      <rect x="30" y="120" width="40" height="20" fill="#374151" rx="3" />
      {/* Vertical supports */}
      <rect x="20" y="40" width="8" height="80" fill="#4b5563" rx="1" />
      <rect x="72" y="40" width="8" height="80" fill="#4b5563" rx="1" />
      {/* Top arc */}
      <path d="M 20 40 Q 50 10 80 40" stroke="#6b7280" strokeWidth="6" fill="none" />
      {/* Scanner beam */}
      <rect x="48" y="30" width="4" height="90" fill="#22c55e" opacity="0.6">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

export function OxygenTank({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="60" height="100">
      {/* Tank cylinder */}
      <rect x="10" y="10" width="40" height="80" fill="#3b82f6" rx="8" />
      <rect x="12" y="12" width="36" height="76" fill="#60a5fa" rx="7" />
      {/* Valve on top */}
      <rect x="22" y="0" width="16" height="15" fill="#6b7280" rx="2" />
      <circle cx="30" cy="7" r="3" fill="#374151" />
      {/* Warning stripes */}
      <rect x="10" y="30" width="40" height="6" fill="#fbbf24" opacity="0.8" />
      <rect x="10" y="60" width="40" height="6" fill="#fbbf24" opacity="0.8" />
    </svg>
  );
}

export function ReactorCore({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="120" height="120">
      {/* Outer containment */}
      <circle cx="60" cy="60" r="55" fill="#1e3a5a" />
      <circle cx="60" cy="60" r="50" fill="#2d4a6a" />
      {/* Inner core */}
      <circle cx="60" cy="60" r="35" fill="#3b82f6" opacity="0.6">
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="60" r="25" fill="#60a5fa" opacity="0.8">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Warning rings */}
      <circle cx="60" cy="60" r="50" stroke="#fbbf24" strokeWidth="2" fill="none" opacity="0.4" />
      <circle cx="60" cy="60" r="40" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.3" />
    </svg>
  );
}

export function StorageShelf({ x, y, width = 120, height = 150 }: {
  x: number; y: number; width?: number; height?: number;
}) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width={width} height={height}>
      {/* Frame */}
      <rect x="0" y="0" width={width} height={height} fill="#4a3a2a" rx="3" />
      {/* Shelves */}
      <rect x="5" y={height * 0.25} width={width - 10} height="6" fill="#6a5a4a" />
      <rect x="5" y={height * 0.5} width={width - 10} height="6" fill="#6a5a4a" />
      <rect x="5" y={height * 0.75} width={width - 10} height="6" fill="#6a5a4a" />
      {/* Items on shelves */}
      <rect x="15" y={height * 0.25 - 15} width="20" height="12" fill="#8b7355" rx="1" />
      <rect x="50" y={height * 0.25 - 18} width="15" height="15" fill="#c0c0c0" rx="1" />
      <rect x="20" y={height * 0.5 - 12} width="25" height="10" fill="#d4af37" rx="1" />
      <rect x="70" y={height * 0.5 - 16} width="18" height="14" fill="#7c3aed" rx="1" />
    </svg>
  );
}

export function ElectricalPanel({ x, y }: { x: number; y: number }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width="90" height="110">
      {/* Panel box */}
      <rect x="0" y="0" width="90" height="110" fill="#1e293b" rx="3" />
      <rect x="5" y="5" width="80" height="100" fill="#334155" rx="2" />
      {/* Wiring diagram */}
      <line x1="20" y1="20" x2="70" y2="20" stroke="#ef4444" strokeWidth="3" />
      <line x1="20" y1="40" x2="70" y2="40" stroke="#3b82f6" strokeWidth="3" />
      <line x1="20" y1="60" x2="70" y2="60" stroke="#fbbf24" strokeWidth="3" />
      <line x1="20" y1="80" x2="70" y2="80" stroke="#22c55e" strokeWidth="3" />
      {/* Connection points */}
      <circle cx="20" cy="20" r="4" fill="#ef4444" />
      <circle cx="20" cy="40" r="4" fill="#3b82f6" />
      <circle cx="20" cy="60" r="4" fill="#fbbf24" />
      <circle cx="20" cy="80" r="4" fill="#22c55e" />
    </svg>
  );
}

// ============ DECORATIVE ELEMENTS ============

export function SpaceWindow({ x, y, width = 60, height = 90 }: {
  x: number; y: number; width?: number; height?: number;
}) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y }} width={width} height={height}>
      {/* Window frame */}
      <rect x="0" y="0" width={width} height={height} fill="#2d3748" rx="4" />
      {/* Glass */}
      <rect x="5" y="5" width={width - 10} height={height - 10} fill="#0a1929" rx="2" />
      {/* Space view with stars */}
      <circle cx={width * 0.3} cy={height * 0.3} r="1.5" fill="#fbbf24" opacity="0.9" />
      <circle cx={width * 0.7} cy={height * 0.5} r="1" fill="#ffffff" opacity="0.8" />
      <circle cx={width * 0.5} cy={height * 0.7} r="1.2" fill="#60a5fa" opacity="0.9" />
      <circle cx={width * 0.2} cy={height * 0.6} r="0.8" fill="#ffffff" opacity="0.7" />
      {/* Reflection */}
      <rect x="8" y="8" width={width * 0.3} height={height * 0.4} fill="white" opacity="0.05" />
    </svg>
  );
}
