import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "vite";
import { URL_CONFIG } from "../src/config.ts";
import type { GraphArtifact } from "../src/types.ts";
import { createRobots, createSitemap } from "./lib/seo-data.ts";

const root = process.cwd();
const graphPath = join(root, "public", "data", "graph.json");
const sitemapPath = join(root, "public", "sitemap.xml");
const robotsPath = join(root, "public", "robots.txt");
const artifact = JSON.parse(await readFile(graphPath, "utf8")) as GraphArtifact;
const fileEnvironment = loadEnv(process.env.NODE_ENV ?? "production", root, "VITE_");
const siteUrl = process.env.VITE_SITE_URL ?? fileEnvironment.VITE_SITE_URL;
if (!siteUrl) throw new Error("VITE_SITE_URL must be defined");
const sitemap = createSitemap(
  artifact.nodes.map((node) => node.number),
  siteUrl,
  URL_CONFIG.rfcPathPrefix,
  artifact.meta.generatedAt,
);
const writeAtomically = async (path: string, content: string) => {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, path);
};
await Promise.all([
  writeAtomically(sitemapPath, sitemap),
  writeAtomically(robotsPath, createRobots(siteUrl)),
]);
console.log(
  `SEO: wrote ${artifact.nodes.length.toLocaleString("en-US")} RFC URLs and robots metadata`,
);
