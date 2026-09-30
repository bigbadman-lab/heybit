import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEYBIT — foundation",
  description: "Phase 1 development foundation. This is not the live BIT site.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
