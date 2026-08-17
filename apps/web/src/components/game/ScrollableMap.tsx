"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Location, LocationNames, DeadBody as DeadBodyType, PlayerColors } from "@/types/game";
import { AmongUsSprite, DeadBodySprite } from "./AmongUsSprite";

interface ScrollableMapProps {
  players: Player[];
  deadBodies: DeadBodyType[];
  currentPlayer?: `0x${string}`;
  onPlayerMove?: (location: Location) => void;
  spotlightedPlayer?: `0x${string}` | null;
  onSpotlightPlayer?: (address: `0x${string}` | null) => void;
  activeSabotage?: number;
  gamePhase?: number;
}

const MAP_WIDTH = 10500;
const MAP_HEIGHT = 8500;

// Corridor floor details - arrows, lines, hazard stripes
function CorridorDetails({ x, y, width, height, direction }: { x: number; y: number; width: number; height: number; direction: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y, width, height }}>
      {/* Center line */}
      <div
        className="absolute bg-yellow-500/40"
        style={isHorizontal ? {
          left: 10, right: 10, top: '50%', height: 3, transform: 'translateY(-50%)',
          boxShadow: '0 0 8px rgba(234, 179, 8, 0.3)'
        } : {
          top: 10, bottom: 10, left: '50%', width: 3, transform: 'translateX(-50%)',
          boxShadow: '0 0 8px rgba(234, 179, 8, 0.3)'
        }}
      />
      {/* Dashed edge lines */}
      <div
        className="absolute"
        style={isHorizontal ? {
          left: 8, right: 8, top: 8, height: 2,
          backgroundImage: 'repeating-linear-gradient(90deg, #64748b 0, #64748b 10px, transparent 10px, transparent 20px)'
        } : {
          top: 8, bottom: 8, left: 8, width: 2,
          backgroundImage: 'repeating-linear-gradient(180deg, #64748b 0, #64748b 10px, transparent 10px, transparent 20px)'
        }}
      />
      <div
        className="absolute"
        style={isHorizontal ? {
          left: 8, right: 8, bottom: 8, height: 2,
          backgroundImage: 'repeating-linear-gradient(90deg, #64748b 0, #64748b 10px, transparent 10px, transparent 20px)'
        } : {
          top: 8, bottom: 8, right: 8, width: 2,
          backgroundImage: 'repeating-linear-gradient(180deg, #64748b 0, #64748b 10px, transparent 10px, transparent 20px)'
        }}
      />
      {/* Floor grating pattern */}
      <div
        className="absolute inset-4 opacity-20"
        style={{
          backgroundImage: isHorizontal
            ? 'repeating-linear-gradient(90deg, #1a1a2e 0, #1a1a2e 2px, transparent 2px, transparent 12px)'
            : 'repeating-linear-gradient(180deg, #1a1a2e 0, #1a1a2e 2px, transparent 2px, transparent 12px)'
        }}
      />
    </div>
  );
}

// Pipe decoration along corridors
function CorridorPipes({ x, y, width, height, direction }: { x: number; y: number; width: number; height: number; direction: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal';

  return (
    <>
      {/* Main pipe */}
      <div
        className="absolute rounded-full"
        style={{
          left: isHorizontal ? x : x - 6,
          top: isHorizontal ? y - 6 : y,
          width: isHorizontal ? width : 8,
          height: isHorizontal ? 8 : height,
          background: 'linear-gradient(to bottom, #6b7280, #374151, #6b7280)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}
      />
      {/* Secondary pipe with color */}
      <div
        className="absolute rounded-full"
        style={{
          left: isHorizontal ? x : x + width + 2,
          top: isHorizontal ? y + height + 2 : y,
          width: isHorizontal ? width : 6,
          height: isHorizontal ? 6 : height,
          background: 'linear-gradient(to bottom, #f59e0b, #d97706, #f59e0b)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}
      />
    </>
  );
}

// Vent grate decoration
function VentGrate({ x, y, size = 40 }: { x: number; y: number; size?: number }) {
  return (
    <div
      className="absolute"
      style={{ left: x, top: y, width: size, height: size * 0.6 }}
    >
      <div className="w-full h-full bg-gray-800 rounded border-2 border-gray-900 overflow-hidden">
        <div className="w-full h-full" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #1f2937 0, #1f2937 3px, #374151 3px, #374151 6px)'
        }} />
      </div>
      {/* Screws */}
      <div className="absolute w-2 h-2 bg-gray-600 rounded-full top-1 left-1 border border-gray-800" />
      <div className="absolute w-2 h-2 bg-gray-600 rounded-full top-1 right-1 border border-gray-800" />
    </div>
  );
}

// Wall light fixture
function WallLight({ x, y, color = '#3b82f6' }: { x: number; y: number; color?: string }) {
  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: y }}
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-4 h-8 rounded-full" style={{
        background: `linear-gradient(180deg, ${color} 0%, ${color}88 50%, ${color}44 100%)`,
        boxShadow: `0 0 15px ${color}, 0 0 30px ${color}66`
      }} />
    </motion.div>
  );
}

// Space window decoration
function SpaceWindow({ x, y, width = 60, height = 80 }: { x: number; y: number; width?: number; height?: number }) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: x, top: y, width, height,
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)',
        borderRadius: 8,
        border: '4px solid #374151',
        boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.3), 0 0 10px rgba(0,0,0,0.8)'
      }}
    >
      {/* Stars through window */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-white rounded-full"
          style={{
            left: `${(i * 37) % 90}%`,
            top: `${(i * 53) % 90}%`,
            width: 2,
            height: 2,
          }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 1 + (i % 3), repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
      {/* Window frame inner border */}
      <div className="absolute inset-1 rounded border border-gray-600/50" />
    </div>
  );
}

// Hull panel decoration
function HullPanel({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width, height,
        background: 'linear-gradient(180deg, #374151 0%, #1f2937 100%)',
        borderRadius: 4,
        border: '2px solid #4b5563',
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3)'
      }}
    >
      {/* Rivets */}
      <div className="absolute w-2 h-2 bg-gray-500 rounded-full top-1 left-1" />
      <div className="absolute w-2 h-2 bg-gray-500 rounded-full top-1 right-1" />
      <div className="absolute w-2 h-2 bg-gray-500 rounded-full bottom-1 left-1" />
      <div className="absolute w-2 h-2 bg-gray-500 rounded-full bottom-1 right-1" />
    </div>
  );
}

// Hazard stripe pattern
function HazardStripes({ x, y, width, height, direction = 'horizontal' }: { x: number; y: number; width: number; height: number; direction?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width, height,
        background: direction === 'horizontal'
          ? 'repeating-linear-gradient(45deg, #eab308 0, #eab308 10px, #1f2937 10px, #1f2937 20px)'
          : 'repeating-linear-gradient(-45deg, #eab308 0, #eab308 10px, #1f2937 10px, #1f2937 20px)',
        borderRadius: 2,
      }}
    />
  );
}

// Room configurations - MUCH LARGER layout with proper spacing
// The Skeld Layout:
//   Upper Engine ---- MedBay ---- Cafeteria
//        |                            |
//     Reactor                       Admin
//        |                            |
//    Security                      Storage
//        |                            |
//   Lower Engine -- Electrical -------+
//
const ROOMS: Record<Location, {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  floorColor: string;
  name: string;
  entryPoints: { [key: string]: { x: number; y: number } };
  center: { x: number; y: number };
}> = {
  // === TOP ROW ===
  [Location.UpperEngine]: {
    x: 100, y: 100,
    width: 650, height: 550,
    color: "#5a3a3a", floorColor: "#6a4a4a",
    name: "UPPER ENGINE",
    center: { x: 425, y: 375 },
    entryPoints: {
      right: { x: 750, y: 375 },
      bottom: { x: 425, y: 650 },
    },
  },
  [Location.MedBay]: {
    x: 1550, y: 100,
    width: 650, height: 550,
    color: "#3a5a4a", floorColor: "#4a6a5a",
    name: "MEDBAY",
    center: { x: 1875, y: 375 },
    entryPoints: {
      left: { x: 1550, y: 375 },
      right: { x: 2200, y: 375 },
    },
  },
  [Location.Cafeteria]: {
    x: 3000, y: 100,
    width: 900, height: 550,
    color: "#4a5568", floorColor: "#5a6578",
    name: "CAFETERIA",
    center: { x: 3450, y: 375 },
    entryPoints: {
      left: { x: 3000, y: 375 },
      bottom: { x: 3450, y: 650 },
      right: { x: 3900, y: 375 },
    },
  },
  // === SECOND ROW ===
  [Location.Reactor]: {
    x: 100, y: 1100,
    width: 650, height: 500,
    color: "#5a4a3a", floorColor: "#6a5a4a",
    name: "REACTOR",
    center: { x: 425, y: 1350 },
    entryPoints: {
      top: { x: 425, y: 1100 },
      bottom: { x: 425, y: 1600 },
    },
  },
  [Location.Admin]: {
    x: 2700, y: 1100,
    width: 700, height: 500,
    color: "#4a5568", floorColor: "#5a6578",
    name: "ADMIN",
    center: { x: 3050, y: 1350 },
    entryPoints: {
      top: { x: 3050, y: 1100 },
      bottom: { x: 3050, y: 1600 },
    },
  },
  // === THIRD ROW ===
  [Location.Security]: {
    x: 100, y: 2100,
    width: 650, height: 500,
    color: "#3a3a5a", floorColor: "#4a4a6a",
    name: "SECURITY",
    center: { x: 425, y: 2350 },
    entryPoints: {
      top: { x: 425, y: 2100 },
      bottom: { x: 425, y: 2600 },
    },
  },
  [Location.Storage]: {
    x: 2400, y: 2100,
    width: 900, height: 550,
    color: "#5a4a3a", floorColor: "#6a5a4a",
    name: "STORAGE",
    center: { x: 2850, y: 2400 },
    entryPoints: {
      top: { x: 2850, y: 2100 },
      left: { x: 2400, y: 2400 },
    },
  },
  // === BOTTOM ROW ===
  [Location.LowerEngine]: {
    x: 100, y: 3100,
    width: 650, height: 550,
    color: "#5a3a3a", floorColor: "#6a4a4a",
    name: "LOWER ENGINE",
    center: { x: 425, y: 3400 },
    entryPoints: {
      top: { x: 425, y: 3100 },
      right: { x: 750, y: 3400 },
    },
  },
  [Location.Electrical]: {
    x: 1350, y: 3100,
    width: 650, height: 550,
    color: "#3a4a5a", floorColor: "#4a5a6a",
    name: "ELECTRICAL",
    center: { x: 1675, y: 3400 },
    entryPoints: {
      left: { x: 1350, y: 3400 },
      right: { x: 2000, y: 3400 },
    },
  },
  // === NEW ROOMS (EXPANDING TO 14) ===
  [Location.Weapons]: {
    x: 4700, y: 100,
    width: 750, height: 550,
    color: "#5a3a3a", floorColor: "#6a4a4a",
    name: "WEAPONS",
    center: { x: 5075, y: 375 },
    entryPoints: {
      left: { x: 4700, y: 375 },
      bottom: { x: 5075, y: 650 },
    },
  },
  [Location.Navigation]: {
    x: 4700, y: 1100,
    width: 750, height: 650,
    color: "#3a4a5a", floorColor: "#4a5a6a",
    name: "NAVIGATION",
    center: { x: 5075, y: 1425 },
    entryPoints: {
      top: { x: 5075, y: 1100 },
      bottom: { x: 5075, y: 1750 },
    },
  },
  [Location.Shields]: {
    x: 4700, y: 2200,
    width: 750, height: 550,
    color: "#3a5a5a", floorColor: "#4a6a6a",
    name: "SHIELDS",
    center: { x: 5075, y: 2475 },
    entryPoints: {
      top: { x: 5075, y: 2200 },
      left: { x: 4700, y: 2475 },
    },
  },
  [Location.O2]: {
    x: 6250, y: 1100,
    width: 650, height: 650,
    color: "#3a5a4a", floorColor: "#4a6a5a",
    name: "O2",
    center: { x: 6575, y: 1425 },
    entryPoints: {
      left: { x: 6250, y: 1425 },
    },
  },
  [Location.Communications]: {
    x: 2400, y: 4200,
    width: 900, height: 550,
    color: "#4a3a5a", floorColor: "#5a4a6a",
    name: "COMMUNICATIONS",
    center: { x: 2850, y: 4475 },
    entryPoints: {
      top: { x: 2850, y: 4200 },
    },
  },
};

