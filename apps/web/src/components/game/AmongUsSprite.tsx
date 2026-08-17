"use client";

import { motion } from "framer-motion";
import { PlayerColors } from "@/types/game";

interface AmongUsSpriteProps {
  colorId: number;
  isAlive?: boolean;
  isGhost?: boolean;
  size?: number;
  direction?: "left" | "right";
  isMoving?: boolean;
  showShadow?: boolean;
  onClick?: () => void;
  name?: string;
  showName?: boolean;
  isImpostor?: boolean;
}

export function AmongUsSprite({
  colorId,
  isAlive = true,
  isGhost = false,
  size = 80,
  direction = "right",
  isMoving = false,
  showShadow = true,
  onClick,
  name,
  showName = false,
  isImpostor = false,
}: AmongUsSpriteProps) {
  const color = PlayerColors[colorId] || PlayerColors[0];
  const scale = size / 80;

  // Walking animation
  const walkAnimation = isMoving ? {
    y: [0, -3, 0],
    transition: {
      duration: 0.3,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  } : undefined;

  return (
    <motion.div
      className="relative flex flex-col items-center cursor-pointer"
      onClick={onClick}
      animate={walkAnimation}
      whileHover={{ scale: 1.05 }}
      style={{
        opacity: isGhost ? 0.5 : 1,
        filter: isGhost ? "brightness(1.5)" : "none"
      }}
    >
      {/* Shadow */}
      {showShadow && isAlive && (
        <div
          className="absolute bottom-0 bg-black/30 rounded-full"
          style={{
            width: size * 0.7,
            height: size * 0.15,
            filter: "blur(2px)"
          }}
        />
      )}

      {/* Character */}
      <svg
        width={size}
        height={size * 1.1}
        viewBox="0 0 80 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: direction === "left" ? "scaleX(-1)" : "none" }}
      >
        {/* Body - Main bean shape */}
        <ellipse
          cx="40"
          cy="48"
          rx="28"
          ry="32"
          fill={color.hex}
        />

        {/* Body outline */}
        <ellipse
          cx="40"
          cy="48"
          rx="28"
          ry="32"
          stroke="#1a1a2e"
          strokeWidth="3"
          fill="none"
        />

        {/* Backpack */}
        <rect
          x="4"
          y="35"
          width="14"
          height="28"
          rx="7"
          fill={color.hex}
        />
        <rect
          x="4"
          y="35"
          width="14"
          height="28"
          rx="7"
          stroke="#1a1a2e"
          strokeWidth="3"
          fill="none"
        />

        {/* Visor */}
        <ellipse
          cx="50"
          cy="35"
          rx="18"
          ry="14"
          fill="#99d9ea"
        />
        <ellipse
          cx="50"
          cy="35"
          rx="18"
          ry="14"
          stroke="#1a1a2e"
          strokeWidth="3"
          fill="none"
        />

        {/* Visor shine */}
        <ellipse
          cx="56"
          cy="30"
          rx="6"
          ry="4"
          fill="#ffffff"
          opacity="0.7"
        />
        <ellipse
          cx="44"
          cy="38"
          rx="3"
          ry="2"
          fill="#ffffff"
          opacity="0.4"
        />

        {/* Left leg */}
        <ellipse
          cx="28"
          cy="78"
          rx="10"
          ry="8"
          fill={color.hex}
        />
        <ellipse
          cx="28"
          cy="78"
          rx="10"
          ry="8"
          stroke="#1a1a2e"
          strokeWidth="3"
          fill="none"
        />

        {/* Right leg */}
        <ellipse
          cx="52"
          cy="78"
          rx="10"
          ry="8"
          fill={color.hex}
        />
        <ellipse
          cx="52"
          cy="78"
          rx="10"
          ry="8"
          stroke="#1a1a2e"
          strokeWidth="3"
          fill="none"
        />

        {/* Dead X if not alive */}
        {!isAlive && (
          <g>
            <line x1="38" y1="28" x2="62" y2="42" stroke="#ff0000" strokeWidth="4" strokeLinecap="round"/>
            <line x1="62" y1="28" x2="38" y2="42" stroke="#ff0000" strokeWidth="4" strokeLinecap="round"/>
          </g>
        )}
      </svg>

      {/* Name tag */}
      {showName && name && (
        <div
          className="absolute -bottom-6 whitespace-nowrap px-2 py-0.5 rounded text-xs font-bold"
          style={{
            backgroundColor: isImpostor ? "rgba(239, 68, 68, 0.9)" : "rgba(0,0,0,0.7)",
            color: isImpostor ? "white" : color.light,
            textShadow: "1px 1px 2px black",
            border: isImpostor ? "1px solid white" : "none"
          }}
        >
          {name}
        </div>
      )}
    </motion.div>
  );
}

// Dead body (half body with bone)
export function DeadBodySprite({
  colorId,
  size = 60,
}: {
  colorId: number;
  size?: number;
}) {
  const color = PlayerColors[colorId] || PlayerColors[0];

  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      className="relative"
    >
      {/* Blood pool */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-800 rounded-full"
        style={{
          width: size * 1.2,
          height: size * 0.3,
          filter: "blur(3px)"
        }}
      />

      <svg
        width={size}
        height={size * 0.7}
        viewBox="0 0 60 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lower body half */}
        <ellipse
          cx="30"
          cy="28"
          rx="22"
          ry="14"
          fill={color.hex}
        />
        <ellipse
          cx="30"
          cy="28"
          rx="22"
          ry="14"
          stroke="#1a1a2e"
          strokeWidth="2"
          fill="none"
        />

        {/* Bone */}
        <ellipse
          cx="30"
          cy="10"
          rx="12"
          ry="6"
          fill="#e8d5b7"
        />
        <circle cx="20" cy="8" r="4" fill="#e8d5b7" />
        <circle cx="40" cy="8" r="4" fill="#e8d5b7" />
        <ellipse
          cx="30"
          cy="10"
          rx="12"
          ry="6"
          stroke="#c9b896"
          strokeWidth="1"
          fill="none"
        />
      </svg>
    </motion.div>
  );
}
