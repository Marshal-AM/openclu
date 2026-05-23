"use client"

import { TerminalCard } from "@/components/bento/terminal-card"
import { DitherCard } from "@/components/bento/dither-card"
import { MetricsCard } from "@/components/bento/metrics-card"
import { StatusCard } from "@/components/bento/status-card"
import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease },
  }),
}

export function FeatureGrid() {
  return (
    <section id="pipeline" className="w-full px-6 py-20 lg:px-12 scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease }}
        className="flex items-center gap-4 mb-6"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          {"// SECTION: PIPELINE"}
        </span>
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">004</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10"
      >
        <h2 className="text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase text-balance max-w-2xl">
          From raw activity to a <span className="text-[#ea580c]">licensable skill</span>, in one local pipeline.
        </h2>
        <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed max-w-md">
          Audio and frames never leave the device unencrypted. Groq drafts the SKILL.md and knowledge
          graph locally. <span className="text-foreground">Story CDR</span> encrypts via WASM and pins
          ciphertext to Helia. <span className="text-foreground">Story Protocol</span> mints the IP.
          <span className="text-foreground"> Arkiv Network</span> publishes the Braga catalog listing — all
          signed by your device wallet.
        </p>
      </motion.div>

      {/* 2x2 Bento Grid */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 md:grid-cols-2 border-2 border-foreground"
      >
        {/* Terminal */}
        <motion.div
          custom={0}
          variants={cardVariants}
          className="border-b-2 md:border-b-0 md:border-r-2 border-foreground min-h-[280px]"
        >
          <TerminalCard />
        </motion.div>

        {/* Dither */}
        <motion.div
          custom={1}
          variants={cardVariants}
          className="border-b-2 md:border-b-0 border-foreground min-h-[280px]"
        >
          <DitherCard />
        </motion.div>

        {/* Protocol stack (Story CDR + Arkiv) */}
        <motion.div
          custom={2}
          variants={cardVariants}
          className="border-t-2 md:border-r-2 border-foreground min-h-[280px]"
        >
          <MetricsCard />
        </motion.div>

        {/* Status */}
        <motion.div
          custom={3}
          variants={cardVariants}
          className="border-t-2 border-foreground min-h-[280px]"
        >
          <StatusCard />
        </motion.div>
      </motion.div>
    </section>
  )
}
