import type { Metadata } from "next";
import { ReownProvider } from "../components/wallet/ReownProvider";
import { readReownProjectId } from "../lib/reown-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://heybit.fun"),
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
  const projectId = readReownProjectId();
  return (
    <html lang="en">
      <body>
        <ReownProvider projectId={projectId}>{children}</ReownProvider>
      </body>
    </html>
  );
}
