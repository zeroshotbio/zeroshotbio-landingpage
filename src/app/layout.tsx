import React, { FC, ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

// This import is part of the hypothetical scenario.
import { Roboto_Slab } from "next/font/google";

// Here, we're adjusting the code to specify font weights individually.
// This matches the error message's demand for "explicitly written literals."
const robotoSlab = Roboto_Slab({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const metadata = {
  title: "zeroshotBio",
  description: "genomic LLMs for bioengineering workflows",
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en" className={robotoSlab.className}>
      <head>
        <link rel="icon" href="/favicon.png" />
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
};

export default RootLayout;
