import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  // Os pacotes do monorepo são TypeScript puro: entram no bundle; o resto fica em node_modules.
  noExternal: [/^@petshop\//],
  clean: true,
  sourcemap: true,
});
