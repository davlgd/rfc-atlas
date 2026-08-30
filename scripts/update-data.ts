import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_UPDATE_CONFIG } from "../src/config.ts";
import type { GraphArtifact, RelationKind, RfcEdge, RfcNode } from "../src/types.ts";
import {
  normalizeRelatedDocument,
  parseRfcIndex,
  type NormalizedRelation,
  type RelatedDocumentApiObject,
} from "./lib/rfc-data.ts";

const root = process.cwd();
const cacheDir = join(root, "data", "cache");
const publicDataDir = join(root, "public", "data");
const databasePath = join(root, "data", "rfc-atlas.sqlite");
const indexPath = join(cacheDir, "rfc-index.xml");
const httpStatePath = join(cacheDir, "http-state.json");
const bortzmeyerDataPath = join(root, "data", "bortzmeyer-rfcs.json");
const graphPath = join(publicDataDir, "graph.json");
const args = new Set(process.argv.slice(2));
const offline = args.has("--offline");
const force = args.has("--force");
const sampleArg = [...args].find((arg) => arg.startsWith("--sample="));
const sampleSize = sampleArg ? Number(sampleArg.split("=")[1]) : null;
if (sampleSize !== null && (!Number.isInteger(sampleSize) || sampleSize < 1)) {
  throw new Error("--sample must be a positive integer");
}

interface HttpState {
  etag?: string;
  lastModified?: string;
  fetchedAt?: string;
}
interface ApiPage {
  meta: { total_count: number };
  objects: RelatedDocumentApiObject[];
}
interface BortzmeyerData {
  source: string;
  generatedAt: string;
  articles: Record<string, string>;
}

await mkdir(cacheDir, { recursive: true });
await mkdir(publicDataDir, { recursive: true });

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function fetchIndex(): Promise<{ xml: string; updatedAt: string | null }> {
  const state = await readJson<HttpState>(httpStatePath, {});
  if (offline) {
    if (!existsSync(indexPath))
      throw new Error("XML cache is missing: run npm run data:update first");
    return { xml: await readFile(indexPath, "utf8"), updatedAt: state.fetchedAt ?? null };
  }

  const headers = new Headers({ "User-Agent": DATA_UPDATE_CONFIG.userAgent });
  if (!force && state.etag) headers.set("If-None-Match", state.etag);
  if (!force && state.lastModified) headers.set("If-Modified-Since", state.lastModified);
  const response = await fetch(DATA_UPDATE_CONFIG.rfcIndexUrl, { headers });
  if (response.status === 304 && existsSync(indexPath)) {
    return { xml: await readFile(indexPath, "utf8"), updatedAt: state.fetchedAt ?? null };
  }
  if (!response.ok) throw new Error(`RFC Editor: HTTP ${response.status}`);
  const xml = await response.text();
  await writeFile(indexPath, xml);
  const nextState: HttpState = {
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
    fetchedAt: new Date().toISOString(),
  };
  await writeFile(httpStatePath, `${JSON.stringify(nextState, null, 2)}\n`);
  return { xml, updatedAt: nextState.fetchedAt ?? null };
}

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY, number INTEGER NOT NULL, title TEXT NOT NULL,
    authors TEXT NOT NULL, month TEXT, year INTEGER, status TEXT NOT NULL,
    publication_status TEXT NOT NULL, stream TEXT, area TEXT, working_group TEXT,
    abstract TEXT NOT NULL, keywords TEXT NOT NULL, also_ids TEXT NOT NULL, doi TEXT
  );
  CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, kind TEXT NOT NULL,
    UNIQUE(source, target, kind)
  );
  CREATE INDEX IF NOT EXISTS edges_source ON edges(source);
  CREATE INDEX IF NOT EXISTS edges_target ON edges(target);
  CREATE INDEX IF NOT EXISTS edges_kind ON edges(kind);
  CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const { xml, updatedAt } = await fetchIndex();