// Corridor definitions - matches The Skeld layout
const CORRIDORS: { x: number; y: number; width: number; height: number; direction: 'horizontal' | 'vertical' }[] = [
  // === TOP HORIZONTAL CORRIDOR ===
  // Upper Engine (right edge x=750) to MedBay (left edge x=1550)
  { x: 750, y: 350, width: 800, height: 120, direction: 'horizontal' },
  // MedBay (right edge x=2200) to Cafeteria (left edge x=3000)
  { x: 2200, y: 350, width: 800, height: 120, direction: 'horizontal' },

  // === LEFT VERTICAL CORRIDOR (Engine Column) ===
  // Upper Engine (bottom y=650) to Reactor (top y=1100)
  { x: 370, y: 650, width: 120, height: 450, direction: 'vertical' },
  // Reactor (bottom y=1600) to Security (top y=2100)
  { x: 370, y: 1600, width: 120, height: 500, direction: 'vertical' },
  // Security (bottom y=2600) to Lower Engine (top y=3100)
  { x: 370, y: 2600, width: 120, height: 500, direction: 'vertical' },

  // === RIGHT VERTICAL CORRIDOR ===
  // Cafeteria (bottom y=650) to Admin (top y=1100)
  { x: 2995, y: 650, width: 120, height: 450, direction: 'vertical' },
  // Admin (bottom y=1600) to Storage (top y=2100)
  { x: 2995, y: 1600, width: 120, height: 500, direction: 'vertical' },

  // === BOTTOM HORIZONTAL CORRIDOR ===
  // Lower Engine (right edge x=750) to Electrical (left edge x=1350)
  { x: 750, y: 3350, width: 600, height: 120, direction: 'horizontal' },
  // Electrical (right edge x=2000) to Storage (left edge x=2400)
  { x: 2000, y: 3350, width: 400, height: 120, direction: 'horizontal' },
  // Connect bottom corridor to Storage (going up) - FIXED: aligned with Storage left edge
  { x: 2400, y: 2650, width: 120, height: 750, direction: 'vertical' },

  // === NEW CORRIDORS (RIGHT SIDE EXPANSION) ===
  // Cafeteria → Weapons (horizontal right)
  { x: 3900, y: 350, width: 800, height: 120, direction: 'horizontal' },
  // Weapons → Navigation (vertical down)
  { x: 5020, y: 650, width: 120, height: 450, direction: 'vertical' },
  // Navigation → O2 (horizontal right)
  { x: 5450, y: 1370, width: 800, height: 120, direction: 'horizontal' },
  // Navigation → Shields (vertical down)
  { x: 5020, y: 1750, width: 120, height: 450, direction: 'vertical' },
  // Shields → Storage (horizontal left)
  { x: 3300, y: 2425, width: 1400, height: 120, direction: 'horizontal' },
  // Storage → Communications (vertical down)
  { x: 2795, y: 2650, width: 120, height: 1550, direction: 'vertical' },
];

// Vent locations on the map - positioned for The Skeld layout
const VENTS = [
  { x: 600, y: 500 },   // Upper Engine
  { x: 1800, y: 500 },  // MedBay
  { x: 600, y: 1450 },  // Reactor
  { x: 600, y: 2450 },  // Security
  { x: 600, y: 3500 },  // Lower Engine
  { x: 1800, y: 3500 }, // Electrical
  { x: 3200, y: 1450 }, // Admin
  { x: 3000, y: 2500 }, // Storage
];

// Wall lights for ambiance - positioned for The Skeld layout
const WALL_LIGHTS = [
  // Top row
  { x: 80, y: 200, color: '#ef4444' },    // Upper Engine
  { x: 1530, y: 200, color: '#22c55e' },  // MedBay
  { x: 2980, y: 200, color: '#3b82f6' },  // Cafeteria
  { x: 3880, y: 200, color: '#3b82f6' },  // Cafeteria right
  // Second row
  { x: 80, y: 1200, color: '#f59e0b' },   // Reactor
  { x: 3880, y: 1200, color: '#22c55e' }, // Admin
  // Third row
  { x: 80, y: 2200, color: '#a855f7' },   // Security
  { x: 3880, y: 2200, color: '#a855f7' }, // Storage
  // Bottom row
  { x: 80, y: 3200, color: '#ef4444' },   // Lower Engine
  { x: 1330, y: 3200, color: '#3b82f6' }, // Electrical
];

// Space windows on the hull - positioned for The Skeld layout
const SPACE_WINDOWS = [
  // Left side
  { x: 30, y: 250, width: 55, height: 80 },   // Upper Engine
  { x: 30, y: 1250, width: 55, height: 80 },  // Reactor
  { x: 30, y: 2250, width: 55, height: 80 },  // Security
  { x: 30, y: 3250, width: 55, height: 80 },  // Lower Engine
  // Right side
  { x: 4000, y: 250, width: 55, height: 80 },  // Cafeteria
  { x: 4000, y: 1250, width: 55, height: 80 }, // Admin
  { x: 4000, y: 2250, width: 55, height: 80 }, // Storage
];

