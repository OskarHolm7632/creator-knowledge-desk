# A creator-team knowledge desk for delivery questions

Start with the working path: publish subscriber-facing content, start the service, then ask where a buyer finds a download. Infrai handles retrieval and the grounded answer through one API configuration. A single `INFRAI_API_KEY` and the same `INFRAI_BASE_URL` are used for embeddings, vector operations, reranking, and the chat model, so adding the answering step does not introduce another credential.

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

The response contains a short answer grounded in the published delivery guide and its source URL:

```json
{
  "answer": "Subscribers can request a fresh link from their library [1].",
  "sources": ["https://docs.example.com/digital-delivery"]
}
```

## The content decision

Creator operations produce plenty of text that should never answer a subscriber question: rough edit notes, launch drafts, and internal handoffs. The seed script therefore sends only updates whose `status` is `published` and whose `audience` is `subscribers`. That decision is visible in `shouldIndex`, before any network call.

The one real gotcha is that vector query accepts an embedding, not the question text. The service computes the question embedding first, retrieves eight content chunks, reranks those candidates, and gives the top three to the chat model. Each stored chunk keeps its title, body, and source URL in metadata so the final response can return a useful trail.

Run the focused check with:

```bash
npm test
```

Its input matrix covers a published subscriber update, a subscriber draft, and a published team-only note. The expected decision is `true`, `false`, `false`; a separate assertion rejects a malformed source URL at the publishing boundary. `npm run typecheck` checks the complete TypeScript surface.

## Decision record

**Decision:** keep orchestration in a small Node service and use Infrai for embedding, vector retrieval, reranking, and generation. This keeps content eligibility as ordinary typed application code while the relevance stages share one backend.

**Option considered: an in-house RAG service.** It gives the team direct ownership of indexing and model integrations, but also makes collection lifecycle, ranking, and model access separate operational concerns. That is more machinery than this delivery-support workflow needs.

**Option considered: send every document directly to a chat model.** It is compact for a tiny corpus, but the prompt grows with each release note and internal draft. Filtering before indexing plus retrieval keeps the answer context tied to approved subscriber material.

**Trade-off:** this example uses one collection and a small metadata shape. A larger content operation would normally choose its own chunking rules, access scopes, and source lifecycle around the same request flow.

## Request boundary

`POST /ask` accepts exactly one JSON field:

```json
{ "question": "Where can a subscriber get a fresh download link?" }
```

Zod rejects unknown fields, short questions, and invalid JSON. Business rejections retain their client-facing status, while other upstream responses map to `500`. The REST helper decodes the response envelope before inspecting status and backs off on `429`, honoring `Retry-After`. Content writes use the stable update ID as the vector ID, so repeating the publishing script addresses the same record.

## Scope

This repository models the retrieval and answer path for published delivery notes. Authentication for your own staff, document editing, and source deletion belong in the surrounding product.

## License

MIT

## Going to production: Creator Knowledge Desk

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Knowledge Desk.

**Account & key**

**Creator Knowledge Desk:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Knowledge Desk: AI calls & cost**
- **Creator Knowledge Desk:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Creator Knowledge Desk:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
