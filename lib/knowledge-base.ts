import fs from "node:fs";
import path from "node:path";
import Fuse from "fuse.js";

export interface KnowledgeChunk {
  id: string;
  file: string;
  heading: string;
  content: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

function chunkMarkdownFile(fileName: string, raw: string): KnowledgeChunk[] {
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : fileName;

  // Split into one chunk per level-2 (##) section; the intro before the first
  // ## heading becomes its own chunk under the document title.
  const sections = raw.split(/\n(?=##\s)/);

  return sections
    .map((section, index) => {
      const headingMatch = section.match(/^##\s+(.+)/);
      const heading = headingMatch ? headingMatch[1].trim() : title;
      const content = section.trim();
      return { id: `${fileName}#${index}-${heading}`, file: fileName, heading, content };
    })
    .filter((chunk) => chunk.content.length > 0);
}

function loadChunks(): KnowledgeChunk[] {
  const files = fs.readdirSync(DATA_DIR).filter((file) => file.endsWith(".md"));
  return files.flatMap((file) => chunkMarkdownFile(file, fs.readFileSync(path.join(DATA_DIR, file), "utf-8")));
}

// Parse the markdown knowledge base into memory once per server process instead of per
// request (no vector DB / embedding step needed for this dataset size), and keep it across
// Next.js dev hot-reloads via globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __kbChunks: KnowledgeChunk[] | undefined;
  // eslint-disable-next-line no-var
  var __kbFuse: Fuse<KnowledgeChunk> | undefined;
}

function getChunks(): KnowledgeChunk[] {
  if (!globalThis.__kbChunks) {
    globalThis.__kbChunks = loadChunks();
  }
  return globalThis.__kbChunks;
}

function getFuse(): Fuse<KnowledgeChunk> {
  if (!globalThis.__kbFuse) {
    globalThis.__kbFuse = new Fuse(getChunks(), {
      keys: [
        { name: "heading", weight: 0.4 },
        { name: "content", weight: 0.6 },
      ],
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.45,
      minMatchCharLength: 3,
    });
  }
  return globalThis.__kbFuse;
}

// Error codes and auth acronyms are matched verbatim in addition to the fuzzy search so an
// ambiguous question (e.g. "403 Forbidden") pulls in every product's matching section, not
// just the single closest text match.
const KEYWORD_PATTERN = /\b\d{3}\b|saml|oidc|openid|sso/gi;
const MAX_RESULTS = 10;
const PRODUCT_FILE_PREFIXES = ["vault", "pulse", "relay", "ledger"];
// Docs that describe rules shared across every product (e.g. the Vault/security-overview SAML
// conflict); these must stay prominent whenever a specific product is also being discussed.
const CROSS_CUTTING_FILES = new Set(["security-overview.md", "support-policy.md"]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "do",
  "does",
  "did",
  "what",
  "whats",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "for",
  "of",
  "to",
  "in",
  "on",
  "at",
  "and",
  "or",
  "but",
  "with",
  "about",
  "i",
  "my",
  "me",
  "you",
  "your",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "can",
  "could",
  "should",
  "would",
  "will",
  "get",
  "getting",
  "got",
  "first",
]);

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
    ),
  );
}

export function searchKnowledgeBase(query: string, limit = 6): KnowledgeChunk[] {
  const chunks = getChunks();
  const fuse = getFuse();

  // Aggregate every match source (keyword, whole-query, per-token) into one scored candidate
  // map instead of concatenating ordered lists and truncating. The earlier ordered-merge
  // approach let generic words positioned early in a sentence ("key", "differences", "between")
  // fill the result cap before a specific word like a product name ("relay") -- appearing later
  // in the sentence -- ever got its turn, so the actually-relevant chunk was silently dropped.
  interface Candidate {
    chunk: KnowledgeChunk;
    bestScore: number; // lower is better (Fuse convention); 0 for forced keyword matches
    matchCount: number; // how many distinct search signals (tokens/keywords) hit this chunk
    keyword: boolean;
  }
  const candidates = new Map<string, Candidate>();

  function record(chunk: KnowledgeChunk, score: number, keyword = false) {
    const existing = candidates.get(chunk.id);
    if (existing) {
      existing.matchCount += 1;
      existing.bestScore = Math.min(existing.bestScore, score);
      existing.keyword = existing.keyword || keyword;
    } else {
      candidates.set(chunk.id, { chunk, bestScore: score, matchCount: 1, keyword });
    }
  }

  // Error codes and auth acronyms are matched verbatim so an ambiguous question (e.g. "403
  // Forbidden") pulls in every product's matching section, not just the single closest match.
  const keywords = query.match(KEYWORD_PATTERN) ?? [];
  if (keywords.length) {
    for (const chunk of chunks) {
      if (keywords.some((keyword) => chunk.content.toLowerCase().includes(keyword.toLowerCase()))) {
        record(chunk, 0, true);
      }
    }
  }

  // Whole-query fuzzy search wins on short, precise queries.
  for (const result of fuse.search(query, { limit })) {
    record(result.item, result.score ?? 1);
  }

  // Fuse treats the whole query as one fuzzy pattern, which matches almost nothing once a
  // question is more than a few words long. Searching each significant word individually keeps
  // recall high for natural-language questions; tallying matchCount/bestScore per chunk (rather
  // than token processing order) is what lets ranking below prioritize correctly.
  for (const token of tokenize(query)) {
    for (const result of fuse.search(token, { limit: 6 })) {
      record(result.item, result.score ?? 1);
    }
  }

  // If the query names a specific product, float that product's chunks and cross-cutting docs
  // (security-overview.md etc.) ahead of same-score noise from other products -- this is what
  // makes the model reliably notice e.g. a vault.md vs security-overview.md SAML tier conflict
  // instead of that passage being buried among unrelated products' release notes.
  const namedProduct = PRODUCT_FILE_PREFIXES.find((name) => query.toLowerCase().includes(name));
  function productRank(chunk: KnowledgeChunk): number {
    if (!namedProduct) return 0;
    if (chunk.file.startsWith(namedProduct)) return 0;
    if (CROSS_CUTTING_FILES.has(chunk.file)) return 1;
    return 2;
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => {
    if (a.keyword !== b.keyword) return a.keyword ? -1 : 1;
    const productDelta = productRank(a.chunk) - productRank(b.chunk);
    if (productDelta !== 0) return productDelta;
    if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
    return a.bestScore - b.bestScore;
  });

  return ranked.slice(0, MAX_RESULTS).map((entry) => entry.chunk);
}
