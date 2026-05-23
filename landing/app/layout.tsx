import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { GeistPixelGrid } from 'geist/font/pixel'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const SITE_URL = 'https://openclu.ai'
const SITE_NAME = 'OpenClu'
const SITE_TITLE = 'OpenClu — Record human activity. License it as a skill any agent can run.'
const SITE_DESCRIPTION =
  'OpenClu turns lived human activity into encrypted, on-chain knowledge graphs of skills. Contributors record on Clu hardware; AI agents license those skills to instantly become fluent in a language, a craft, or a workflow. Built on Story Protocol, Arkiv, Helia, and Groq.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'OpenClu',
    'Clu device',
    'human skill marketplace',
    'AI agent skills',
    'skill knowledge graph',
    'spatial capture hardware',
    'voice and activity recording',
    'Story Protocol IP',
    'Arkiv catalog',
    'Helia IPFS',
    'encrypted skill bundles',
    'decentralized skill licensing',
    'agent training data',
    'human-in-the-loop AI',
    'tamil language AI skill',
    'craft knowledge capture',
    'on-chain IP for AI',
    'device wallet attribution',
  ],
  authors: [{ name: 'OpenClu' }],
  creator: 'OpenClu',
  publisher: 'OpenClu',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: [{ url: '/favicon.png', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    images: [
      {
        url: '/openclu_logo_dark.png',
        width: 1024,
        height: 512,
        alt: 'OpenClu — record human activity, license it as an AI skill',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description:
      'Record real human activity on Clu hardware. We turn it into an encrypted knowledge graph, register the IP on-chain, and let any AI agent license your skill.',
    creator: '@openclu',
    images: ['/openclu_logo_dark.png'],
  },
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: '#ea580c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${GeistPixelGrid.variable}`} suppressHydrationWarning>
      <body className="font-mono antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
