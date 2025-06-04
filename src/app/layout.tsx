// src/app/layout.tsx (Server Component)
import { Roboto_Slab } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import DarkMode from "./DarkModeButton";
import { ReactNode } from "react";

const robotoSlab_font = Roboto_Slab({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "zeroshot bio",
  description: "understanding gene expression space",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={robotoSlab_font.className}>
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>
      <body>
        <DarkMode>{children}</DarkMode>
        <Analytics />
      </body>
    </html>
  );
}
