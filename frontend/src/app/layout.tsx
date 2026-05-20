import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill Capture",
  description: "Contribute and purchase agent skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
