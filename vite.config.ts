import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function pagesBase(): string {
  if (process.env.GITHUB_ACTIONS !== "true") return "/";
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repo || repo.endsWith(".github.io")) return "/";
  return `/${repo}/`;
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
