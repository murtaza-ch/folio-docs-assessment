import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import { Provider } from "@/components/provider";
import "./tokens.css";
import "./globals.css";
const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui" });
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-doc",
  style: ["normal", "italic"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  preload: false,
});
export const metadata: Metadata = {
  title: "Folio",
  description: "Write, share and review documents with your team.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ui.variable} ${serif.variable} ${mono.variable}`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