// Graph of connected rooms with corridor waypoints - The Skeld layout
// Connections match types/game.ts RoomConnections
// All paths use ACTUAL room centers and corridor centerlines
const ROOM_CONNECTIONS: Record<Location, { to: Location; path: { x: number; y: number }[] }[]> = {
  [Location.UpperEngine]: [
    // UpperEngine (425,375) → MedBay (1875,375) via corridor center (1150,410)
    { to: Location.MedBay, path: [
      { x: 425, y: 375 },   // Start: UpperEngine center
      { x: 425, y: 410 },   // Move to corridor y
      { x: 1150, y: 410 },  // Through corridor center
      { x: 1875, y: 410 },  // Approach MedBay
      { x: 1875, y: 375 },  // End: MedBay center
    ]},
    // UpperEngine (425,375) → Reactor (425,1350) via corridor center (430,875)
    { to: Location.Reactor, path: [
      { x: 425, y: 375 },   // Start: UpperEngine center
      { x: 430, y: 375 },   // Move to corridor x
      { x: 430, y: 875 },   // Through corridor center
      { x: 430, y: 1350 },  // Approach Reactor
      { x: 425, y: 1350 },  // End: Reactor center
    ]},
  ],
  [Location.MedBay]: [
    // MedBay (1875,375) → UpperEngine (425,375) via corridor center (1150,410)
    { to: Location.UpperEngine, path: [
      { x: 1875, y: 375 },  // Start: MedBay center
      { x: 1875, y: 410 },  // Move to corridor y
      { x: 1150, y: 410 },  // Through corridor center
      { x: 425, y: 410 },   // Approach UpperEngine
      { x: 425, y: 375 },   // End: UpperEngine center
    ]},
    // MedBay (1875,375) → Cafeteria (3450,375) via corridor center (2600,410)
    { to: Location.Cafeteria, path: [
      { x: 1875, y: 375 },  // Start: MedBay center
      { x: 1875, y: 410 },  // Move to corridor y
      { x: 2600, y: 410 },  // Through corridor center
      { x: 3450, y: 410 },  // Approach Cafeteria
      { x: 3450, y: 375 },  // End: Cafeteria center
    ]},
  ],
  [Location.Cafeteria]: [
    // Cafeteria (3450,375) → MedBay (1875,375) via corridor center (2600,410)
    { to: Location.MedBay, path: [
      { x: 3450, y: 375 },  // Start: Cafeteria center
      { x: 3450, y: 410 },  // Move to corridor y
      { x: 2600, y: 410 },  // Through corridor center
      { x: 1875, y: 410 },  // Approach MedBay
      { x: 1875, y: 375 },  // End: MedBay center
    ]},
    // Cafeteria (3450,375) → Admin (3050,1350) via corridor center (3055,875)
    { to: Location.Admin, path: [
      { x: 3450, y: 375 },  // Start: Cafeteria center
      { x: 3055, y: 375 },  // Move to corridor x
      { x: 3055, y: 875 },  // Through corridor center
      { x: 3055, y: 1350 }, // Approach Admin
      { x: 3050, y: 1350 }, // End: Admin center
    ]},
    // Cafeteria (3450,375) → Weapons (5075,375) via corridor center (4300,410)
    { to: Location.Weapons, path: [
      { x: 3450, y: 375 },  // Start: Cafeteria center
      { x: 3450, y: 410 },  // Move to corridor y
      { x: 4300, y: 410 },  // Through corridor center
      { x: 5075, y: 410 },  // Approach Weapons
      { x: 5075, y: 375 },  // End: Weapons center
    ]},
  ],
  [Location.Reactor]: [
    // Reactor (425,1350) → UpperEngine (425,375) via corridor center (430,875)
    { to: Location.UpperEngine, path: [
      { x: 425, y: 1350 },  // Start: Reactor center
      { x: 430, y: 1350 },  // Move to corridor x
      { x: 430, y: 875 },   // Through corridor center
      { x: 430, y: 375 },   // Approach UpperEngine
      { x: 425, y: 375 },   // End: UpperEngine center
    ]},
    // Reactor (425,1350) → Security (425,2350) via corridor center (430,1850)
    { to: Location.Security, path: [
      { x: 425, y: 1350 },  // Start: Reactor center
      { x: 430, y: 1350 },  // Move to corridor x
      { x: 430, y: 1850 },  // Through corridor center
      { x: 430, y: 2350 },  // Approach Security
      { x: 425, y: 2350 },  // End: Security center
    ]},
  ],
  [Location.Admin]: [
    // Admin (3050,1350) → Cafeteria (3450,375) via corridor center (3055,875)
    { to: Location.Cafeteria, path: [
      { x: 3050, y: 1350 }, // Start: Admin center
      { x: 3055, y: 1350 }, // Move to corridor x
      { x: 3055, y: 875 },  // Through corridor center
      { x: 3055, y: 375 },  // Approach Cafeteria
      { x: 3450, y: 375 },  // End: Cafeteria center
    ]},
    // Admin (3050,1350) → Storage (2850,2400) via corridor center (3055,1850)
    { to: Location.Storage, path: [
      { x: 3050, y: 1350 }, // Start: Admin center
      { x: 3055, y: 1350 }, // Move to corridor x
      { x: 3055, y: 1850 }, // Through corridor center
      { x: 3055, y: 2400 }, // Approach Storage
      { x: 2850, y: 2400 }, // End: Storage center
    ]},
  ],
  [Location.Security]: [
    // Security (425,2350) → Reactor (425,1350) via corridor center (430,1850)
    { to: Location.Reactor, path: [
      { x: 425, y: 2350 },  // Start: Security center
      { x: 430, y: 2350 },  // Move to corridor x
      { x: 430, y: 1850 },  // Through corridor center
      { x: 430, y: 1350 },  // Approach Reactor
      { x: 425, y: 1350 },  // End: Reactor center
    ]},
    // Security (425,2350) → LowerEngine (425,3400) via corridor center (430,2850)
    { to: Location.LowerEngine, path: [
      { x: 425, y: 2350 },  // Start: Security center
      { x: 430, y: 2350 },  // Move to corridor x
      { x: 430, y: 2850 },  // Through corridor center
      { x: 430, y: 3400 },  // Approach LowerEngine
      { x: 425, y: 3400 },  // End: LowerEngine center
    ]},
  ],
  [Location.Storage]: [
    // Storage (2850,2400) → Admin (3050,1350) via corridor center (3055,1850)
    { to: Location.Admin, path: [
      { x: 2850, y: 2400 }, // Start: Storage center
      { x: 3055, y: 2400 }, // Move to corridor x
      { x: 3055, y: 1850 }, // Through corridor center
      { x: 3055, y: 1350 }, // Approach Admin
      { x: 3050, y: 1350 }, // End: Admin center
    ]},
    // Storage (2850,2400) → Electrical (1675,3400) via corridors (2460,3025), (2200,3410), (1050,3410)
    { to: Location.Electrical, path: [
      { x: 2850, y: 2400 }, // Start: Storage center
      { x: 2460, y: 2400 }, // Move to vertical corridor x
      { x: 2460, y: 3025 }, // Through vertical corridor center
      { x: 2460, y: 3410 }, // Reach horizontal corridor
      { x: 2200, y: 3410 }, // Through junction corridor center
      { x: 1050, y: 3410 }, // Through main horizontal corridor center
      { x: 1675, y: 3410 }, // Approach Electrical
      { x: 1675, y: 3400 }, // End: Electrical center
    ]},
    // Storage (2850,2400) → Shields (5075,2475) via corridor center (4000,2485)
    { to: Location.Shields, path: [
      { x: 2850, y: 2400 }, // Start: Storage center
      { x: 2850, y: 2485 }, // Move to corridor y
      { x: 4000, y: 2485 }, // Through corridor center
      { x: 5075, y: 2485 }, // Approach Shields
      { x: 5075, y: 2475 }, // End: Shields center
    ]},
    // Storage (2850,2400) → Communications (2850,4800) via corridor center (2855,3425)
    { to: Location.Communications, path: [
      { x: 2850, y: 2400 }, // Start: Storage center
      { x: 2855, y: 2400 }, // Move to corridor x
      { x: 2855, y: 3425 }, // Through corridor center
      { x: 2855, y: 4800 }, // Approach Communications
      { x: 2850, y: 4800 }, // End: Communications center
    ]},
  ],
  [Location.LowerEngine]: [
    // LowerEngine (425,3400) → Security (425,2350) via corridor center (430,2850)
    { to: Location.Security, path: [
      { x: 425, y: 3400 },  // Start: LowerEngine center
      { x: 430, y: 3400 },  // Move to corridor x
      { x: 430, y: 2850 },  // Through corridor center
      { x: 430, y: 2350 },  // Approach Security
      { x: 425, y: 2350 },  // End: Security center
    ]},
    // LowerEngine (425,3400) → Electrical (1675,3400) via corridor center (1050,3410)
    { to: Location.Electrical, path: [
      { x: 425, y: 3400 },  // Start: LowerEngine center
      { x: 425, y: 3410 },  // Move to corridor y
      { x: 1050, y: 3410 }, // Through corridor center
      { x: 1675, y: 3410 }, // Approach Electrical
      { x: 1675, y: 3400 }, // End: Electrical center
    ]},
  ],
  [Location.Electrical]: [
    // Electrical (1675,3400) → LowerEngine (425,3400) via corridor center (1050,3410)
    { to: Location.LowerEngine, path: [
      { x: 1675, y: 3400 }, // Start: Electrical center
      { x: 1675, y: 3410 }, // Move to corridor y
      { x: 1050, y: 3410 }, // Through corridor center
      { x: 425, y: 3410 },  // Approach LowerEngine
      { x: 425, y: 3400 },  // End: LowerEngine center
    ]},
    // Electrical (1675,3400) → Storage (2850,2400) via corridors (1050,3410), (2200,3410), (2460,3025)
    { to: Location.Storage, path: [
      { x: 1675, y: 3400 }, // Start: Electrical center
      { x: 1675, y: 3410 }, // Move to corridor y
      { x: 1050, y: 3410 }, // Through main horizontal corridor center
      { x: 2200, y: 3410 }, // Through junction corridor center
      { x: 2460, y: 3410 }, // Reach vertical corridor
      { x: 2460, y: 3025 }, // Through vertical corridor center
      { x: 2460, y: 2400 }, // Approach Storage
      { x: 2850, y: 2400 }, // End: Storage center
    ]},
  ],
  // === NEW ROOM CONNECTIONS ===
  [Location.Weapons]: [
    // Weapons (5075,375) → Cafeteria (3450,375) via corridor center (4300,410)
    { to: Location.Cafeteria, path: [
      { x: 5075, y: 375 },  // Start: Weapons center
      { x: 5075, y: 410 },  // Move to corridor y
      { x: 4300, y: 410 },  // Through corridor center
      { x: 3450, y: 410 },  // Approach Cafeteria
      { x: 3450, y: 375 },  // End: Cafeteria center
    ]},
    // Weapons (5075,375) → Navigation (5075,1425) via corridor center (5080,875)
    { to: Location.Navigation, path: [
      { x: 5075, y: 375 },  // Start: Weapons center
      { x: 5080, y: 375 },  // Move to corridor x
      { x: 5080, y: 875 },  // Through corridor center
      { x: 5080, y: 1425 }, // Approach Navigation
      { x: 5075, y: 1425 }, // End: Navigation center
    ]},
  ],
  [Location.Navigation]: [
    // Navigation (5075,1425) → Weapons (5075,375) via corridor center (5080,875)
    { to: Location.Weapons, path: [
      { x: 5075, y: 1425 }, // Start: Navigation center
      { x: 5080, y: 1425 }, // Move to corridor x
      { x: 5080, y: 875 },  // Through corridor center
      { x: 5080, y: 375 },  // Approach Weapons
      { x: 5075, y: 375 },  // End: Weapons center
    ]},
    // Navigation (5075,1425) → O2 (6575,1425) via corridor center (5850,1430)
    { to: Location.O2, path: [
      { x: 5075, y: 1425 }, // Start: Navigation center
      { x: 5075, y: 1430 }, // Move to corridor y
      { x: 5850, y: 1430 }, // Through corridor center
      { x: 6575, y: 1430 }, // Approach O2
      { x: 6575, y: 1425 }, // End: O2 center
    ]},
    // Navigation (5075,1425) → Shields (5075,2475) via corridor center (5080,1975)
    { to: Location.Shields, path: [
      { x: 5075, y: 1425 }, // Start: Navigation center
      { x: 5080, y: 1425 }, // Move to corridor x
      { x: 5080, y: 1975 }, // Through corridor center
      { x: 5080, y: 2475 }, // Approach Shields
      { x: 5075, y: 2475 }, // End: Shields center
    ]},
  ],
  [Location.O2]: [
    // O2 (6575,1425) → Navigation (5075,1425) via corridor center (5850,1430)
    { to: Location.Navigation, path: [
      { x: 6575, y: 1425 }, // Start: O2 center
      { x: 6575, y: 1430 }, // Move to corridor y
      { x: 5850, y: 1430 }, // Through corridor center
      { x: 5075, y: 1430 }, // Approach Navigation
      { x: 5075, y: 1425 }, // End: Navigation center
    ]},
  ],
  [Location.Shields]: [
    // Shields (5075,2475) → Navigation (5075,1425) via corridor center (5080,1975)
    { to: Location.Navigation, path: [
      { x: 5075, y: 2475 }, // Start: Shields center
      { x: 5080, y: 2475 }, // Move to corridor x
      { x: 5080, y: 1975 }, // Through corridor center
      { x: 5080, y: 1425 }, // Approach Navigation
      { x: 5075, y: 1425 }, // End: Navigation center
    ]},
    // Shields (5075,2475) → Storage (2850,2400) via corridor center (4000,2485)
    { to: Location.Storage, path: [
      { x: 5075, y: 2475 }, // Start: Shields center
      { x: 5075, y: 2485 }, // Move to corridor y
      { x: 4000, y: 2485 }, // Through corridor center
      { x: 2850, y: 2485 }, // Approach Storage
      { x: 2850, y: 2400 }, // End: Storage center
    ]},
  ],
  [Location.Communications]: [
    // Communications (2850,4800) → Storage (2850,2400) via corridor center (2855,3425)
    { to: Location.Storage, path: [
      { x: 2850, y: 4800 }, // Start: Communications center
      { x: 2855, y: 4800 }, // Move to corridor x
      { x: 2855, y: 3425 }, // Through corridor center
      { x: 2855, y: 2400 }, // Approach Storage
      { x: 2850, y: 2400 }, // End: Storage center
    ]},
  ],
};

// BFS to find path between any two rooms
function findPath(from: Location, to: Location): { x: number; y: number }[] {
  if (from === to) return [];

  // Direct connection?
  const directConnection = ROOM_CONNECTIONS[from]?.find(c => c.to === to);
  if (directConnection) {
    return [...directConnection.path];
  }

  // BFS for multi-hop path
  const visited = new Set<Location>();
  const queue: { room: Location; path: { x: number; y: number }[] }[] = [
    { room: from, path: [] }
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.room)) continue;
    visited.add(current.room);

    const connections = ROOM_CONNECTIONS[current.room] || [];
    for (const conn of connections) {
      const newPath = [...current.path, ...conn.path];

      if (conn.to === to) {
        return newPath;
      }

      if (!visited.has(conn.to)) {
        queue.push({ room: conn.to, path: newPath });
      }
    }
  }

  // No path found - shouldn't happen
  return [];
}

// Deduplicate consecutive identical waypoints
function deduplicateWaypoints(path: { x: number; y: number }[]): { x: number; y: number }[] {
  if (path.length <= 1) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    if (Math.abs(prev.x - curr.x) > 1 || Math.abs(prev.y - curr.y) > 1) {
      result.push(curr);
    }
  }
  return result;
}



// Helper for stable lane offsets based on address
function getStableIndex(address: string): number {
  if (!address) return 0;
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash) + address.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash);
}

// Check if two locations are directly connected in the corridor graph
function areLocationsAdjacent(loc1: Location, loc2: Location): boolean {
  if (loc1 === loc2) return true;
  return ROOM_CONNECTIONS[loc1]?.some(conn => conn.to === loc2) || false;
}

interface PlayerPosition {
  x: number;
  y: number;
  waypoints: { x: number; y: number }[];
  currentWaypointIndex: number;
  isMoving: boolean;
  facingLeft: boolean;
  lastLocation: Location;
  stableIdx: number;
}

/**
 * The bounding box of the ship inside the 10500x8500 canvas.
 *
 * The rooms occupy roughly the upper-left half of it, so panning to the canvas origin — the
 * default — shows mostly empty hull. Derived from ROOMS so it stays correct if a room moves.
 */