let parsedNodes = parseRfcIndex(xml);
if (sampleSize && sampleSize > 0) {
  parsedNodes = parsedNodes.slice(-sampleSize);
}
const nodeIds = new Set(parsedNodes.map((node) => node.id));
const bortzmeyerData = await readJson<BortzmeyerData | null>(bortzmeyerDataPath, null);
if (!bortzmeyerData?.articles) {
  throw new Error("Local Bortzmeyer data is missing: run npm run data:bortzmeyer first");
}
console.log(`RFC index: ${parsedNodes.length.toLocaleString("en-US")} documents`);
console.log(
  `Bortzmeyer analyses: ${Object.keys(bortzmeyerData.articles).length.toLocaleString("en-US")} local links`,
);

db.exec("BEGIN");
try {
  db.exec("DELETE FROM nodes; DELETE FROM edges WHERE kind IN ('updates', 'obsoletes');");
  const insertNode = db.prepare(
    `INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertEdge = db.prepare(
    `INSERT OR IGNORE INTO edges(id, source, target, kind) VALUES (?, ?, ?, ?)`,
  );
  for (const node of parsedNodes) {
    insertNode.run(
      node.id,
      node.number,
      node.title,
      JSON.stringify(node.authors),
      node.month,
      node.year,
      node.status,
      node.publicationStatus,
      node.stream,
      node.area,
      node.workingGroup,
      node.abstract,
      JSON.stringify(node.keywords),
      JSON.stringify(node.also),
      node.doi,
    );
    for (const target of node.updates) {
      if (nodeIds.has(target))
        insertEdge.run(`index-updates-${node.id}-${target}`, node.id, target, "updates");
    }
    for (const target of node.obsoletes) {
      if (nodeIds.has(target))
        insertEdge.run(`index-obsoletes-${node.id}-${target}`, node.id, target, "obsoletes");
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const getMeta = db.prepare("SELECT value FROM sync_meta WHERE key = ?");
const setMeta = db.prepare("INSERT OR REPLACE INTO sync_meta(key, value) VALUES (?, ?)");
const previousRelationsSync = getMeta.get("relations_fetched_at") as { value: string } | undefined;
const relationCacheFresh = previousRelationsSync
  ? Date.now() - Date.parse(previousRelationsSync.value) < DATA_UPDATE_CONFIG.relationCacheMaxAgeMs
  : false;

async function fetchRelationPage(offset: number, limit: number): Promise<ApiPage> {
  const url = new URL(DATA_UPDATE_CONFIG.datatrackerRelationsUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("source__type__slug", "rfc");
  url.searchParams.set("target__type__slug", "rfc");
  url.searchParams.set("relationship__slug__in", "ref,refnorm,refinfo");
  for (let attempt = 1; attempt <= DATA_UPDATE_CONFIG.retryAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": DATA_UPDATE_CONFIG.userAgent },
    });
    if (response.ok) return response.json() as Promise<ApiPage>;
    if (attempt === DATA_UPDATE_CONFIG.retryAttempts)
      throw new Error(`Datatracker: HTTP ${response.status} at offset ${offset}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * DATA_UPDATE_CONFIG.retryDelayMs));
  }
  throw new Error("Datatracker unavailable");
}

