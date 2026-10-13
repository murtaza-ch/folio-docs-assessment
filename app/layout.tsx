import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import { Provider } from "@/components/provider";
import "./globals.css";
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const serif = Lora({ subsets: ["latin"], variable: "--font-serif" });
export const metadata: Metadata = {
  title: "Folio | A place for shared work",
  description:
    "Create, write, and share documents in a focused collaborative workspace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${body.variable} ${serif.variable}`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
