import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeployPilot | Ship with clarity",
  description: "Analyze repositories, catch common security risks, and follow deployment logs with DeployPilot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
