import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEYBIT — foundation",
  description: "Phase 1 development foundation. This is not the live BIT site.",
  openGraph: {
    images: ["/brand/bitmeta.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/bitmeta.jpg"],
  },
  icons: {
    icon: "/brand/bitmain2.png",
  },
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
