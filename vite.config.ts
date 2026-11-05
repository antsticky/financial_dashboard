import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readPortfolioData } from "./scripts/read-data.mjs";

function pagesBase(): string {
  if (process.env.GITHUB_ACTIONS !== "true") return "/";
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repo || repo.endsWith(".github.io")) return "/";
  return `/${repo}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const passphrase = process.env.MISC_PASSPHRASE || env.MISC_PASSPHRASE || "";
  return {
    base: pagesBase(),
    plugins: [react(), portfolioData(passphrase)],
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});

function portfolioData(passphrase: string): Plugin {
  const virtualId = "virtual:portfolio";
  const resolvedId = "\0virtual:portfolio";
  return {
    name: "portfolio-data",
    resolveId(source) {
      if (source === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return null;
      const root = process.cwd();
      for (const file of dataFiles(root)) this.addWatchFile(file);
      const data = readPortfolioData(passphrase, root);
      return `export default ${JSON.stringify(data)}`;
    },
  };
}

function dataFiles(root: string): string[] {
  const directory = join(root, "data");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".bin"))
    .map((name) => join(directory, name));
}
