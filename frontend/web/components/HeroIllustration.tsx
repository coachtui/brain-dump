'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'
import type { CSSProperties } from 'react'

// ── Canvas ──────────────────────────────────────────────────────────────────
const VW = 520
const VH = 290

// ── Wave ribbon field ───────────────────────────────────────────────────────
// Each ribbon is a thick-stroke sine path. Overlapping at low opacity creates
// the layered translucent ribbon appearance from the reference artwork.
//
// 2 oscillation cycles: x 0 → 210, period = 105
// Bezier C-points at ¼ and ¾ period for natural sine approximation.
function wavePath(cy: number, amp: number): string {
  return [
    `M 0,${cy}`,
    `C 26,${cy - amp} 79,${cy + amp} 105,${cy}`,
    `C 131,${cy - amp} 184,${cy + amp} 210,${cy}`,
  ].join(' ')
}

type WaveDef = {
  cy: number   // center y
  amp: number  // oscillation amplitude
  sw: number   // strokeWidth — creates ribbon thickness
  op: number   // opacity — layers stack to create depth
  drift: [number, number]  // idle y keyframe targets
  dd: number   // drift duration (seconds)
}

// Rendered back-to-front: outer wisps first, thick core last
const WAVES: WaveDef[] = [
  { cy: 98,  amp: 11, sw: 2,  op: 0.055, drift: [-2.5,  2.5], dd: 11.2 },
  { cy: 192, amp: 11, sw: 2,  op: 0.055, drift: [ 2.5, -2.5], dd: 11.8 },
  { cy: 114, amp: 17, sw: 5,  op: 0.09,  drift: [-3.0,  3.0], dd: 9.5  },
  { cy: 176, amp: 17, sw: 5,  op: 0.09,  drift: [ 3.0, -3.0], dd: 10.1 },
  { cy: 130, amp: 21, sw: 9,  op: 0.12,  drift: [-3.5,  4.0], dd: 8.3  },
  { cy: 160, amp: 21, sw: 9,  op: 0.12,  drift: [ 4.0, -3.5], dd: 8.8  },
  { cy: 145, amp: 23, sw: 18, op: 0.10,  drift: [-2.5,  4.0], dd: 7.5  },
  { cy: 145, amp: 18, sw: 24, op: 0.08,  drift: [ 4.0, -2.5], dd: 7.9  },
]

// ── Node/edge geometry ──────────────────────────────────────────────────────
type Pt = { x: number; y: number }
type NodeDef = Pt & { r: number; accent?: true }

// Left cluster — sparse, organic (signal arrives, nodes emerge)
// One large central hub surrounded by smaller, irregularly placed nodes.
const L_NODES: NodeDef[] = [
  { x: 210, y: 148, r: 6  },   // entry — closest to wave terminus
  { x: 230, y: 114, r: 4  },
  { x: 248, y:  97, r: 5  },
  { x: 264, y: 146, r: 12 },   // largest — visual anchor of left cluster
  { x: 296, y: 112, r: 5  },
  { x: 304, y: 163, r: 7  },
  { x: 272, y: 192, r: 4  },
]

const L_EDGES: [number, number][] = [
  [0, 3], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [3, 6], [5, 6],
]

// Right cluster — dense, structured (organised memory network)
// Three rough rows; noticeable size variance; one indigo accent hub.
const R_NODES: NodeDef[] = [
  // top row
  { x: 338, y: 100, r: 5        },
  { x: 380, y:  85, r: 8        },   // large
  { x: 422, y:  96, r: 4        },
  { x: 464, y:  87, r: 9        },   // large
  // middle row
  { x: 332, y: 150, r: 6        },
  { x: 374, y: 147, r: 11, accent: true },  // brand accent — largest
  { x: 414, y: 143, r: 5        },
  { x: 456, y: 150, r: 8        },   // large
  // bottom row
  { x: 348, y: 200, r: 5        },
  { x: 390, y: 207, r: 6        },
  { x: 432, y: 199, r: 10       },   // large
  { x: 470, y: 205, r: 4        },
]

// Primary structural edges — drawn first, full weight
const R_PRIMARY: [number, number][] = [
  [0, 1], [1, 2], [2, 3],             // top row
  [4, 5], [5, 6], [6, 7],             // middle row
  [8, 9], [9, 10], [10, 11],          // bottom row
  [0, 4], [1, 5], [2, 6], [3, 7],     // top → middle
  [4, 8], [5, 9], [6, 10], [7, 11],   // middle → bottom
]

// Secondary diagonal web — drawn last, thinner, lower opacity
const R_SECONDARY: [number, number][] = [
  [1, 6], [0, 5], [2, 7], [5, 10], [6, 9],
]

// ── Helpers ─────────────────────────────────────────────────────────────────
const line = (a: Pt, b: Pt) => `M ${a.x},${a.y} L ${b.x},${b.y}`
const originAt = (x: number, y: number): { style: CSSProperties } => ({
  style: { transformOrigin: `${x}px ${y}px` },
})

