// SPDX-License-Identifier: GPL-3.0-or-later
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const isDevice = mode === "device";
  const isSingleFileBuild = isDevice || mode === "hosted";

  return {
    base: "./",
    // Both release targets stay self-contained. The hosted artifact is
    // committed because the release chain byte-compares committed bytes,
    // mirroring ADR-0027's committed device-header precedent.
    plugins: [preact(), ...(isSingleFileBuild ? [viteSingleFile()] : [])],
    build: {
      assetsInlineLimit: isSingleFileBuild ? Number.MAX_SAFE_INTEGER : undefined,
      cssCodeSplit: !isSingleFileBuild,
      modulePreload: isSingleFileBuild ? false : undefined,
      rollupOptions: isSingleFileBuild
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
