// SPDX-License-Identifier: GPL-3.0-or-later
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const isDevice = mode === "device";

  return {
    base: "./",
    plugins: [preact(), ...(isDevice ? [viteSingleFile()] : [])],
    build: {
      assetsInlineLimit: isDevice ? Number.MAX_SAFE_INTEGER : undefined,
      cssCodeSplit: !isDevice,
      modulePreload: isDevice ? false : undefined,
      rollupOptions: isDevice
        ? {
            output: {
              inlineDynamicImports: true,
            },
          }
        : undefined,
      target: "es2020",
    },
  };
});
