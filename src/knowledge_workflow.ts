import { ai, infraiPost } from "./infrai_gateway.js";
import { type ContentUpdate, shouldIndex } from "./publication_policy.js";

export const COLLECTION = "creator-delivery-notes";
const EMBEDDING_MODEL = "text-embedding-3-small";

type VectorItem = { id: string; score: number; metadata?: Record<string, unknown> };
type QueryData = { items: VectorItem[] };
type RankedItem = { index: number; score: number };
type RerankData = { items: RankedItem[] };

export async function prepareCollection(): Promise<void> {
  await infraiPost("/v1/vector/collection/create", {
    collection: COLLECTION,
    dimension: 1536,
    metric: "cosine",
    metadata: { purpose: "subscriber delivery notes" },
  });
}

export async function publishUpdate(update: ContentUpdate): Promise<"indexed" | "skipped"> {
  if (!shouldIndex(update)) return "skipped";
  const input = `${update.title}\n${update.body}`;
  const embedded = await ai.embeddings.create({ model: EMBEDDING_MODEL, input });
  await infraiPost("/v1/vector/upsert", {
    collection: COLLECTION,
    vectors: [{
      id: update.id,
      embedding: embedded.data[0].embedding,
      metadata: { title: update.title, body: update.body, sourceUrl: update.sourceUrl },
    }],
  });
  return "indexed";
}

export async function answerFromUpdates(question: string): Promise<{ answer: string; sources: string[] }> {
  const embedded = await ai.embeddings.create({ model: EMBEDDING_MODEL, input: question });
  const found = await infraiPost<QueryData>("/v1/vector/query", {
    collection: COLLECTION,
    embedding: embedded.data[0].embedding,
    top_k: 8,
    include_metadata: true,
  });
  const candidates = found.items.map((item) => {
    const title = String(item.metadata?.title ?? "Untitled update");
    const body = String(item.metadata?.body ?? "");
    return `${title}\n${body}`;
  });

  if (candidates.length === 0) {
    return { answer: "I could not find a published subscriber update that answers this.", sources: [] };
  }

  const ranked = await infraiPost<RerankData>("/v1/ai/rerank", {
    query: question,
    candidates,
    top_k: 3,
    model: "auto",
    vendor: "auto",
  });
  const selected = ranked.items.map((item) => found.items[item.index]).filter(Boolean);
  const context = selected.map((item, index) => `Source ${index + 1}: ${candidates[found.items.indexOf(item)]}`).join("\n\n");
  const completion = await ai.chat.completions.create({
    model: "auto",
    messages: [
      { role: "system", content: "Answer only from the supplied creator update context. Be concise and cite sources as [1], [2], or [3]." },
      { role: "user", content: `Question: ${question}\n\n${context}` },
    ],
  });
  return {
    answer: completion.choices[0]?.message.content ?? "No answer was produced.",
    sources: selected.map((item) => String(item.metadata?.sourceUrl ?? "")).filter(Boolean),
  };
}