if (!offline && (!relationCacheFresh || force || sampleSize)) {
  const limit = DATA_UPDATE_CONFIG.relationPageSize;
  const firstPage = await fetchRelationPage(0, limit);
  const pages: ApiPage[] = [firstPage];
  const offsets = Array.from(
    { length: Math.ceil(firstPage.meta.total_count / limit) - 1 },
    (_, i) => (i + 1) * limit,
  );
  console.log(
    `Datatracker relationships: ${firstPage.meta.total_count.toLocaleString("en-US")} to synchronize`,
  );
  for (let i = 0; i < offsets.length; i += DATA_UPDATE_CONFIG.relationConcurrency) {
    const batch = await Promise.all(
      offsets
        .slice(i, i + DATA_UPDATE_CONFIG.relationConcurrency)
        .map((offset) => fetchRelationPage(offset, limit)),
    );
    pages.push(...batch);
    process.stdout.write(
      `\rPages ${Math.min(i + DATA_UPDATE_CONFIG.relationConcurrency + 1, offsets.length + 1)}/${offsets.length + 1}`,
    );
  }
  if (offsets.length) process.stdout.write("\n");
  const relations = pages
    .flatMap((page) => page.objects)
    .map(normalizeRelatedDocument)
    .filter((relation): relation is NormalizedRelation => relation !== null)
    .filter((relation) => nodeIds.has(relation.source) && nodeIds.has(relation.target));

  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM edges WHERE kind LIKE 'reference-%';");
    const insert = db.prepare(
      "INSERT OR IGNORE INTO edges(id, source, target, kind) VALUES (?, ?, ?, ?)",
    );
    for (const relation of relations)
      insert.run(relation.id, relation.source, relation.target, relation.kind);
    if (sampleSize) {
      db.prepare("DELETE FROM sync_meta WHERE key = ?").run("relations_fetched_at");
    } else {
      setMeta.run("relations_fetched_at", new Date().toISOString());
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
} else {
  console.log(
    offline
      ? "Relationships: using offline SQLite cache"
      : "Relationships: using recent SQLite cache",
  );
}

const rows = db
  .prepare(
    "SELECT id, number, title, authors, month, year, status, publication_status, stream, area, working_group, abstract, keywords, also_ids, doi FROM nodes ORDER BY number",
  )
  .all() as Record<string, unknown>[];
const edgeRows = db
  .prepare("SELECT id, source, target, kind FROM edges ORDER BY source, target, kind")
  .all() as Record<string, unknown>[];
const edges: RfcEdge[] = edgeRows
  .map((row) => ({
    id: String(row.id),
    source: String(row.source),
    target: String(row.target),
    kind: String(row.kind) as RelationKind,
  }))
  .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const inDegrees = new Map<string, number>();
const outDegrees = new Map<string, number>();
const citationPairs = new Set<string>();
for (const edge of edges) {
  if (!edge.kind.startsWith("reference-")) continue;
  const pair = `${edge.source}\u0000${edge.target}`;
  if (citationPairs.has(pair)) continue;
  citationPairs.add(pair);
  inDegrees.set(edge.target, (inDegrees.get(edge.target) ?? 0) + 1);
  outDegrees.set(edge.source, (outDegrees.get(edge.source) ?? 0) + 1);
}

const nodes: RfcNode[] = rows.map((row) => ({
  id: String(row.id),
  number: Number(row.number),
  title: String(row.title),
  authors: JSON.parse(String(row.authors)) as string[],
  month: optionalString(row.month),
  year: row.year ? Number(row.year) : null,
  status: String(row.status),
  publicationStatus: String(row.publication_status),
  stream: optionalString(row.stream),
  area: optionalString(row.area),
  workingGroup: optionalString(row.working_group),
  abstract: String(row.abstract),
  keywords: JSON.parse(String(row.keywords)) as string[],
  also: JSON.parse(String(row.also_ids)) as string[],
  doi: optionalString(row.doi),
  bortzmeyerUrl: bortzmeyerData.articles[String(row.number)] ?? null,
  inDegree: inDegrees.get(String(row.id)) ?? 0,
  outDegree: outDegrees.get(String(row.id)) ?? 0,
}));

const years = nodes.flatMap((node) => node.year ?? []);
const artifact: GraphArtifact = {
  meta: {
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: updatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    citationCount: citationPairs.size,
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
    sample: Boolean(sampleSize),
  },
  nodes,
  edges,
};
const temporaryPath = `${graphPath}.tmp`;
await writeFile(temporaryPath, JSON.stringify(artifact));
await rename(temporaryPath, graphPath);
db.close();
console.log(`Artifact: ${graphPath}`);
console.log(
  `${nodes.length.toLocaleString("en-US")} nodes · ${edges.length.toLocaleString("en-US")} edges`,
);
