"use client";

import { colorFor } from"@/lib/skeld";

/**
 * The crewmate, ported from the OneChain build's `AmongUsSprite`.
 *
 * Same geometry - bean body, backpack, visor with its two highlights, two legs, the red X on
 * death. The original animated the walk bob with framer-motion; this uses a CSS keyframe
 * instead, which looks identical and keeps a 100 kB dependency out of the bundle.
 */
export function Crewmate({
  seatIndex,
  size = 44,
  alive = true,
  moving = false,
  facing ="right",
  name,
  showName = false,
  highlight = false,
  onCameras = false,
}: {
  seatIndex: number;
  size?: number;
  alive?: boolean;
  moving?: boolean;
  facing?:"left" |"right";
  name?: string;
  showName?: boolean;
  highlight?: boolean;
  onCameras?: boolean;
}) {
  const color = colorFor(seatIndex);

  return (
    <div
      className={`relative flex flex-col items-center ${moving ?"crew-walk" :""}`}
      style={{ opacity: alive ? 1 : 0.45 }}
    >
      {alive && (
        <div
          className="absolute  bg-[var(--color-hull)] blur-[2px]"
          style={{ width: size * 0.7, height: size * 0.15, bottom: 0 }}
        />
      )}

      <svg
        width={size}
        height={size * 1.1}
        viewBox="0 0 80 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: facing ==="left" ?"scaleX(-1)" :"none" }}
      >
        {highlight && (
          <ellipse cx="40" cy="48" rx="34" ry="38" fill="none" stroke="#56d3f0" strokeWidth="4" />
        )}

        {/* Backpack */}
        <rect x="4" y="35" width="14" height="28" rx="7" fill={color.hex} />
        <rect x="4" y="35" width="14" height="28" rx="7" stroke="#1a1a2e" strokeWidth="3" fill="none" />

        {/* Body */}
        <ellipse cx="40" cy="48" rx="28" ry="32" fill={color.hex} />
        <ellipse cx="40" cy="48" rx="28" ry="32" stroke="#1a1a2e" strokeWidth="3" fill="none" />

        {/* Legs */}
        <ellipse cx="28" cy="78" rx="10" ry="8" fill={color.hex} />
        <ellipse cx="28" cy="78" rx="10" ry="8" stroke="#1a1a2e" strokeWidth="3" fill="none" />
        <ellipse cx="52" cy="78" rx="10" ry="8" fill={color.hex} />
        <ellipse cx="52" cy="78" rx="10" ry="8" stroke="#1a1a2e" strokeWidth="3" fill="none" />

        {/* Visor */}
        <ellipse cx="50" cy="35" rx="18" ry="14" fill={onCameras ?"#f5b544" :"#99d9ea"} />
        <ellipse cx="50" cy="35" rx="18" ry="14" stroke="#1a1a2e" strokeWidth="3" fill="none" />
        <ellipse cx="56" cy="30" rx="6" ry="4" fill="#ffffff" opacity="0.7" />
        <ellipse cx="44" cy="38" rx="3" ry="2" fill="#ffffff" opacity="0.4" />

        {!alive && (
          <g>
            <line x1="38" y1="28" x2="62" y2="42" stroke="#ff0000" strokeWidth="4" strokeLinecap="round" />
            <line x1="62" y1="28" x2="38" y2="42" stroke="#ff0000" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </svg>

      {showName && name && (
        <div
          className="absolute -bottom-4 whitespace-nowrap  px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: highlight ?"rgba(86,211,240,0.9)" :"rgba(0,0,0,0.75)",
            color: highlight ?"#05060a" : color.light,
            textShadow: highlight ?"none" :"1px 1px 2px black",
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

/** The half-body-and-bone a kill leaves behind, ported from `DeadBodySprite`. */
export function DeadBody({ seatIndex, size = 34 }: { seatIndex: number; size?: number }) {
  const color = colorFor(seatIndex);
  return (
    <div className="relative">
      <div
        className="absolute left-1/2 -translate-x-1/2  bg-red-900 blur-[3px]"
        style={{ width: size * 1.2, height: size * 0.3, bottom: -4 }}
      />
      <svg width={size} height={size * 0.7} viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="28" rx="22" ry="14" fill={color.hex} />
        <ellipse cx="30" cy="28" rx="22" ry="14" stroke="#1a1a2e" strokeWidth="2" fill="none" />
        <ellipse cx="30" cy="10" rx="12" ry="6" fill="#e8d5b7" />
        <circle cx="20" cy="8" r="4" fill="#e8d5b7" />
        <circle cx="40" cy="8" r="4" fill="#e8d5b7" />
        <ellipse cx="30" cy="10" rx="12" ry="6" stroke="#c9b896" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}
