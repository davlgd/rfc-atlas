import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DATA_UPDATE_CONFIG } from "../src/config.ts";
import { parseBortzmeyerRfcIndex, parseBortzmeyerSeriesIndex } from "./lib/rfc-data.ts";

const indexUrl = `${DATA_UPDATE_CONFIG.bortzmeyerUrl}/rfcs.html`;
const outputPath = join(process.cwd(), "data", "bortzmeyer-rfcs.json");
const headers = { "User-Agent": DATA_UPDATE_CONFIG.userAgent };

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

const index = await fetchText(indexUrl);
const seriesPages = parseBortzmeyerSeriesIndex(index);
if (seriesPages.length === 0) throw new Error("No RFC series pages found in the Bortzmeyer index");

const rfcNumbers = new Set<number>();
for (const seriesPage of seriesPages) {
  const html = await fetchText(`${DATA_UPDATE_CONFIG.bortzmeyerUrl}/${seriesPage}`);
  for (const number of parseBortzmeyerRfcIndex(html)) rfcNumbers.add(number);
  console.log(`Bortzmeyer: indexed ${seriesPage}`);
}

const articles = Object.fromEntries(
  [...rfcNumbers]
    .sort((left, right) => left - right)
    .map((number) => [String(number), `${DATA_UPDATE_CONFIG.bortzmeyerUrl}/${number}.html`]),
);
const artifact = {
  source: indexUrl,
  generatedAt: new Date().toISOString(),
  articles,
};

await mkdir(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`);
await rename(temporaryPath, outputPath);
console.log(
  `Bortzmeyer: wrote ${rfcNumbers.size.toLocaleString("en-US")} RFC links to ${outputPath}`,
);
