"use client"

import { WorkflowDiagram } from "@/components/workflow-diagram"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

export function HeroSection() {
  return (
    <section className="relative w-full px-6 pt-6 pb-12 lg:px-24 lg:pt-10 lg:pb-16">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="flex items-center justify-center gap-3 mb-6"
      >
        <span className="h-1.5 w-1.5 bg-[#ea580c] animate-blink" />
        <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-mono">
          CLU.DEVICE / FIRMWARE v0.1 / EARLY ACCESS OPEN
        </span>
        <span className="h-1.5 w-1.5 bg-[#ea580c] animate-blink" />
      </motion.div>

      <div className="flex flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease }}
          className="font-pixel text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground mb-2 select-none"
        >
          RECORD. ENCODE.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
          className="w-full max-w-2xl my-4 lg:my-6"
        >
          <WorkflowDiagram />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
          className="font-pixel text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-foreground mb-4 select-none"
        >
          LICENSE.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease }}
          className="text-xs lg:text-sm text-muted-foreground max-w-xl mb-8 leading-relaxed font-mono"
        >
          OpenClu turns lived human activity into encrypted knowledge graphs of skills.
          Contributors record on <span className="text-foreground">Clu hardware</span>.{" "}
          <span className="text-foreground">Story CDR</span> encrypts the bundle on-device;{" "}
          <span className="text-foreground">Story Protocol</span> registers it as IP;{" "}
          <span className="text-foreground">Arkiv Network</span> publishes the listing for agents to
          discover and license — all signed by the contributor&apos;s device wallet.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <motion.a
            href="#device"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-0 bg-foreground text-background text-sm font-mono tracking-wider uppercase"
          >
            <span className="flex items-center justify-center w-10 h-10 bg-[#ea580c]">
              <motion.span
                className="inline-flex"
                whileHover={{ x: 3 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <ArrowRight size={16} strokeWidth={2} className="text-background" />
              </motion.span>
            </span>
            <span className="px-5 py-2.5">Reserve a Clu device</span>
          </motion.a>

          <motion.a
            href="#pipeline"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 border-2 border-foreground px-5 py-2.5 text-sm font-mono tracking-wider uppercase text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            See the pipeline
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
