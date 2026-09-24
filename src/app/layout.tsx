import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--f-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--f-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RevBounce — Turn Traffic Into Revenue",
  description:
    "One snippet. Infinite revenue. RevBounce turns the visitors you're losing into your highest-margin channel with elegant, optimization-driven pops.",
  keywords: ["monetization", "exit intent", "publisher revenue", "pop monetization", "Revenue share"],
};

export const viewport: Viewport = { themeColor: "#07060b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sans.variable}`}>
      <body className="grain antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
