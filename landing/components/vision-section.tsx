"use client"

import { motion } from "framer-motion"
import { ArrowRight, Languages, Hammer, Stethoscope, Music, Brain, MapPin } from "lucide-react"
import { DASHBOARD_LOGIN_URL } from "@/lib/constants"

const ease = [0.22, 1, 0.36, 1] as const

function BlinkDot() {
  return <span className="inline-block h-2 w-2 bg-[#ea580c] animate-blink" />
}

const USE_CASES = [
  {
    icon: Languages,
    tag: "LANGUAGE",
    title: "A Tamil speaker uploads 40 hours",
    body:
      "Conversations, slang, code-switching, intonation. Clu turns it into a knowledge graph of how Tamil is actually spoken — not how a textbook says it should be. CDR encrypts the bundle; Arkiv lists it; any agent that purchases a Story license stops translating and starts speaking.",
  },
  {
    icon: Hammer,
    tag: "CRAFT",
    title: "A master carpenter wears Clu for a week",
    body:
      "Joint by joint, grain by grain, decision by decision. The graph encodes when to plane, when to chisel, when to walk away. Robotic arms and CAD agents license it and inherit a lifetime of muscle memory.",
  },
  {
    icon: Stethoscope,
    tag: "CLINICAL",
    title: "A nurse records a triage shift",
    body:
      "Patterns of escalation, side-effect interactions, the soft signals before a code blue. Anonymized and CDR-encrypted before publish. Hospital agents discover the skill on Arkiv and license it — junior staff get a ten-year veteran in their pocket on day one.",
  },
  {
    icon: Music,
    tag: "PERFORMANCE",
    title: "A jazz pianist captures a residency",
    body:
      "Voicings, comping choices, the way they respond to a drummer. Generative agents license the graph and gain a personal idiom — not a global average of every pianist on the internet.",
  },
  {
    icon: Brain,
    tag: "RESEARCH",
    title: "A researcher narrates their workflow",
    body:
      "How they read a paper, what they skip, why they pivot. Research copilots license the trace and finally know what 'good taste' looks like for a specific lab.",
  },
  {
    icon: MapPin,
    tag: "LOCAL",
    title: "A Tokyo bike courier records routes",
    body:
      "Shortcuts, weather instincts, where the elevators are. Delivery agents stop relying on stale maps and license living, spatial knowledge from the people who actually move through the city.",
  },
]

