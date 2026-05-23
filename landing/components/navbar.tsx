"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV_LINKS = [
  { label: "Device", href: "#device" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Vision", href: "#vision" },
  { label: "Tracks", href: "#tracks" },
]

export function Navbar() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const logoSrc =
    mounted && resolvedTheme === "dark"
      ? "/openclu_logo_dark.png"
      : "/openclu_logo_light.png"

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-4 pt-4 lg:px-6 lg:pt-6"
    >
      <nav className="w-full border border-foreground/20 bg-background/80 backdrop-blur-sm px-6 py-3 lg:px-8">
        <div className="relative flex items-center justify-between">
          <motion.a
            href="#"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="relative z-10 flex items-center gap-3 shrink-0"
            aria-label="OpenClu"
          >
            <Image
              src={logoSrc}
              alt="OpenClu"
              width={520}
              height={220}
              priority
              className="h-11 w-auto md:h-14 lg:h-16"
            />
          </motion.a>

          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8">
            {NAV_LINKS.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-xs font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </motion.a>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="relative z-10 flex items-center gap-4"
          >
            <ThemeToggle />
          </motion.div>
        </div>
      </nav>
    </motion.div>
  )
}
