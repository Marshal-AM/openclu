"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const ease = [0.22, 1, 0.36, 1] as const

export function Footer() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const logoSrc =
    mounted && resolvedTheme === "dark"
      ? "/openclu_logo_dark.png"
      : "/openclu_logo_light.png"

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease }}
      className="w-full border-t-2 border-foreground px-6 py-10 lg:px-12"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <Image
            src={logoSrc}
            alt="OpenClu"
            width={420}
            height={180}
            className="h-12 w-auto md:h-14"
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              {"(C) 2026 OpenClu \u00B7 Built for the people who do the work"}
            </span>
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              {"Story CDR \u00B7 Arkiv Network \u00B7 Story Protocol \u00B7 Helia \u00B7 Groq"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {[
            { label: "Docs", href: "#" },
            { label: "Marketplace", href: "#" },
            { label: "Device", href: "#device" },
            { label: "GitHub", href: "#" },
          ].map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease }}
              className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {link.label}
            </motion.a>
          ))}
        </div>
      </div>
    </motion.footer>
  )
}
