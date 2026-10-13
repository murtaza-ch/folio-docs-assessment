"use client";
import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react";
const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      fonts: {
        body: { value: "var(--font-body), sans-serif" },
        heading: { value: "var(--font-body), sans-serif" },
      },
      colors: {
        brand: {
          50: { value: "#edf2ff" },
          500: { value: "#335cff" },
          600: { value: "#2449d8" },
        },
      },
    },
  },
});
export function Provider({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
