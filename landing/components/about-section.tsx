"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const ease = [0.22, 1, 0.36, 1] as const

function BlinkDot() {
  return <span className="inline-block h-2 w-2 bg-[#ea580c] animate-blink" />
}

const PROTOCOL_PILLARS = [
  {
    label: "STORY CDR",
    title: "Encrypt before it leaves",
    body:
      "Confidential Data Rails runs in-process on your device. WASM encrypts the skill bundle; ciphertext is pinned to local Helia. Buyers decrypt only after minting a Story license token.",
  },
  {
    label: "ARKIV NETWORK",
    title: "Discoverable catalog",
    body:
      "Each skill becomes a Braga skillListing on Arkiv — tagged, searchable, and owned by your device wallet. Agents browse the public catalog and purchase by CID.",
  },
  {
    label: "STORY PROTOCOL",
    title: "On-chain IP + royalties",
    body:
      "Story Aeneid registers every skill as IP. License terms and royalty splits are enforced on-chain — not by OpenClu. Contributors keep their device keys.",
  },
  {
    label: "DEVICE WALLET",
    title: "Provenance as primary key",
    body:
      "Every write — CDR vault, Story mint, Arkiv listing — is signed by the contributor's device wallet. Only that wallet can update or archive a listing.",
  },
]

function ProtocolPillar({
  label,
  title,
  body,
  index,
}: {
  label: string
  title: string
  body: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.5, ease }}
      className="flex flex-col gap-2 border-2 border-foreground px-4 py-3"
    >
      <span className="text-[10px] tracking-[0.2em] uppercase text-[#ea580c] font-mono">
        {label}
      </span>
      <span className="text-sm font-mono font-bold tracking-tight uppercase">{title}</span>
      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  )
}

export function AboutSection() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Panel uses bg-foreground (inverted vs page), so logo variant is inverted too.
  const logoSrc =
    mounted && resolvedTheme === "dark"
      ? "/openclu_logo_light.png"
      : "/openclu_logo_dark.png"

  return (
    <section id="device" className="w-full px-6 py-20 lg:px-12 scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease }}
        className="flex items-center gap-4 mb-8"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          {"// SECTION: MANIFEST"}
        </span>
        <div className="flex-1 border-t border-border" />
        <BlinkDot />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          005
        </span>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-0 border-2 border-foreground">
        <motion.div
          initial={{ opacity: 0, x: -30, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="relative w-full lg:w-1/2 min-h-[320px] lg:min-h-[520px] border-b-2 lg:border-b-0 lg:border-r-2 border-foreground overflow-hidden bg-foreground"
        >
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-foreground/80 backdrop-blur-sm">
            <span className="text-[10px] tracking-[0.2em] uppercase text-background/60 font-mono">
              RENDER: clu_device.r0
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#ea580c] font-mono">
              EARLY ACCESS
            </span>
          </div>

          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(234,88,12,0.35) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center z-10 px-6 py-16">
            <Image
              src={logoSrc}
              alt="OpenClu — the Clu device captures activity and turns it into a licensable skill"
              width={1024}
              height={512}
              priority
              className="w-full max-w-lg lg:max-w-xl h-auto object-contain"
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-foreground/80 backdrop-blur-sm">
            <span className="text-[10px] tracking-[0.2em] uppercase text-background/40 font-mono">
              CDR + HELIA + ARKIV
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-background/40 font-mono">
              FW: 0.1.0-aeneid
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1, ease }}
          className="flex flex-col w-full lg:w-1/2"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-foreground">
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
              MANIFEST.md
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
              v0.1.0
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-between px-5 py-6 lg:py-8">
            <div className="flex flex-col gap-6">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: 0.2, ease }}
                className="text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase text-balance"
              >
                A device for capturing
                <br />
                <span className="text-[#ea580c]">human knowledge</span>
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: 0.3, duration: 0.5, ease }}
                className="flex flex-col gap-4"
              >
                <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed">
                  Clu is the recording device underneath OpenClu. It captures voice, motion, and
                  activity at the source. Groq transcribes locally and extracts a knowledge graph into{" "}
                  <code className="text-foreground">SKILL.md</code>. Raw signal never leaves unencrypted.
                </p>
                <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed">
                  <span className="text-foreground">Story CDR</span> encrypts the bundle on your machine
                  and writes a vault keyed to Story license terms.{" "}
                  <span className="text-foreground">Arkiv Network</span> publishes the catalog entry so
                  agents can discover it. Story Protocol registers the IP and enforces who gets paid.
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mt-8">
              {PROTOCOL_PILLARS.map((pillar, i) => (
                <ProtocolPillar key={pillar.label} {...pillar} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
