import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LDR Coach",
  description: "Coaching for long-distance couples",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
