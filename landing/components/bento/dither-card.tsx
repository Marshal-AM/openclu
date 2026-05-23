"use client"

import { motion } from "framer-motion"

const NODES = [
  { id: "a", x: 48, y: 42, r: 5 },
  { id: "b", x: 120, y: 28, r: 4 },
  { id: "c", x: 200, y: 55, r: 6 },
  { id: "d", x: 280, y: 32, r: 4 },
  { id: "e", x: 340, y: 78, r: 5 },
  { id: "f", x: 72, y: 110, r: 4 },
  { id: "g", x: 160, y: 130, r: 5 },
  { id: "h", x: 248, y: 118, r: 4 },
  { id: "i", x: 320, y: 148, r: 5 },
  { id: "j", x: 130, y: 190, r: 4 },
  { id: "k", x: 220, y: 185, r: 6 },
  { id: "l", x: 300, y: 200, r: 4 },
  { id: "m", x: 40, y: 175, r: 3 },
  { id: "n", x: 360, y: 130, r: 3 },
]

const EDGES: [string, string][] = [
  ["a", "b"],
  ["a", "f"],
  ["b", "c"],
  ["b", "g"],
  ["c", "d"],
  ["c", "h"],
  ["d", "e"],
  ["d", "n"],
  ["e", "i"],
  ["f", "g"],
  ["f", "m"],
  ["g", "h"],
  ["g", "j"],
  ["h", "i"],
  ["h", "k"],
  ["i", "l"],
  ["j", "k"],
  ["k", "l"],
  ["m", "j"],
  ["n", "i"],
]

function getNode(id: string) {
  return NODES.find((n) => n.id === id)!
}

export function DitherCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          knowledge_graph.preview
        </span>
        <span className="text-[10px] tracking-widest text-muted-foreground font-mono">
          nodes + edges
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 bg-background overflow-hidden min-h-[200px]">
        <svg
          viewBox="0 0 400 240"
          className="w-full h-full max-h-[220px]"
          role="img"
          aria-label="Knowledge graph illustration — orange nodes connected by edges"
        >
          {Array.from({ length: 17 }).map((_, i) => (
            <line
              key={`grid-v-${i}`}
              x1={i * 24}
              y1={0}
              x2={i * 24}
              y2={240}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              opacity={0.4}
            />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line
              key={`grid-h-${i}`}
              x1={0}
              y1={i * 24}
              x2={400}
              y2={i * 24}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              opacity={0.4}
            />
          ))}

          {EDGES.map(([from, to], i) => {
            const a = getNode(from)
            const b = getNode(to)
            return (
              <motion.line
                key={`edge-${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#ea580c"
                strokeWidth={1}
                strokeOpacity={0.35}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
              />
            )
          })}

          {NODES.map((node, i) => (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r + 4}
                fill="#ea580c"
                opacity={0.12}
              >
                <animate
                  attributeName="r"
                  values={`${node.r + 3};${node.r + 7};${node.r + 3}`}
                  dur={`${2.5 + (i % 3) * 0.8}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.18;0.06;0.18"
                  dur={`${2.5 + (i % 3) * 0.8}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={node.x} cy={node.y} r={node.r} fill="#ea580c" />
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="border-t-2 border-foreground px-4 py-2">
        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          Groq extracts entities and relationships from captured activity. The result is a structured
          graph — not a flat transcript — that agents can traverse and license.
        </p>
      </div>
    </div>
  )
}
