import { contentUpdateSchema } from "../src/publication_policy.js";
import { prepareCollection, publishUpdate } from "../src/knowledge_workflow.js";

const updates = [
  {
    id: "delivery-guide-v3",
    title: "Where subscribers find their digital downloads",
    body: "After checkout, the download link appears on the receipt screen and in the delivery email. Signed links remain available for 24 hours; subscribers can request a fresh link from their library.",
    sourceUrl: "https://docs.example.com/digital-delivery",
    status: "published",
    audience: "subscribers",
  },
  {
    id: "spring-edit-draft",
    title: "Spring footage processing notes",
    body: "Editors are still reviewing the color pass and captions.",
    sourceUrl: "https://docs.example.com/spring-edit",
    status: "draft",
    audience: "team",
  },
] as const;

await prepareCollection();
for (const raw of updates) {
  const update = contentUpdateSchema.parse(raw);
  console.log(`${update.id}: ${await publishUpdate(update)}`);
}
