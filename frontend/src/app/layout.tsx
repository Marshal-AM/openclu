import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { OpenCluWeb3Provider } from "@/components/providers/openclu-web3-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Skill Capture",
  description: "Contribute and manage agent skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <OpenCluWeb3Provider>
          <TooltipProvider>{children}</TooltipProvider>
        </OpenCluWeb3Provider>
      </body>
    </html>
  );
}
