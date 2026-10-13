"use client";
import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react";
const system = createSystem(defaultConfig, {
  globalCss: {
    // Chakra's preflight must not override the app's own base styles.
    "html, body": { bg: "var(--bg)", color: "var(--ink)" },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: "var(--font-ui), system-ui, sans-serif" },
        heading: { value: "var(--font-ui), system-ui, sans-serif" },
        mono: { value: "var(--font-mono), ui-monospace, monospace" },
      },
    },
  },
});
export function Provider({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
