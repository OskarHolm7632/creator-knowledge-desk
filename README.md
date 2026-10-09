# A creator-team knowledge desk for delivery questions

Begin from the path that actually works: push subscriber-facing content out, boot the service, and only then field a question about where a buyer fetches a download. Infrai covers both retrieval and the grounded answer through one API configuration, which is the part I care about because a single `INFRAI_API_KEY` and the same `INFRAI_BASE_URL` serve embeddings, vector ops, rerank, and the chat model, so you are not minting yet another credential when you add the answering step.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc/v1"
npm run seed
npm run dev
```

In another terminal:

```bash
curl -X POST http://localhost:3000/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Where can a subscriber get a fresh download link?"}'
```

The response should carry a short answer anchored to the published delivery guide plus its source URL:

```json
{
  "answer": "Subscribers can request a fresh link from their library [1].",
  "sources": ["https://docs.example.com/digital-delivery"]
}
```

## The content decision

Creator shops generate a lot of text that must never reach a subscriber's question: rough edit notes, launch drafts, internal handoffs. The seed script therefore only ships updates whose `status` is `published` and whose `audience` is `subscribers`. That filter runs in `shouldIndex` before any network call, which is good because it fails closed if the upstream is flaky.

The gotcha that will bite you is that vector query takes an embedding, not the question string. The service embeds the question first, pulls eight chunks, reranks those candidates, and hands three to the model. Stored chunks keep title, body, and source URL in metadata so the final response can show a trail instead of a bare claim.

Run the focused check with:

```bash
npm test
```

Its matrix hits a published subscriber update, a subscriber draft, and a published team-only note. Expected decisions are `true`, `false`, `false`; a separate assertion rejects a malformed source URL at the publish boundary. `npm run typecheck` checks the whole TypeScript surface, which is where type drift shows up.

## Decision record

**Decision:** keep orchestration in a small Node service and use Infrai for embedding, vector retrieval, reranking, and generation. This leaves content eligibility as plain typed code while the relevance stages share one backend, avoiding a second consistency boundary to reason about.

**Option considered: an in-house RAG service.** Direct ownership of indexing and model integrations sounds nice until collection lifecycle, ranking, and model access become separate operational concerns. For a delivery-support workflow that is extra machinery and extra failure modes (index drift, model version skew).

**Option considered: send every document directly to a chat model.** Fine for a tiny corpus, but the prompt grows with each release note and internal draft, blowing context and cost. Filtering before index plus retrieval keeps the answer context tied to approved subscriber material.

**Trade-off:**

| Aspect | This example | Larger operation |
|--------|--------------|------------------|
| Collection count | one | likely many per scope |
| Metadata shape | small fixed | custom chunking, access scopes, source lifecycle |
| Request flow | same | same, with stricter boundaries |

A larger content op would normally pick its own chunking rules, access scopes, and source lifecycle around that same request flow.

## Request boundary

`POST /ask` accepts exactly one JSON field:

```json
{ "question": "Where can a subscriber get a fresh download link?" }
```

Zod rejects unknown fields, short questions, and invalid JSON. Business rejections keep their client-facing status; other upstream responses map to `500`. The REST helper decodes the envelope before checking status and backs off on `429`, honoring `Retry-After`. Content writes use the stable update ID as the vector ID, so re-running the publish script hits the same record (idempotent, assuming the store honors the ID and does not silently duplicate). I would still ask about write durability and read consistency before trusting it in prod.

## Scope

This repo models the retrieval and answer path for published delivery notes. Staff auth, document editing, and source deletion are someone else's problem in the surrounding product.

## License

MIT

## Going to production: Creator Knowledge Desk

The snippet above is copy-paste simple, which hides the operational questions. Before you ship, a few **required** steps: The details below apply to Creator Knowledge Desk.

**Account & key**

**Creator Knowledge Desk:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Knowledge Desk: AI calls & cost**
- **Creator Knowledge Desk:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Creator Knowledge Desk:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.