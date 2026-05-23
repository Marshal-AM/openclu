"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"

const LEFT_LABELS = ["Capture", "Transcribe", "Graph"]
const RIGHT_LABELS = ["Encrypt", "Register", "License"]

function PillLabel({
  label,
  x,
  y,
  delay,
}: {
  label: string
  x: number
  y: number
  delay: number
}) {
  return (
    <motion.g
      initial={{ opacity: 0, x: x > 400 ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <rect
        x={x}
        y={y}
        width={92}
        height={26}
        rx={13}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      <text
        x={x + 46}
        y={y + 17}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={10}
        fontFamily="var(--font-mono), monospace"
        fontWeight={500}
        letterSpacing="0.12em"
      >
        {label.toUpperCase()}
      </text>
    </motion.g>
  )
}

export function WorkflowDiagram() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-[200px] w-full" />
  }

  const centerX = 400
  const centerY = 100

  const markSrc =
    resolvedTheme === "dark"
      ? "/openclu_mark_dark.png"
      : "/openclu_mark_light.png"

  const leftPillX = 48
  const rightPillX = 660

  return (
    <div className="relative w-full max-w-[800px] mx-auto">
      <svg
        viewBox="0 0 800 200"
        className="w-full h-auto"
        role="img"
        aria-label="OpenClu pipeline: Capture, Transcribe, Graph feed into the Clu node, which Encrypts, Registers on Story, and Licenses to agents"
      >
        {LEFT_LABELS.map((_, i) => {
          const pillY = 30 + i * 60
          return (
            <motion.line
              key={`left-line-${i}`}
              x1={centerX - 40}
              y1={centerY}
              x2={leftPillX + 92}
              y2={pillY + 13}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
            />
          )
        })}

        {RIGHT_LABELS.map((_, i) => {
          const pillY = 30 + i * 60
          return (
            <motion.line
              key={`right-line-${i}`}
              x1={centerX + 40}
              y1={centerY}
              x2={rightPillX}
              y2={pillY + 13}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
            />
          )
        })}

        {LEFT_LABELS.map((_, i) => {
          const pillY = 30 + i * 60
          return (
            <motion.circle
              key={`left-packet-${i}`}
              r={3}
              fill="#ea580c"
              initial={{ cx: leftPillX + 92, cy: pillY + 13 }}
              animate={{
                cx: [leftPillX + 92, centerX - 40],
                cy: [pillY + 13, centerY],
              }}
              transition={{
                duration: 1.8,
                delay: 0.8 + i * 0.6,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "linear",
              }}
            />
          )
        })}

        {RIGHT_LABELS.map((_, i) => {
          const pillY = 30 + i * 60
          return (
            <motion.circle
              key={`right-packet-${i}`}
              r={3}
              fill="#ea580c"
              initial={{ cx: centerX + 40, cy: centerY }}
              animate={{
                cx: [centerX + 40, rightPillX],
                cy: [centerY, pillY + 13],
              }}
              transition={{
                duration: 1.8,
                delay: 1.2 + i * 0.6,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "linear",
              }}
            />
          )
        })}

        {LEFT_LABELS.map((label, i) => (
          <PillLabel
            key={`left-${label}`}
            label={label}
            x={leftPillX}
            y={30 + i * 60}
            delay={0.1 + i * 0.1}
          />
        ))}

        {RIGHT_LABELS.map((label, i) => (
          <PillLabel
            key={`right-${label}`}
            label={label}
            x={rightPillX}
            y={30 + i * 60}
            delay={0.1 + i * 0.1}
          />
        ))}

        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <rect
            x={centerX - 40}
            y={centerY - 40}
            width={80}
            height={80}
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground))"
            strokeWidth={1.5}
          />
          <circle cx={centerX} cy={centerY} r={32} fill="none" stroke="#ea580c" strokeWidth={1}>
            <animate
              attributeName="r"
              values="32;38;32"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;0.15;0.6"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        </motion.g>
      </svg>

      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "9%",
          aspectRatio: "1 / 1",
        }}
      >
        <Image
          src={markSrc}
          alt="Clu mark"
          fill
          sizes="80px"
          className="object-contain"
          priority
        />
      </div>
    </div>
  )
}