function shipBounds() {
  const boxes = Object.values(ROOMS);
  const minX = Math.min(...boxes.map((r) => r.x));
  const minY = Math.min(...boxes.map((r) => r.y));
  const maxX = Math.max(...boxes.map((r) => r.x + r.width));
  const maxY = Math.max(...boxes.map((r) => r.y + r.height));
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function ScrollableMap({
  players,
  deadBodies,
  currentPlayer,
  onPlayerMove,
  spotlightedPlayer,
  onSpotlightPlayer,
  activeSabotage = 0,
  gamePhase = 0,
}: ScrollableMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [playerPositions, setPlayerPositions] = useState<Record<string, PlayerPosition>>({});
  const playerPositionsRef = useRef<Record<string, PlayerPosition>>({});
  const [zoom, setZoom] = useState(0.4); 
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lastDeadBodiesCount, setLastDeadBodiesCount] = useState(deadBodies.length);
  const [killFlash, setKillFlash] = useState<Location | null>(null);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null); 

  // 1. Maintain a persistent list of players to prevent UI flicker when WebSocket state is empty
  const [lastKnownPlayers, setLastKnownPlayers] = useState<Player[]>([]);
  
  // Update lastKnownPlayers immediately when players prop changes
  useEffect(() => {
    if (players && players.length > 0) {
      setLastKnownPlayers(players);
    }
  }, [players]);

  // Detect new kills for flash effect
  useEffect(() => {
    if (deadBodies.length > lastDeadBodiesCount) {
      const newBody = deadBodies[deadBodies.length - 1];
      setKillFlash(newBody.location);
      setTimeout(() => setKillFlash(null), 500);
      setLastDeadBodiesCount(deadBodies.length);
    } else if (deadBodies.length < lastDeadBodiesCount) {
      setLastDeadBodiesCount(deadBodies.length);
    }
  }, [deadBodies, lastDeadBodiesCount]);

  // Detect task completions for success pulse
  useEffect(() => {
    players.forEach(p => {
      const prevP = lastKnownPlayers.find(lp => lp.address === p.address);
      if (prevP && p.tasksCompleted > prevP.tasksCompleted) {
        setTaskSuccess(p.address);
        setTimeout(() => setTaskSuccess(null), 2000);
      }
    });
  }, [players, lastKnownPlayers]);

  // 2. Synchronize physics engine (playerPositionsRef) with authoritative players list
  useEffect(() => {
    const next = { ...playerPositionsRef.current };
    let changed = false;

    // Use current players prop primarily, but fall back to lastKnownPlayers if prop is empty
    const sourcePlayers = players.length > 0 ? players : lastKnownPlayers;

    sourcePlayers.forEach((player) => {
      const addr = player.address as string;
      
      // Cleanup dead players from visual tracking
      if (!player.isAlive) {
        if (next[addr]) {
          delete next[addr];
          changed = true;
        }
        return;
      }

      const room = ROOMS[player.location];
      if (!room) return;

      const stableIdx = getStableIndex(addr);
      const offsetX = ((stableIdx % 3) - 1) * 60;
      const offsetY = (Math.floor(stableIdx / 3) % 2) * 50;
      const targetX = room.center.x + offsetX;
      const targetY = room.center.y + offsetY;

      // Case A: New player appears (Initial Spawn)
      if (!next[addr]) {
        next[addr] = {
          x: targetX,
          y: targetY,
          waypoints: [],
          currentWaypointIndex: 0,
          isMoving: false,
          facingLeft: false,
          lastLocation: player.location,
          stableIdx
        };
        changed = true;
      } 
      // Case B: Player moved to a new room
      else if (next[addr].lastLocation !== player.location) {
        const prevLoc = next[addr].lastLocation;
        const currLoc = player.location;
        
        // TELEPORT DETECTION: Snap if it's the Discussion (4) phase (meeting called)
        const isTeleport = gamePhase === 4 && currLoc === Location.Cafeteria;

        if (isTeleport) {
           next[addr] = {
             ...next[addr],
             x: targetX,
             y: targetY,
             waypoints: [],
             isMoving: false,
             lastLocation: currLoc
           };
        } else {
          // Normal walking pathfinding
          const roomPath = findPath(prevLoc, currLoc);
          
          // Apply corridor offsets for parallel lanes
          const offsetPath = roomPath.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY
          }));
          
          // Add final destination inside the room
          offsetPath.push({ x: targetX, y: targetY });

          // Deduplicate to avoid stutter at waypoint transition
          const finalPath = deduplicateWaypoints(offsetPath);

          // Determine starting waypoint: if we are already moving, we should skip 
          // waypoints that take us backwards to the start of the current room
          let startIdx = 0;
          if (next[addr].isMoving && finalPath.length > 1) {
             // If first waypoint is where we supposedly started but we're already away from it, skip it
             const distToFirst = Math.sqrt(Math.pow(next[addr].x - finalPath[0].x, 2) + Math.pow(next[addr].y - finalPath[0].y, 2));
             if (distToFirst < 50) startIdx = 1;
          }

          next[addr] = {
            ...next[addr],
            waypoints: finalPath,
            currentWaypointIndex: startIdx,
            isMoving: true,
            lastLocation: currLoc
          };
        }
        changed = true;
      }
    });

    // Cleanup players who are no longer in the source list (e.g. left room)
    Object.keys(next).forEach(addr => {
      const stillExists = sourcePlayers.find(p => p.address === addr);
      if (!stillExists) {
        delete next[addr];
        changed = true;
      }
    });

    if (changed) {
      playerPositionsRef.current = next;
      setPlayerPositions({ ...next });
    }
  }, [players, lastKnownPlayers]);

  // Animation loop (authoritative physics engine)
  useEffect(() => {
    const speed = 10;
    const interval = setInterval(() => {
      // 1. Working copy from physics ref
      const current = { ...playerPositionsRef.current };
      let hasChanges = false;

      // 2. Resolve physics for every active entity
      Object.keys(current).forEach(addr => {
        const pos = current[addr];
        if (!pos?.isMoving || pos.waypoints.length === 0) return;

        const target = pos.waypoints[pos.currentWaypointIndex];
        if (!target) {
          current[addr] = { ...pos, isMoving: false, waypoints: [] };
          hasChanges = true;
          return;
        }

        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < speed) {
          // Snap logic for waypoints
          if (pos.currentWaypointIndex >= pos.waypoints.length - 1) {
            current[addr] = { ...pos, x: target.x, y: target.y, isMoving: false, waypoints: [] };
          } else {
            current[addr] = { ...pos, x: target.x, y: target.y, currentWaypointIndex: pos.currentWaypointIndex + 1 };
          }
          hasChanges = true;
        } else {
          // Continuous vector movement
          current[addr] = {
            ...pos,
            x: pos.x + (dx / dist) * speed,
            y: pos.y + (dy / dist) * speed,
            facingLeft: dx < 0,
          };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        // 3. Re-synchronize authoritative ref and React render state
        playerPositionsRef.current = current;
        setPlayerPositions(current);
      }
    }, 16);

    return () => clearInterval(interval);
  }, []);


  // Center camera on spotlighted/followed player
  const currentPlayerData = lastKnownPlayers.find(p => p.address === currentPlayer);
  const followedPlayer = spotlightedPlayer
    ? lastKnownPlayers.find(p => p.address === spotlightedPlayer)
    : currentPlayerData;

  // Centre the ship once, so a spectator — or a player whose seat is dead and therefore has
  // no position to follow — sees the ship instead of an empty corner of the canvas.
  const didInitialCentre = useRef(false);
  useEffect(() => {
    if (didInitialCentre.current || !containerRef.current) return;
    const { cx, cy } = shipBounds();
    didInitialCentre.current = true;
    setPan({
      x: -cx * zoom + containerRef.current.clientWidth / 2,
      y: -cy * zoom + containerRef.current.clientHeight / 2,
    });
  }, [zoom]);

  // Auto-pan to followed player
  useEffect(() => {
    if (!containerRef.current) return;
    // Nobody to follow (spectating, or your seat is gone): hold the ship centred rather than
    // drifting off to the origin.
    if (!followedPlayer) {
      const { cx, cy } = shipBounds();
      setPan({
        x: -cx * zoom + containerRef.current.clientWidth / 2,
        y: -cy * zoom + containerRef.current.clientHeight / 2,
      });
      return;
    }
    const pos = playerPositions[followedPlayer.address];
    if (!pos) return;

    // Center point in map coordinates
    const targetX = -pos.x * zoom + containerRef.current.clientWidth / 2;
    const targetY = -pos.y * zoom + containerRef.current.clientHeight / 2;
    
    setPan({ x: targetX, y: targetY });
  }, [followedPlayer?.location, spotlightedPlayer, zoom]);

  // 4. Smooth Camera Follow with LERP
  const panRef = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);

  useEffect(() => {
    if (!spotlightedPlayer) return;
    
    const interval = setInterval(() => {
      const pos = playerPositionsRef.current[spotlightedPlayer];
      if (!pos || !containerRef.current) return;

      const targetPanX = -pos.x * zoom + containerRef.current.clientWidth / 2;
      const targetPanY = -pos.y * zoom + containerRef.current.clientHeight / 2;
      
      // LERP factor (0.15 = 15% move towards target every 16ms)
      const lerp = 0.15;
      
      setPan(prev => ({
        x: prev.x + (targetPanX - prev.x) * lerp,
        y: prev.y + (targetPanY - prev.y) * lerp,
      }));
    }, 16); 
    
    return () => clearInterval(interval);
  }, [spotlightedPlayer, zoom]);

  const handleRoomClick = (loc: Location) => {
    if (onPlayerMove && loc !== currentPlayerData?.location) {
      onPlayerMove(loc);
    }
  };

  const handleZoom = (delta: number, centerX?: number, centerY?: number) => {
    setZoom(prev => {
      const newZoom = Math.min(Math.max(prev + delta, 0.15), 1.5);
      
      // If we have center coordinates, adjust pan to zoom towards mouse/center
      if (centerX !== undefined && centerY !== undefined && containerRef.current) {
        setPan(prevPan => {
          const ratio = newZoom / prev;
          return {
            x: centerX - (centerX - prevPan.x) * ratio,
            y: centerY - (centerY - prevPan.y) * ratio,
          };
        });
      }
      return newZoom;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleZoom(e.deltaY > 0 ? -0.05 : 0.05, e.clientX, e.clientY);
    } else {
      // Normal panning with wheel
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-[#050510] cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
    >
      {/* Zoom Controls Overlay */}
      <div className="absolute top-24 left-6 z-50 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={() => handleZoom(0.1)}
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 border-2 border-gray-600 rounded-lg flex items-center justify-center text-white font-bold transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(-0.1)}
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 border-2 border-gray-600 rounded-lg flex items-center justify-center text-white font-bold transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <div className="text-xs text-white/50 text-center font-mono">{Math.round(zoom * 100)}%</div>
      </div>


      <motion.div
        drag
        dragMomentum={true}
        dragTransition={{ power: 0.3, timeConstant: 200 }}
        dragElastic={0.05}
        onDrag={(e, info) => {
          setPan(prev => ({
            x: prev.x + info.delta.x,
            y: prev.y + info.delta.y
          }));
        }}
        className="relative pointer-events-auto"
        style={{
          width: MAP_WIDTH,
          height: MAP_HEIGHT,
          x: pan.x,
          y: pan.y,
          scale: zoom,
          transformOrigin: '0 0',
          cursor: 'inherit',
        }}
      >
          {/* Background */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0d0d1a 40%, #050508 100%)' }}
          />

          {/* Stars - varied sizes and twinkle */}
          {[...Array(400)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: (i * 7919) % MAP_WIDTH,
                top: (i * 6271) % MAP_HEIGHT,
                width: (i % 4) + 1,
                height: (i % 4) + 1,
                backgroundColor: i % 10 === 0 ? '#fef3c7' : i % 7 === 0 ? '#bfdbfe' : '#ffffff',
              }}
              animate={i % 5 === 0 ? { opacity: [0.2, 0.8, 0.2] } : { opacity: 0.15 + (i % 4) * 0.12 }}
              transition={i % 5 === 0 ? { duration: 1.5 + (i % 3), repeat: Infinity } : undefined}
            />
          ))}

          {/* Distant nebula effects */}
          <div
            className="absolute rounded-full opacity-10 blur-3xl"
            style={{
              left: 500, top: 300, width: 600, height: 400,
              background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)'
            }}
          />
          <div
            className="absolute rounded-full opacity-10 blur-3xl"
            style={{
              left: 1800, top: 1000, width: 500, height: 500,
              background: 'radial-gradient(ellipse, #06b6d4 0%, transparent 70%)'
            }}
          />
          <div
            className="absolute rounded-full opacity-8 blur-3xl"
            style={{
              left: 200, top: 1400, width: 400, height: 300,
              background: 'radial-gradient(ellipse, #f43f5e 0%, transparent 70%)'
            }}
          />

          {/* Space windows on hull edges */}
          {SPACE_WINDOWS.map((w, i) => (
            <SpaceWindow key={`sw-${i}`} x={w.x} y={w.y} width={w.width} height={w.height} />
          ))}

          {/* Hull panels decoration */}
          <HullPanel x={100} y={50} width={80} height={40} />
          <HullPanel x={2700} y={50} width={80} height={40} />
          <HullPanel x={100} y={3000} width={80} height={40} />
          <HullPanel x={2700} y={3000} width={80} height={40} />

          {/* Corridors - base layer */}
          {CORRIDORS.map((c, i) => (
            <div
              key={`c-${i}`}
              className="absolute rounded-lg overflow-hidden"
              style={{
                left: c.x, top: c.y, width: c.width, height: c.height,
                backgroundColor: '#252535',
                border: '4px solid #1a1a28',
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* Floor tiles pattern */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: c.direction === 'horizontal'
                    ? 'repeating-linear-gradient(90deg, #1a1a2e 0, #1a1a2e 1px, transparent 1px, transparent 30px), repeating-linear-gradient(0deg, #1a1a2e 0, #1a1a2e 1px, transparent 1px, transparent 30px)'
                    : 'repeating-linear-gradient(90deg, #1a1a2e 0, #1a1a2e 1px, transparent 1px, transparent 30px), repeating-linear-gradient(0deg, #1a1a2e 0, #1a1a2e 1px, transparent 1px, transparent 30px)',
                  backgroundSize: '30px 30px'
                }}
              />
              {/* Subtle lighting gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background: c.direction === 'horizontal'
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.1) 100%)'
                    : 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.1) 100%)'
                }}
              />
            </div>
          ))}

          {/* Corridor floor details (arrows, lines) */}
          {CORRIDORS.map((c, i) => (
            <CorridorDetails key={`cd-${i}`} x={c.x} y={c.y} width={c.width} height={c.height} direction={c.direction} />
          ))}

          {/* Corridor pipes */}
          {CORRIDORS.map((c, i) => (
            <CorridorPipes key={`cp-${i}`} x={c.x} y={c.y} width={c.width} height={c.height} direction={c.direction} />
          ))}

          {/* Curved Corridor Corners - smooth visual transitions at junctions */}
          {/* Storage vertical to horizontal junction (bottom-left L-curve) */}
          <svg className="absolute pointer-events-none" style={{ left: 2300, top: 4050, width: 200, height: 200 }}>
            <path
              d="M 0 0 Q 0 200 200 200"
              fill="#252535"
              stroke="#1a1a28"
              strokeWidth="4"
            />
            <path
              d="M 10 10 Q 10 190 190 190"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              opacity="0.4"
            />
          </svg>

          {/* Vents */}
          {VENTS.map((v, i) => (
            <VentGrate key={`v-${i}`} x={v.x} y={v.y} size={50} />
          ))}

          {/* Wall lights */}
          {WALL_LIGHTS.map((l, i) => (
            <WallLight key={`wl-${i}`} x={l.x} y={l.y} color={l.color} />
          ))}

          {/* Hazard stripes near dangerous areas (Reactor at y=2420) */}
          <HazardStripes x={350} y={2400} width={200} height={18} />
          <HazardStripes x={80} y={2400} width={18} height={120} direction="vertical" />
          <HazardStripes x={780} y={2400} width={18} height={120} direction="vertical" />

          {/* Rooms */}
          {Object.entries(ROOMS).map(([locStr, room]) => {
            const loc = parseInt(locStr) as Location;
            const isCurrent = currentPlayerData?.location === loc;

            return (
              <motion.div
                key={loc}
                className="absolute cursor-pointer rounded-2xl overflow-hidden z-[10]"
                style={{ left: room.x, top: room.y, width: room.width, height: room.height }}
                onClick={() => handleRoomClick(loc)}
                whileHover={{ scale: 1.008 }}
              >
                {/* Room outer glow when current */}
                {isCurrent && (
                  <motion.div
                    className="absolute -inset-2 rounded-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.3) 0%, transparent 70%)' }}
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {/* Floor base with gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, ${room.floorColor} 0%, ${room.color} 100%)`,
                    border: isCurrent ? '5px solid #fbbf24' : '4px solid #1a1a28',
                    borderRadius: 16,
                    boxShadow: isCurrent
                      ? '0 0 60px rgba(251,191,36,0.5), inset 0 0 50px rgba(0,0,0,0.4)'
                      : '0 8px 32px rgba(0,0,0,0.4), inset 0 0 50px rgba(0,0,0,0.4)',
                  }}
                />

                {/* Floor tile pattern */}
                <div
                  className="absolute inset-4 opacity-20"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)',
                    backgroundSize: '35px 35px',
                  }}
                />

                {/* Floor shine effect */}
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
                    borderRadius: 12,
                  }}
                />

                {/* Header with better styling */}
                <div
                  className="absolute top-0 left-0 right-0 h-14 flex items-center justify-center rounded-t-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(180deg, ${room.color} 0%, ${room.color}dd 100%)`,
                    borderBottom: '3px solid rgba(0,0,0,0.3)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  {/* Header shine */}
                  <div className="absolute inset-0 opacity-20" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%)'
                  }} />
                  <span className="text-white text-xl font-black tracking-widest relative" style={{
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
                    letterSpacing: '0.15em'
                  }}>
                    {room.name}
                  </span>
                </div>

                {/* Corner accents */}
                <div className="absolute bottom-2 left-2 w-8 h-8 border-l-3 border-b-3 border-gray-600/30 rounded-bl-lg" />
                <div className="absolute bottom-2 right-2 w-8 h-8 border-r-3 border-b-3 border-gray-600/30 rounded-br-lg" />

                {/* Decorations */}
                <RoomDecor location={loc} w={room.width} h={room.height} />
              </motion.div>
            );
          })}

          {/* Dead bodies */}
          {deadBodies.filter(b => !b.reported).map((body, i) => {
            const victim = players.find(p => p.address === body.victim);
            const room = ROOMS[body.location];
            return (
              <div
                key={`body-${body.victim}`}
                className="absolute z-[20]"
                style={{ left: room.center.x - 40 + i * 50, top: room.center.y + 40 }}
              >
                <DeadBodySprite colorId={victim?.colorId || 0} size={80} />
              </div>
            );
          })}

          {/* Players */}
          {lastKnownPlayers.filter(p => p.isAlive).map(player => {
            const pos = playerPositions[player.address];
            if (!pos) return null;

            const isMe = player.address === currentPlayer;
            const isFollowed = player.address === spotlightedPlayer;
            const now = Date.now();
            
            // Add jitter if stationary
            const jitterY = pos.isMoving ? 0 : Math.sin(now / 400 + player.address.length) * 4;

            return (
              <motion.div
                key={player.address}
                className="absolute z-[30] cursor-pointer"
                animate={{
                  left: pos.x - 40,
                  top: pos.y - 70 + jitterY,
                }}
                transition={{
                  type: "tween",
                  ease: "linear",
                  duration: 0.1,
                }}
                onClick={e => {
                  e.stopPropagation();
                  onSpotlightPlayer?.(isFollowed ? null : player.address);
                }}
                whileHover={{ scale: 1.1 }}
              >
                {isFollowed && (
                  <motion.div
                    className="absolute -inset-8 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)' }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0.3, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {(isMe || isFollowed) && (
                  <motion.div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {isFollowed && (
                      <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                        FOLLOWING
                      </div>
                    )}
                    <svg width="16" height="12" viewBox="0 0 16 12">
                      <path d="M8 12L0 0h16L8 12z" fill={isFollowed ? '#fbbf24' : '#22c55e'} />
                    </svg>
                  </motion.div>
                )}

                <div style={{ transform: pos.facingLeft ? 'scaleX(-1)' : 'scaleX(1)' }}>
                  <AmongUsSprite
                    colorId={player.colorId}
                    size={80}
                    showName
                    name={
                      (gamePhase === 7 && player.role === 2) 
                        ? `${isMe ? "You" : PlayerColors[player.colorId].name} [IMPOSTOR]` 
                        : (isMe ? "You" : PlayerColors[player.colorId].name)
                    }
                    isMoving={pos.isMoving}
                    isGhost={!player.isAlive}
                    isImpostor={gamePhase === 7 && player.role === 2}
                  />
                  {/* Task Success Indicator */}
                  <AnimatePresence>
                    {taskSuccess === player.address && (
                      <motion.div
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: -60, scale: 1.2 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl"
                      >
                         <div className="bg-emerald-500 rounded-full p-1 shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                            </svg>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
      </motion.div>

      {/* Sabotage Overlays */}
      <SabotageOverlay activeSabotage={activeSabotage} gamePhase={gamePhase} killFlashLocation={killFlash} />

      {/* Mini-map */}
      <div className="fixed bottom-4 right-4 w-64 h-52 bg-gradient-to-b from-gray-900 to-black rounded-xl border-2 border-gray-600 p-2 z-50" style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.5)'
      }}>
        {/* Mini-map header */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-800 px-3 py-0.5 rounded-full border border-gray-600">
          <span className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">Agent Radar</span>
        </div>

        <div className="relative w-full h-full mt-1">
          {/* Scan line effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(34, 197, 94, 0.3) 50%, transparent 100%)',
              height: '30%'
            }}
            animate={{ y: ['0%', '250%', '0%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />

          {/* Corridors on minimap */}
          {CORRIDORS.map((c, i) => (
            <div
              key={`mc-${i}`}
              className="absolute bg-gray-700/80 rounded-sm"
              style={{
                left: `${(c.x / MAP_WIDTH) * 100}%`,
                top: `${(c.y / MAP_HEIGHT) * 100}%`,
                width: `${(c.width / MAP_WIDTH) * 100}%`,
                height: `${(c.height / MAP_HEIGHT) * 100}%`,
              }}
            />
          ))}

          {Object.entries(ROOMS).map(([locStr, room]) => {
            const loc = parseInt(locStr) as Location;
            const isFollowed = followedPlayer?.location === loc;
            const isCurrent = currentPlayerData?.location === loc;

            return (
              <motion.div
                key={`mr-${loc}`}
                className="absolute rounded"
                style={{
                  left: `${(room.x / MAP_WIDTH) * 100}%`,
                  top: `${(room.y / MAP_HEIGHT) * 100}%`,
                  width: `${(room.width / MAP_WIDTH) * 100}%`,
                  height: `${(room.height / MAP_HEIGHT) * 100}%`,
                  backgroundColor: isFollowed ? '#fbbf24' : isCurrent ? '#22c55e' : '#4b5563',
                  border: isFollowed ? '2px solid #fbbf24' : isCurrent ? '2px solid #22c55e' : '1px solid #374151',
                  boxShadow: isFollowed || isCurrent ? `0 0 8px ${isFollowed ? '#fbbf24' : '#22c55e'}` : 'none'
                }}
                animate={isFollowed ? { opacity: [0.7, 1, 0.7] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
            );
          })}

          {/* Agent dots with glow */}
          {lastKnownPlayers.filter(p => p.isAlive).map(player => {
            const pos = playerPositions[player.address];
            if (!pos) return null;
            const isSpotlighted = player.address === spotlightedPlayer;
            return (
              <motion.div
                key={`mp-${player.address}`}
                className="absolute rounded-full"
                style={{
                  left: `${(pos.x / MAP_WIDTH) * 100}%`,
                  top: `${(pos.y / MAP_HEIGHT) * 100}%`,
                  width: isSpotlighted ? 10 : 8,
                  height: isSpotlighted ? 10 : 8,
                  backgroundColor: PlayerColors[player.colorId].hex,
                  border: isSpotlighted ? '2px solid #fbbf24' : '1px solid #000',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: `0 0 6px ${PlayerColors[player.colorId].hex}`
                }}
                animate={pos.isMoving ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
              />
            );
          })}

          {/* Dead body indicators */}
          {deadBodies.filter(b => !b.reported).map((body, i) => {
            const room = ROOMS[body.location];
            return (
              <motion.div
                key={`mb-${i}`}
                className="absolute w-2 h-2 bg-red-600 rounded-full"
                style={{
                  left: `${((room.center.x + i * 20) / MAP_WIDTH) * 100}%`,
                  top: `${((room.center.y + 20) / MAP_HEIGHT) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            );
          })}

          {/* Ship label */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-1">
            <span className="text-[9px] text-gray-500 font-bold tracking-wider">THE SKELD</span>
            <span className="text-[8px] text-gray-600">MIRA HQ</span>
          </div>
        </div>
      </div>

      {/* Follow panel */}
      {spotlightedPlayer && followedPlayer && (
        <motion.div
          className="fixed top-4 left-4 bg-black/90 rounded-xl border-2 border-yellow-500 p-3 z-50"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <div className="flex items-center gap-3">
            <AmongUsSprite colorId={followedPlayer.colorId} size={50} showShadow={false} />
            <div>
              <div className="text-yellow-400 text-[10px] font-bold">FOLLOWING</div>
              <div className="text-white font-bold">{PlayerColors[followedPlayer.colorId].name}</div>
              <div className="text-gray-400 text-xs">{LocationNames[followedPlayer.location]}</div>
              {playerPositions[spotlightedPlayer]?.isMoving && (
                <div className="text-green-400 text-[10px] animate-pulse">● Walking...</div>
              )}
            </div>
            <button
              className="ml-2 w-7 h-7 bg-red-600 hover:bg-red-500 rounded-full text-white font-bold"
              onClick={() => onSpotlightPlayer?.(null)}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}

      <div className="fixed bottom-4 left-4 bg-black/80 rounded-lg px-3 py-2 text-gray-400 text-xs z-50">
        Scroll to explore • Click player to follow • Click room to move
      </div>
    </div>
  );
}

// Sabotage Visual Effects Component
function SabotageOverlay({ 
  activeSabotage, 
  gamePhase, 
  killFlashLocation 
}: { 
  activeSabotage?: number; 
  gamePhase?: number;
  killFlashLocation: Location | null;
}) {
  const isLightsOut = activeSabotage === 1; // SabotageType.Lights
  const isCritical = activeSabotage === 2 || activeSabotage === 3; // Reactor or O2
  const isCommsOut = activeSabotage === 4;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <AnimatePresence>
        {/* Lights Out Effect */}
        {isLightsOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85"
            style={{
              maskImage: 'radial-gradient(circle at 50% 50%, transparent 150px, black 350px)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 150px, black 350px)',
            }}
          />
        )}

        {/* Kill Flash (Brief Red) */}
        {killFlashLocation !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-600/40 z-50 pointer-events-none"
          />
        )}

        {/* Critical Alarm Pulse (Reactor/O2) */}
        {isCritical && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.3, 0],
              transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
            }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-600/20 mix-blend-overlay shadow-[inset_0_0_100px_rgba(220,38,38,0.5)]"
          />
        )}

        {/* Comms Glitch Effect */}
        {isCommsOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              transition: { duration: 0.2, repeat: Infinity }
            }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-cyan-900/10 mix-blend-color-dodge"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 255, 0.05) 1px, rgba(0, 255, 255, 0.05) 2px)'
            }}
          />
        )}
        
        {/* Meeting / Body Discovery Overlays */}
        {(gamePhase === 4 || gamePhase === 5) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-50"
          >
             <motion.div 
               initial={{ scale: 0.8, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="bg-red-600/20 p-12 rounded-[3rem] border-2 border-red-500/50 backdrop-blur-3xl flex flex-col items-center"
             >
               <div className="text-8xl font-black text-white uppercase tracking-tighter mb-4">
                 {gamePhase === 4 ? "DISCUSSION" : "VOTING"}
               </div>
               <div className="text-xl font-black text-red-500 uppercase tracking-[0.5em] animate-pulse">
                 Sect Integrity Compromised
               </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Detailed cartoonish room decorations
function RoomDecor({ location, w, h }: { location: Location; w: number; h: number }) {
  const cx = w / 2;
  const cy = h / 2 + 20;

  switch (location) {
    case Location.Cafeteria:
      return (
        <div className="absolute inset-0 pt-16 px-8">
          {/* Checkered floor pattern */}
          <div className="absolute inset-0 top-14 opacity-20" style={{
            backgroundImage: 'repeating-conic-gradient(#374151 0% 25%, #4b5563 0% 50%)',
            backgroundSize: '40px 40px'
          }} />

          {/* Three oval tables with chairs */}
          {[
            { x: cx - 170, y: cy - 40 },
            { x: cx + 40, y: cy - 40 },
            { x: cx - 65, y: cy + 80 }
          ].map((pos, i) => (
            <div key={i} className="absolute" style={{ left: pos.x, top: pos.y }}>
              {/* Table */}
              <div className="w-32 h-22 rounded-full bg-gradient-to-b from-blue-300 to-blue-500 border-4 border-blue-700 shadow-lg" style={{
                boxShadow: '0 8px 16px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3)'
              }}>
                {/* Table shine */}
                <div className="absolute top-2 left-4 w-8 h-4 bg-white/30 rounded-full blur-sm" />
              </div>
              {/* Chairs around table */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full border-2 border-gray-700" />
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full border-2 border-gray-700" />
              <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full border-2 border-gray-700" />
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full border-2 border-gray-700" />
            </div>
          ))}

          {/* Emergency button pedestal */}
          <div className="absolute" style={{ left: cx - 40, top: cy - 20 }}>
            <div className="w-20 h-6 bg-gradient-to-b from-gray-500 to-gray-700 rounded-sm border-2 border-gray-800" />
            <div className="w-18 h-18 -mt-1 mx-auto bg-gradient-to-b from-gray-400 to-gray-600 rounded-lg border-4 border-gray-700 flex items-center justify-center" style={{
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <motion.div
                className="w-12 h-12 rounded-full border-4 border-red-900 flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #ef4444 0%, #b91c1c 100%)',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.5), inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 4px 8px rgba(255,255,255,0.3)'
                }}
                animate={{ boxShadow: ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 35px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)'] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="text-white text-[8px] font-black">!</span>
              </motion.div>
            </div>
            <div className="text-gray-300 text-[10px] font-bold text-center mt-2">EMERGENCY</div>
          </div>

          {/* Vending machine */}
          <div className="absolute right-10 top-20 w-16 h-28 bg-gradient-to-b from-red-600 to-red-800 rounded-lg border-3 border-red-900" style={{
            boxShadow: '4px 4px 12px rgba(0,0,0,0.4)'
          }}>
            <div className="w-12 h-16 mx-auto mt-2 bg-gray-900 rounded border border-gray-700" />
            <div className="flex justify-center gap-1 mt-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <div className="w-3 h-3 bg-green-400 rounded-full" />
            </div>
          </div>

          {/* Trash can */}
          <div className="absolute left-10 bottom-20 w-10 h-14 bg-gradient-to-b from-gray-500 to-gray-700 rounded-b-lg border-2 border-gray-800">
            <div className="w-12 h-2 -ml-1 bg-gray-600 rounded-t-lg border-2 border-gray-800" />
          </div>
        </div>
      );

    case Location.Electrical:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Dark floor with cable channels */}
          <div className="absolute inset-0 top-14 opacity-30" style={{
            backgroundImage: 'linear-gradient(90deg, #1f2937 0px, #1f2937 2px, transparent 2px, transparent 20px)',
            backgroundSize: '20px 100%'
          }} />

          {/* Main electrical panel with lights */}
          <div className="absolute left-6 top-20 w-24 h-44 bg-gradient-to-b from-gray-600 to-gray-800 rounded-lg border-4 border-gray-900" style={{
            boxShadow: '4px 4px 16px rgba(0,0,0,0.5)'
          }}>
            <div className="text-gray-400 text-[9px] font-bold text-center mt-1">POWER GRID</div>
            <div className="grid grid-cols-4 gap-1 p-2 mt-1">
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-4 h-4 rounded-full border border-gray-900"
                  style={{ backgroundColor: ['#ef4444', '#22c55e', '#eab308', '#3b82f6'][i % 4] }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            {/* Switches */}
            <div className="flex justify-center gap-2 mt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-4 h-8 bg-gray-700 rounded border border-gray-900">
                  <div className="w-3 h-3 mx-auto mt-1 bg-gray-500 rounded-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Wire panel */}
          <div className="absolute right-6 top-20 w-28 h-40 bg-gray-900 rounded-lg border-4 border-gray-700 overflow-hidden" style={{
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
          }}>
            <div className="text-yellow-500 text-[10px] font-bold text-center mt-1 mb-2">⚠ WIRES</div>
            {/* Tangled wires */}
            {[
              { color: '#ef4444', top: 25 },
              { color: '#3b82f6', top: 50 },
              { color: '#eab308', top: 75 },
              { color: '#22c55e', top: 100 },
              { color: '#a855f7', top: 125 }
            ].map((wire, i) => (
              <div
                key={i}
                className="absolute h-3 rounded-full"
                style={{
                  backgroundColor: wire.color,
                  top: wire.top,
                  left: 8,
                  right: 8,
                  boxShadow: `0 2px 4px ${wire.color}66`
                }}
              />
            ))}
          </div>

          {/* Breaker box */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-16 w-32 h-20 bg-gradient-to-b from-yellow-600 to-yellow-800 rounded border-4 border-yellow-900">
            <div className="text-black text-[9px] font-bold text-center mt-1">DANGER</div>
            <div className="flex justify-center gap-3 mt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-5 h-8 bg-gray-800 rounded border border-gray-900" />
              ))}
            </div>
          </div>

          {/* Caution sign */}
          <div className="absolute right-6 bottom-20 w-12 h-12 rotate-45 bg-yellow-400 border-4 border-yellow-600 flex items-center justify-center">
            <span className="text-black text-xl font-black -rotate-45">⚡</span>
          </div>
        </div>
      );

    case Location.MedBay:
      return (
        <div className="absolute inset-0 pt-20 px-4">
          {/* Clean tile floor */}
          <div className="absolute inset-0 top-14 opacity-20" style={{
            backgroundImage: 'linear-gradient(#4ade80 1px, transparent 1px), linear-gradient(90deg, #4ade80 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />

          {/* Medical scanner */}
          <div className="absolute" style={{ left: cx - 55, top: cy - 50 }}>
            <div className="w-28 h-40 bg-gradient-to-b from-teal-700 to-teal-900 rounded-xl border-4 border-teal-950 overflow-hidden" style={{
              boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 0 30px rgba(45, 212, 191, 0.2)'
            }}>
              {/* Scanner glass */}
              <div className="w-24 h-32 mx-auto mt-2 bg-teal-950/80 rounded-lg border-2 border-teal-800 overflow-hidden">
                <motion.div
                  className="w-full h-3 bg-gradient-to-b from-teal-400 to-transparent"
                  animate={{ y: [0, 110, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                {/* Body silhouette */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30">
                  <div className="w-6 h-6 bg-teal-400 rounded-full mb-1 mx-auto" />
                  <div className="w-8 h-14 bg-teal-400 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="text-teal-400 text-[11px] font-bold text-center mt-2">MEDSCAN</div>
          </div>

          {/* Medical beds with pillows */}
          {[{ x: 12, y: 24 }, { x: w - 88, y: 24 }].map((pos, i) => (
            <div key={i} className="absolute" style={{ left: pos.x, top: pos.y }}>
              <div className="w-20 h-12 bg-white rounded border-4 border-gray-300" style={{
                boxShadow: '2px 2px 8px rgba(0,0,0,0.2)'
              }}>
                {/* Pillow */}
                <div className="absolute -top-1 left-1 w-6 h-4 bg-blue-100 rounded-sm border border-blue-200" />
                {/* Sheet */}
                <div className="absolute bottom-1 left-2 right-2 h-2 bg-blue-50 rounded-sm" />
              </div>
              {/* IV stand */}
              <div className="absolute -right-4 top-0 w-1 h-16 bg-gray-400">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-500 rounded" />
                <div className="absolute top-0 right-1 w-4 h-6 bg-blue-300 rounded border border-blue-400" />
              </div>
            </div>
          ))}

          {/* Medicine cabinet */}
          <div className="absolute right-8 bottom-20 w-20 h-24 bg-white rounded border-4 border-gray-300" style={{
            boxShadow: '2px 2px 8px rgba(0,0,0,0.2)'
          }}>
            <div className="text-red-500 text-xl text-center mt-1">+</div>
            <div className="grid grid-cols-3 gap-1 p-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-4 h-6 rounded-sm" style={{
                  backgroundColor: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'][i]
                }} />
              ))}
            </div>
          </div>

          {/* Heart monitor */}
          <div className="absolute left-8 bottom-20 w-18 h-16 bg-gray-800 rounded border-2 border-gray-700">
            <motion.svg className="w-full h-12 mt-1" viewBox="0 0 60 30">
              <motion.path
                d="M0,15 L10,15 L15,5 L20,25 L25,15 L35,15 L40,5 L45,25 L50,15 L60,15"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                animate={{ pathLength: [0, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.svg>
          </div>
        </div>
      );

    case Location.Security:
      return (
        <div className="absolute inset-0 pt-20 px-4">
          {/* Dark carpet floor */}
          <div className="absolute inset-0 top-14 bg-gradient-to-b from-indigo-950/50 to-indigo-900/30" />

          {/* Monitor bank */}
          <div className="absolute left-1/2 -translate-x-1/2 top-20 w-[90%] h-20 bg-gray-800 rounded-lg border-4 border-gray-900 p-2" style={{
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}>
            <div className="flex gap-2 justify-center h-full">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-16 h-full bg-gray-950 rounded border-2 border-gray-700 overflow-hidden"
                  style={{ boxShadow: 'inset 0 0 10px rgba(34, 197, 94, 0.2)' }}
                >
                  {/* Camera feed simulation */}
                  <div className="w-full h-full relative">
                    <div className="absolute inset-1 bg-green-950/50 rounded" />
                    <motion.div
                      className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <div className="absolute bottom-1 left-1 text-[6px] text-green-500 font-mono">CAM{i + 1}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Control desk */}
          <div className="absolute left-1/2 -translate-x-1/2 top-44 w-[70%] h-10 bg-gradient-to-b from-gray-600 to-gray-700 rounded-t-lg border-4 border-gray-800">
            {/* Buttons and knobs */}
            <div className="flex justify-center gap-4 mt-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              ))}
            </div>
          </div>

          {/* Office chair */}
          <div className="absolute left-1/2 -translate-x-1/2 top-56 w-16 h-16">
            <div className="w-14 h-10 mx-auto bg-gradient-to-b from-gray-500 to-gray-700 rounded-t-lg border-2 border-gray-800" />
            <div className="w-12 h-4 mx-auto bg-gray-600 rounded-b border-2 border-gray-800" />
            <div className="w-2 h-4 mx-auto bg-gray-700" />
            <div className="w-10 h-2 mx-auto bg-gray-800 rounded-full" />
          </div>

          {/* Wall clock */}
          <div className="absolute right-6 top-20 w-12 h-12 bg-white rounded-full border-4 border-gray-800 flex items-center justify-center">
            <div className="w-1 h-4 bg-gray-800 absolute origin-bottom" style={{ transform: 'rotate(0deg)' }} />
            <div className="w-1 h-3 bg-gray-600 absolute origin-bottom" style={{ transform: 'rotate(90deg)' }} />
          </div>

          {/* Coffee mug */}
          <div className="absolute left-6 bottom-20 w-8 h-10 bg-white rounded-b-lg border-2 border-gray-300">
            <div className="absolute -right-3 top-2 w-3 h-4 border-2 border-gray-300 rounded-r-full" />
            <div className="w-6 h-2 mx-auto mt-1 bg-amber-800 rounded-t-full" />
          </div>
        </div>
      );

    case Location.UpperEngine:
    case Location.LowerEngine:
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
          {/* Metal floor grating */}
          <div className="absolute inset-0 top-14 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #374151 0, #374151 2px, transparent 2px, transparent 8px), repeating-linear-gradient(90deg, #374151 0, #374151 2px, transparent 2px, transparent 8px)',
            backgroundSize: '8px 8px'
          }} />

          {/* Engine housing */}
          <div className="relative">
            {/* Outer ring */}
            <div className="w-44 h-44 rounded-full bg-gradient-to-b from-gray-600 to-gray-800 border-8 border-gray-900 flex items-center justify-center" style={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 4px 16px rgba(0,0,0,0.4)'
            }}>
              {/* Inner engine core */}
              <motion.div
                className="w-32 h-32 rounded-full border-6 border-orange-900 flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 40% 40%, #fbbf24 0%, #f97316 30%, #ea580c 60%, #9a3412 100%)',
                  boxShadow: '0 0 40px rgba(251, 146, 60, 0.6), inset 0 0 30px rgba(0,0,0,0.3)'
                }}
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    '0 0 40px rgba(251, 146, 60, 0.6)',
                    '0 0 60px rgba(251, 146, 60, 0.8)',
                    '0 0 40px rgba(251, 146, 60, 0.6)'
                  ]
                }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                {/* Center bolt */}
                <div className="w-12 h-12 bg-gray-700 rounded-full border-4 border-gray-800 flex items-center justify-center">
                  <div className="w-4 h-4 bg-gray-600 rounded" />
                </div>
              </motion.div>
            </div>

            {/* Fuel gauge */}
            <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-10 h-24 bg-gray-800 rounded border-2 border-gray-900 overflow-hidden">
              <div className="text-[8px] text-gray-400 text-center mt-1">FUEL</div>
              <div className="w-6 h-16 mx-auto mt-1 bg-gray-900 rounded overflow-hidden">
                <motion.div
                  className="w-full bg-gradient-to-t from-green-600 to-green-400"
                  animate={{ height: ['60%', '75%', '60%'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </div>
          </div>

          {/* Engine label */}
          <div className="mt-4 px-4 py-1 bg-gray-800 rounded border-2 border-gray-700">
            <span className="text-orange-400 text-sm font-bold tracking-wider">
              {location === Location.UpperEngine ? 'UPPER' : 'LOWER'} ENGINE
            </span>
          </div>

          {/* Steam vents */}
          {[{ x: 20, y: 60 }, { x: w - 50, y: 60 }].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-8 h-4 bg-gray-700 rounded"
              style={{ left: pos.x, top: pos.y }}
            >
              <motion.div
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-10 bg-gradient-to-t from-gray-400/40 to-transparent rounded-full blur-sm"
                animate={{ opacity: [0, 0.6, 0], y: [0, -20, -40] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
              />
            </motion.div>
          ))}
        </div>
      );

    case Location.Reactor:
      return (
        <div className="absolute inset-0 flex items-center justify-center pt-8">
          {/* Radiation warning floor */}
          <div className="absolute inset-0 top-14" style={{
            background: 'repeating-linear-gradient(45deg, #1f2937 0, #1f2937 20px, #374151 20px, #374151 40px)'
          }} />

          {/* Reactor containment unit */}
          <div className="relative">
            <div className="w-52 h-36 bg-gradient-to-b from-gray-700 to-gray-900 rounded-xl border-6 border-gray-950 flex items-center justify-center" style={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.4)'
            }}>
              {/* Reactor core */}
              <motion.div
                className="w-24 h-24 rounded-full border-6 border-cyan-900 flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 40% 40%, #67e8f9 0%, #06b6d4 30%, #0891b2 60%, #155e75 100%)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 30px #06b6d4, 0 0 60px #06b6d466',
                    '0 0 50px #06b6d4, 0 0 100px #06b6d466',
                    '0 0 30px #06b6d4, 0 0 60px #06b6d466'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {/* Atom symbol */}
                <div className="relative w-16 h-16">
                  {[0, 60, 120].map((rot, i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 border-2 border-cyan-200/50 rounded-full"
                      style={{ transform: `rotate(${rot}deg) scaleY(0.3)` }}
                      animate={{ rotate: [rot, rot + 360] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    />
                  ))}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full" />
                </div>
              </motion.div>

              {/* Side indicators */}
              {[-70, 70].map((x, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: x < 0 ? 10 : undefined, right: x > 0 ? 10 : undefined }}>
                  <motion.div
                    className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-700"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.5 }}
                  />
                </div>
              ))}
            </div>

            {/* Hand scanners */}
            {[-85, w - 15].map((x, i) => (
              <div key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: i === 0 ? -70 : undefined, right: i === 1 ? -70 : undefined }}>
                <div className="w-14 h-20 bg-gradient-to-b from-gray-600 to-gray-800 rounded-lg border-4 border-gray-900">
                  <div className="w-10 h-12 mx-auto mt-1 bg-gray-900 rounded border border-gray-700">
                    <div className="text-red-400 text-[7px] text-center mt-1">SCAN</div>
                    <div className="w-6 h-6 mx-auto mt-1 border-2 border-dashed border-red-500 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning label */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500 rounded">
            <span className="text-black text-[10px] font-bold">☢ REACTOR CORE</span>
          </div>
        </div>
      );

    case Location.Admin:
      return (
        <div className="absolute inset-0 flex flex-col items-center pt-20 px-4">
          {/* Office carpet */}
          <div className="absolute inset-0 top-14 bg-gradient-to-b from-gray-700/30 to-gray-800/30" />

          {/* Admin map table */}
          <div className="relative w-52 h-40 bg-gradient-to-b from-gray-600 to-gray-800 rounded-xl border-6 border-gray-900 flex items-center justify-center" style={{
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            {/* Map display */}
            <div className="w-44 h-32 bg-gray-950 rounded-lg border-4 border-gray-700 overflow-hidden" style={{
              boxShadow: 'inset 0 0 20px rgba(34, 197, 94, 0.2)'
            }}>
              {/* Mini map representation */}
              <div className="relative w-full h-full p-2">
                {/* Room dots */}
                {[
                  { x: '50%', y: '15%', label: 'CAF' },
                  { x: '20%', y: '20%', label: 'ENG' },
                  { x: '35%', y: '25%', label: 'MED' },
                  { x: '15%', y: '45%', label: 'SEC' },
                  { x: '80%', y: '35%', label: 'ADM' },
                  { x: '15%', y: '70%', label: 'ENG' },
                  { x: '40%', y: '75%', label: 'ELC' },
                  { x: '60%', y: '80%', label: 'STR' },
                  { x: '15%', y: '90%', label: 'RCT' },
                ].map((room, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-green-500 rounded-full"
                    style={{ left: room.x, top: room.y, transform: 'translate(-50%, -50%)' }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
                <div className="absolute bottom-1 right-1 text-[8px] text-green-500 font-mono">THE SKELD</div>
              </div>
            </div>
          </div>

          {/* Filing cabinets */}
          {[12, w - 52].map((x, i) => (
            <div key={i} className="absolute top-24" style={{ left: x }}>
              <div className="w-12 h-32 bg-gradient-to-b from-gray-500 to-gray-700 rounded border-4 border-gray-800" style={{
                boxShadow: '2px 2px 8px rgba(0,0,0,0.4)'
              }}>
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="w-10 h-8 mx-auto mt-1 bg-gray-600 rounded-sm border border-gray-800">
                    <div className="w-4 h-1 mx-auto mt-3 bg-gray-400 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Swipe card station */}
          <div className="absolute bottom-16 right-8 w-20 h-14 bg-gray-800 rounded border-2 border-gray-700">
            <div className="text-[8px] text-gray-400 text-center mt-1">CARD READER</div>
            <div className="w-14 h-6 mx-auto mt-1 bg-gray-900 rounded border border-gray-700" />
            <div className="w-8 h-1 mx-auto mt-1 bg-green-500 rounded" />
          </div>
        </div>
      );

    case Location.Storage:
      return (
        <div className="absolute inset-0 pt-20 px-4">
          {/* Concrete floor */}
          <div className="absolute inset-0 top-14 opacity-40" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #374151 0, #374151 2px, transparent 2px, transparent 60px), repeating-linear-gradient(90deg, #374151 0, #374151 2px, transparent 2px, transparent 60px)',
            backgroundSize: '60px 60px'
          }} />

          {/* Stacked crates with details */}
          {[
            { x: 15, y: 24, w: 24, h: 24 },
            { x: 15, y: 54, w: 28, h: 20 },
            { x: w - 95, y: 24, w: 26, h: 26 },
            { x: w - 90, y: 56, w: 22, h: 18 },
            { x: 20, y: h - 120, w: 28, h: 28 },
            { x: w - 100, y: h - 115, w: 24, h: 24 },
            { x: 50, y: h - 95, w: 20, h: 20 },
          ].map((crate, i) => (
            <div
              key={i}
              className="absolute bg-gradient-to-b from-amber-600 to-amber-800 rounded border-4 border-amber-900"
              style={{
                left: crate.x, top: crate.y, width: crate.w, height: crate.h,
                boxShadow: '3px 3px 8px rgba(0,0,0,0.4)'
              }}
            >
              {/* Wood grain lines */}
              <div className="absolute inset-1 opacity-30" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, #92400e 0, #92400e 1px, transparent 1px, transparent 4px)'
              }} />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-950" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-amber-950" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-amber-950" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-950" />
            </div>
          ))}

          {/* Fuel cans */}
          <div className="absolute" style={{ left: cx - 35, top: cy + 20 }}>
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-14 h-20 bg-gradient-to-b from-red-500 to-red-700 rounded-lg border-4 border-red-900" style={{
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.4)'
                }}>
                  <div className="w-6 h-3 mx-auto -mt-1 bg-red-800 rounded-t border-2 border-red-900" />
                  <div className="text-white text-[8px] font-bold text-center mt-4">FUEL</div>
                  <div className="w-8 h-1 mx-auto mt-1 bg-yellow-400 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Forklift */}
          <div className="absolute right-12 bottom-16">
            <div className="w-16 h-10 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-t border-2 border-yellow-700">
              <div className="w-6 h-4 ml-1 mt-1 bg-gray-800 rounded" />
            </div>
            <div className="flex gap-1 mt-1">
              <div className="w-4 h-4 bg-gray-800 rounded-full border-2 border-gray-900" />
              <div className="w-6 h-4 bg-gray-700" />
              <div className="w-4 h-4 bg-gray-800 rounded-full border-2 border-gray-900" />
            </div>
            {/* Forks */}
            <div className="absolute -left-8 bottom-2 w-8 h-1 bg-gray-600 rounded" />
            <div className="absolute -left-8 bottom-4 w-8 h-1 bg-gray-600 rounded" />
          </div>

          {/* Barrel */}
          <div className="absolute left-12 bottom-24 w-12 h-16 bg-gradient-to-r from-gray-600 to-gray-500 rounded-lg border-2 border-gray-700">
            <div className="absolute top-2 left-0 right-0 h-1 bg-gray-700" />
            <div className="absolute bottom-2 left-0 right-0 h-1 bg-gray-700" />
          </div>
        </div>
      );

    case Location.Weapons:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Metal grating floor */}
          <div className="absolute inset-0 top-14 opacity-25" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #1f2937 0, #1f2937 2px, transparent 2px, transparent 15px), repeating-linear-gradient(90deg, #1f2937 0, #1f2937 2px, transparent 2px, transparent 15px)',
            backgroundSize: '15px 15px'
          }} />

          {/* Targeting console */}
          <div className="absolute left-8 top-24 w-32 h-28 bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg border-4 border-gray-800">
            {/* Screen */}
            <div className="w-28 h-20 mx-auto mt-1 bg-gray-950 rounded border-2 border-red-900">
              {/* Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-16 h-16"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute top-1/2 left-0 w-full h-px bg-red-500 opacity-60" />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-red-500 opacity-60" />
                  <div className="absolute top-1/2 left-1/2 w-6 h-6 -ml-3 -mt-3 border-2 border-red-500 rounded-full opacity-80" />
                </motion.div>
              </div>
              {/* Target blips */}
              <motion.div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>

          {/* Asteroid field viewport */}
          <div className="absolute right-8 top-24 w-40 h-32 bg-gradient-to-br from-blue-950 to-black rounded-xl border-4 border-gray-700" style={{
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
          }}>
            {/* Asteroids */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute bg-gray-600 rounded-full"
                style={{
                  left: `${(i * 17 + 10) % 80}%`,
                  top: `${(i * 23 + 15) % 70}%`,
                  width: 8 + (i % 4) * 3,
                  height: 8 + (i % 4) * 3,
                }}
                animate={{ x: [-5, 5], y: [-3, 3] }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, repeatType: "reverse" }}
              />
            ))}
          </div>

          {/* Weapon turret */}
          <div className="absolute bottom-16 left-1/3 w-20 h-24 bg-gradient-to-b from-gray-600 to-gray-800 rounded-t-full border-4 border-gray-900">
            {/* Barrel */}
            <div className="absolute -top-8 left-1/2 -ml-2 w-4 h-12 bg-gray-700 rounded-t" />
            {/* Targeting laser */}
            <motion.div className="absolute -top-4 left-1/2 -ml-1 w-2 h-2 bg-red-500 rounded-full"
              animate={{ opacity: [0.4, 1, 0.4], boxShadow: ['0 0 4px #ef4444', '0 0 12px #ef4444', '0 0 4px #ef4444'] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </div>
      );

    case Location.Navigation:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Navigation grid floor */}
          <div className="absolute inset-0 top-14 opacity-20" style={{
            backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />

          {/* Main navigation console */}
          <div className="absolute left-1/2 -ml-32 top-24 w-64 h-40 bg-gradient-to-b from-blue-900 to-blue-950 rounded-xl border-4 border-blue-800" style={{
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(0,0,0,0.5)'
          }}>
            {/* Star map screen */}
            <div className="w-60 h-32 mx-auto mt-1 bg-black rounded border-2 border-blue-900 overflow-hidden relative">
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }} />
              {/* Stars */}
              {[...Array(25)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: `${(i * 13 + 5) % 90}%`,
                    top: `${(i * 17 + 10) % 80}%`,
                    width: 2 + (i % 3),
                    height: 2 + (i % 3),
                    backgroundColor: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#60a5fa' : '#f472b6',
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2 + i * 0.2, repeat: Infinity }}
                />
              ))}
              {/* Course line */}
              <svg className="absolute inset-0 w-full h-full">
                <path d="M 10 120 Q 120 60 230 20" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.7" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
            {/* Control buttons */}
            <div className="flex justify-center gap-2 mt-2">
              <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-green-700" />
              <div className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-yellow-700" />
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-red-700" />
            </div>
          </div>

          {/* Side panels */}
          <div className="absolute left-6 bottom-20 w-20 h-32 bg-gradient-to-b from-gray-600 to-gray-800 rounded border-3 border-gray-900" />
          <div className="absolute right-6 bottom-20 w-20 h-32 bg-gradient-to-b from-gray-600 to-gray-800 rounded border-3 border-gray-900" />
        </div>
      );

    case Location.Shields:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Hexagonal floor pattern */}
          <div className="absolute inset-0 top-14 opacity-15" style={{
            backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />

          {/* Shield generators (2) */}
          {[{ x: cx - 80, y: cy - 30 }, { x: cx + 40, y: cy - 30 }].map((pos, i) => (
            <div key={i} className="absolute" style={{ left: pos.x, top: pos.y }}>
              {/* Generator base */}
              <div className="w-28 h-36 bg-gradient-to-b from-blue-600 to-blue-800 rounded-lg border-4 border-blue-900" style={{
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)'
              }}>
                {/* Energy core */}
                <motion.div
                  className="absolute top-6 left-1/2 -ml-6 w-12 h-12 rounded-full border-4 border-blue-400"
                  style={{
                    background: 'radial-gradient(circle, #60a5fa 0%, #3b82f6 100%)',
                  }}
                  animate={{
                    opacity: [0.7, 1, 0.7],
                    boxShadow: ['0 0 20px rgba(96, 165, 250, 0.6)', '0 0 40px rgba(96, 165, 250, 1)', '0 0 20px rgba(96, 165, 250, 0.6)']
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {/* Energy bars */}
                <div className="absolute bottom-4 left-2 right-2 space-y-1">
                  {[...Array(4)].map((_, j) => (
                    <motion.div
                      key={j}
                      className="h-1 bg-cyan-400 rounded"
                      animate={{ width: ['80%', '95%', '80%'] }}
                      transition={{ duration: 1.5, delay: j * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Control panel */}
          <div className="absolute bottom-16 left-1/2 -ml-16 w-32 h-24 bg-gradient-to-b from-gray-700 to-gray-900 rounded border-3 border-gray-800">
            <div className="text-blue-400 text-[8px] font-bold text-center mt-1">SHIELD STATUS</div>
            <div className="grid grid-cols-3 gap-1 p-2 mt-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-6 h-6 bg-green-500 rounded border border-green-700 opacity-80" />
              ))}
            </div>
          </div>
        </div>
      );

    case Location.O2:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Industrial floor */}
          <div className="absolute inset-0 top-14 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #1f2937 0, #1f2937 3px, transparent 3px, transparent 12px)',
          }} />

          {/* Large O2 tanks (3) */}
          {[{ x: 15, y: 30 }, { x: w - 75, y: 30 }, { x: cx - 25, y: h - 140 }].map((pos, i) => (
            <div key={i} className="absolute" style={{ left: pos.x, top: pos.y }}>
              <div className="w-16 h-40 bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-full border-4 border-cyan-900" style={{
                boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)'
              }}>
                {/* Valve */}
                <div className="absolute -top-4 left-1/2 -ml-3 w-6 h-6 bg-gray-700 rounded-full border-2 border-gray-900" />
                {/* Warning stripes */}
                <div className="absolute top-8 left-0 right-0 h-3 bg-yellow-400 opacity-80" />
                <div className="absolute top-20 left-0 right-0 h-3 bg-yellow-400 opacity-80" />
                {/* O2 label */}
                <div className="absolute top-1/2 -mt-2 left-0 right-0 text-center text-white text-[10px] font-black">O₂</div>
                {/* Gauge */}
                <motion.div className="absolute bottom-4 left-1/2 -ml-1 w-2 h-8 bg-green-400 rounded-full"
                  animate={{ height: [32, 24, 32] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </div>
          ))}

          {/* Control panel */}
          <div className="absolute top-1/2 left-1/2 -ml-20 -mt-16 w-40 h-32 bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg border-4 border-gray-800">
            <div className="text-cyan-400 text-[9px] font-bold text-center mt-1">OXYGEN LEVELS</div>
            {/* Level indicators */}
            <div className="grid grid-cols-10 gap-px p-2 mt-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className={`h-12 rounded ${i < 8 ? 'bg-green-500' : 'bg-gray-600'}`} />
              ))}
            </div>
          </div>
        </div>
      );

    case Location.Communications:
      return (
        <div className="absolute inset-0 pt-20 px-6">
          {/* Tech floor */}
          <div className="absolute inset-0 top-14 opacity-25" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #4b5563 0, #4b5563 2px, transparent 2px, transparent 20px)',
          }} />

          {/* Satellite dish */}
          <div className="absolute left-8 top-24">
            <svg width="100" height="100">
              {/* Dish */}
              <ellipse cx="50" cy="40" rx="45" ry="25" fill="#6b7280" stroke="#374151" strokeWidth="3" />
              <ellipse cx="50" cy="38" rx="38" ry="20" fill="#9ca3af" />
              <ellipse cx="50" cy="37" rx="25" ry="13" fill="#d1d5db" />
              {/* Mount */}
              <rect x="46" y="60" width="8" height="30" fill="#4b5563" />
              <rect x="40" y="88" width="20" height="6" fill="#374151" />
              {/* Signal waves */}
              <motion.circle cx="50" cy="37" r="8" stroke="#22c55e" strokeWidth="2" fill="none"
                animate={{ r: [8, 25], opacity: [0.8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </svg>
          </div>

          {/* Radio equipment rack */}
          <div className="absolute right-8 top-24 w-28 h-48 bg-gradient-to-b from-gray-700 to-gray-900 rounded border-4 border-gray-800">
            <div className="text-green-400 text-[8px] font-bold text-center mt-1">TRANSMITTER</div>
            {/* Signal bars */}
            <div className="flex justify-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-4 bg-green-500 rounded-t"
                  style={{ height: (i + 1) * 6 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, delay: i * 0.1, repeat: Infinity }}
                />
              ))}
            </div>
            {/* Frequency display */}
            <div className="mt-3 mx-2 h-16 bg-black rounded border border-green-900 flex items-center justify-center">
              <motion.span className="text-green-400 text-xs font-mono font-bold"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                147.3 MHz
              </motion.span>
            </div>
            {/* Blinking lights */}
            <div className="flex justify-center gap-2 mt-2">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: i % 2 === 0 ? '#22c55e' : '#eab308' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </div>
          </div>

          {/* Monitor bank */}
          <div className="absolute bottom-16 left-1/3 space-x-2 flex">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-16 h-20 bg-gray-800 rounded border-2 border-gray-700">
                <div className="w-14 h-14 mx-auto mt-1 bg-black rounded border border-green-900">
                  <motion.div className="text-green-400 text-[6px] font-mono p-1"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                  >
                    {`> SIG ${i + 1}\nOK`}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