// ── Component ───────────────────────────────────────────────────────────────
export default function HeroIllustration() {
  const prefersReduced = useReducedMotion()
  const skip = prefersReduced ?? false

  // Returns a Transition that's instant when skip=true
  const tx = (t: Transition): Transition => (skip ? { duration: 0 } : t)

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      className="w-full select-none"
    >
      {/* ── Layer 1: Wave field ─────────────────────────────────────────
          Each ribbon draws in (pathLength) then enters independent drift.
          split transition: { pathLength: {...}, y: {...} }
      ──────────────────────────────────────────────────────────────── */}
      {WAVES.map((w, i) => (
        <motion.path
          key={`w${i}`}
          d={wavePath(w.cy, w.amp)}
          stroke="#0f172a"
          strokeWidth={w.sw}
          strokeLinecap="round"
          initial={skip ? false : { pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: w.op,
            y: skip ? 0 : [0, w.drift[0], 0, w.drift[1], 0],
          }}
          transition={{
            pathLength: tx({ duration: 1.6, ease: 'easeInOut', delay: i * 0.06 }),
            opacity:    tx({ duration: 1.4, ease: 'easeInOut', delay: i * 0.06 }),
            y: skip ? { duration: 0 } : {
              duration: w.dd,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2.4 + i * 0.18,
            },
          }}
        />
      ))}

      {/* ── Layer 2: Left cluster (emergence) ──────────────────────────
          Group breathes subtly after intro completes.
      ──────────────────────────────────────────────────────────────── */}
      <motion.g
        animate={skip ? undefined : { y: [0, -2.5, 0, 2.5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 4.0 }}
      >
        {L_EDGES.map(([ai, bi], i) => (
          <motion.path
            key={`le${i}`}
            d={line(L_NODES[ai], L_NODES[bi])}
            stroke="#64748b"
            strokeWidth="0.9"
            strokeLinecap="round"
            initial={skip ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.48 }}
            transition={tx({ duration: 0.85, ease: 'easeInOut', delay: 1.65 + i * 0.09 })}
          />
        ))}

        {L_NODES.map((n, i) => (
          <motion.circle
            key={`ln${i}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="#1e293b"
            initial={skip ? false : { opacity: 0, scale: 0.25 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={tx({ duration: 0.55, ease: 'easeOut', delay: 1.4 + i * 0.09 })}
            {...originAt(n.x, n.y)}
          />
        ))}
      </motion.g>

      {/* ── Layer 3: Right mesh network ─────────────────────────────────
          Primary edges → nodes → secondary web → accent pulse.
          Group breathes on a slightly different phase to left cluster.
      ──────────────────────────────────────────────────────────────── */}
      <motion.g
        animate={skip ? undefined : { y: [0, 3, 0, -3, 0] }}
        transition={{ duration: 10.5, repeat: Infinity, ease: 'easeInOut', delay: 4.5 }}
      >
        {/* Primary structural edges */}
        {R_PRIMARY.map(([ai, bi], i) => (
          <motion.path
            key={`rp${i}`}
            d={line(R_NODES[ai], R_NODES[bi])}
            stroke="#64748b"
            strokeWidth="0.9"
            strokeLinecap="round"
            initial={skip ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.48 }}
            transition={tx({ duration: 0.8, ease: 'easeInOut', delay: 2.4 + i * 0.07 })}
          />
        ))}

        {/* Secondary diagonal web */}
        {R_SECONDARY.map(([ai, bi], i) => (
          <motion.path
            key={`rs${i}`}
            d={line(R_NODES[ai], R_NODES[bi])}
            stroke="#94a3b8"
            strokeWidth="0.55"
            strokeLinecap="round"
            initial={skip ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.28 }}
            transition={tx({ duration: 0.75, ease: 'easeInOut', delay: 3.6 + i * 0.1 })}
          />
        ))}

        {/* Nodes — render after edges so they sit on top */}
        {R_NODES.map((n, i) => (
          <g key={`rn${i}`}>
            {/* Accent pulse ring — ripples outward every ~7s */}
            {n.accent && !skip && (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.r + 10}
                stroke="#6366f1"
                strokeWidth="1.5"
                animate={{ scale: [1, 1.65], opacity: [0.5, 0] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatDelay: 5,
                  delay: 4.8,
                  ease: 'easeOut',
                }}
                {...originAt(n.x, n.y)}
              />
            )}
            {/* Node fill */}
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.accent ? '#4f46e5' : '#1e293b'}
              initial={skip ? false : { opacity: 0, scale: 0.25 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={tx({ duration: 0.55, ease: 'easeOut', delay: 2.55 + i * 0.07 })}
              {...originAt(n.x, n.y)}
            />
          </g>
        ))}
      </motion.g>
    </svg>
  )
}
