import assert from "node:assert/strict";
import test from "node:test";
import { contentUpdateSchema, shouldIndex } from "../src/publication_policy.js";

const base = {
  id: "asset-delivery-12",
  title: "Download delivery",
  body: "The mastered files are ready.",
  sourceUrl: "https://docs.example.com/delivery/12",
};

test("only published subscriber updates enter the answer corpus", () => {
  assert.equal(shouldIndex(contentUpdateSchema.parse({ ...base, status: "published", audience: "subscribers" })), true);
  assert.equal(shouldIndex(contentUpdateSchema.parse({ ...base, status: "draft", audience: "subscribers" })), false);
  assert.equal(shouldIndex(contentUpdateSchema.parse({ ...base, status: "published", audience: "team" })), false);
});

test("a malformed source is rejected at the publishing boundary", () => {
  assert.throws(() => contentUpdateSchema.parse({ ...base, sourceUrl: "notes", status: "published", audience: "subscribers" }));
});
