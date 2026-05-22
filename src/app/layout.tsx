import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoonSnap — Website to Video",
  description:
    "Capture any website as a cinematic short video. Powered by HyperFrames + NVIDIA AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