export function VisionSection() {
  return (
    <section id="vision" className="w-full px-6 py-24 lg:px-12 scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease }}
        className="flex items-center gap-4 mb-8"
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          {"// SECTION: VISION"}
        </span>
        <div className="flex-1 border-t border-border" />
        <BlinkDot />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          006
        </span>
      </motion.div>

      <div className="border-2 border-foreground">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0"
        >
          <div className="px-6 py-10 lg:px-12 lg:py-14 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground">
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#ea580c] font-mono">
              THIS IS JUST THE BEGINNING
            </span>
            <h2 className="mt-4 font-pixel text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground uppercase leading-[0.95]">
              The training data <br />
              for the next decade <br />
              is <span className="text-[#ea580c]">human life</span>.
            </h2>
            <p className="mt-6 text-sm lg:text-base font-mono text-muted-foreground leading-relaxed max-w-xl">
              We are building Clu — a purpose-built hardware companion that records spatial, auditory,
              and activity data as clearly and as densely as possible. Not a webcam. Not a screen
              recorder. A dedicated, on-device instrument for capturing what humans actually do.
            </p>
            <p className="mt-4 text-sm lg:text-base font-mono text-muted-foreground leading-relaxed max-w-xl">
              Every recording becomes a knowledge graph. Every graph becomes a skill encrypted by{" "}
              <span className="text-foreground">Story CDR</span>, registered on{" "}
              <span className="text-foreground">Story Protocol</span>, and listed on{" "}
              <span className="text-foreground">Arkiv Network</span> — owned by the human who lived it,
              signed by their device wallet, and licensable by any agent. The model layer has
              commoditized. The next moat is <span className="text-foreground">whose skills</span> your
              agent has.
            </p>
            <div className="mt-8">
              <motion.a
                href={DASHBOARD_LOGIN_URL}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center gap-0 bg-foreground text-background text-sm font-mono tracking-wider uppercase"
              >
                <span className="flex items-center justify-center w-10 h-10 bg-[#ea580c]">
                  <ArrowRight size={16} strokeWidth={2} className="text-background" />
                </span>
                <span className="px-5 py-2.5">Get started</span>
              </motion.a>
            </div>
          </div>

          <div className="overflow-hidden flex flex-col">
            <div className="border-b-2 border-foreground px-5 py-6 flex flex-col gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#ea580c] font-mono">
                STORY CDR
              </span>
              <span className="text-lg lg:text-xl font-mono font-bold tracking-tight uppercase">
                Encrypted at capture
              </span>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Confidential Data Rails threshold-encrypts each skill bundle on-device. Ciphertext goes
                to Helia/IPFS; plaintext never leaves the contributor&apos;s machine. Agents purchase a
                Story license to decrypt — access control is on-chain, not in our database.
              </p>
            </div>
            <div className="border-b-2 border-foreground px-5 py-6 flex flex-col gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-foreground font-mono">
                ARKIV NETWORK
              </span>
              <span className="text-lg lg:text-xl font-mono font-bold tracking-tight uppercase">
                The skill catalog
              </span>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Arkiv indexes every listing as a Braga skillListing — searchable tags, metadata, CID
                pointer, and <code className="text-foreground">$owner</code> attribution. The frontend
                Purchase tab and agent marketplaces query Arkiv directly for discovery.
              </p>
            </div>
            <div className="px-5 py-6 flex flex-col gap-3 flex-1">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                STORY PROTOCOL
              </span>
              <span className="text-lg lg:text-xl font-mono font-bold tracking-tight uppercase">
                IP + license rails
              </span>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Story Aeneid mints each skill as registered IP. License token IDs gate CDR vault reads.
                Royalties flow to the contributor&apos;s device wallet — enforced by smart contracts, not
                platform policy.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="border-t-2 border-foreground px-6 py-8 lg:px-12 lg:py-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-mono">
              {"// USE CASES /// EVERY VERTICAL, EVERY LANGUAGE, EVERY HUMAN"}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="border-2 border-foreground overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 -mb-[2px] -mr-[2px]">
              {USE_CASES.map((u, i) => {
                const Icon = u.icon
                return (
                  <motion.div
                    key={u.tag}
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: 0.08 * i, duration: 0.5, ease }}
                    className="flex flex-col gap-4 p-6 border-b-2 border-r-2 border-foreground"
                  >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center justify-center w-8 h-8 border-2 border-foreground">
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <span className="text-[10px] tracking-[0.2em] uppercase text-[#ea580c] font-mono">
                      {u.tag}
                    </span>
                  </div>
                  <h3 className="text-sm lg:text-base font-mono font-bold tracking-tight uppercase text-balance">
                    {u.title}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                    {u.body}
                  </p>
                </motion.div>
              )
              })}
            </div>
          </div>
        </div>

        <div className="border-t-2 border-foreground bg-foreground text-background px-6 py-10 lg:px-12 lg:py-14">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
            <div className="flex-1">
              <span className="text-[10px] tracking-[0.25em] uppercase text-[#ea580c] font-mono">
                THE LONG ARC
              </span>
              <h3 className="mt-3 text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase text-balance">
                A planetary index of human skill — owned by the humans who lived it.
              </h3>
              <p className="mt-4 text-xs lg:text-sm font-mono text-background/70 leading-relaxed max-w-2xl">
                We are not building a dataset. We are building the substrate for a market in lived
                expertise — powered by Story CDR for encryption, Arkiv Network for discovery, and Story
                Protocol for ownership. The Clu device is the first instrument. The skill graph is the
                first primitive. Models will keep getting smarter; what they need next is to inherit you.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0 lg:text-right">
              <span className="text-[10px] tracking-[0.25em] uppercase text-background/40 font-mono">
                POWERED BY
              </span>
              <span className="font-mono text-sm lg:text-base uppercase tracking-widest text-background/80">
                Story CDR
              </span>
              <span className="font-mono text-sm lg:text-base uppercase tracking-widest text-background/80">
                Arkiv Network
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-background/40 font-mono">
                ENCRYPT · DISCOVER · LICENSE
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
