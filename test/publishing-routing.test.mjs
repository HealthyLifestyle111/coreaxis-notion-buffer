import test from "node:test";
import assert from "node:assert/strict";
import { hasPublicationIdentity, missingCredentials, resolvePublisher } from "../scripts/publishing-routing.mjs";
import { normalizedMediaPayload } from "../scripts/notion-metricool-sync.mjs";

test("routes approved Buffer platforms only when Send to Buffer is checked", () => {
  assert.equal(resolvePublisher({ platforms: ["X", "Pinterest"], sendToBuffer: true }).publisher, "buffer");
});

test("fails closed when a Buffer record contains Instagram", () => {
  assert.equal(resolvePublisher({ platforms: ["X", "Instagram"], sendToBuffer: true }).publisher, "invalid");
});

test("honors an explicit Metricool route for Instagram and TikTok", () => {
  assert.equal(resolvePublisher({
    platforms: ["Instagram", "TikTok"],
    distributionRoute: "Metricool",
  }).publisher, "metricool");
});

test("does not silently route an implicit Instagram and TikTok record to native", () => {
  assert.equal(resolvePublisher({ platforms: ["Instagram", "TikTok"] }).publisher, "metricool");
});

test("routes a native-only Instagram record to native", () => {
  assert.equal(resolvePublisher({ platforms: ["Instagram"] }).publisher, "native");
});

test("requires both Meta credentials for Instagram", () => {
  assert.deepEqual(missingCredentials("Instagram", { META_ACCESS_TOKEN: "token" }), ["META_IG_USER_ID"]);
  assert.deepEqual(missingCredentials("Instagram", {
    META_ACCESS_TOKEN: "token",
    META_IG_USER_ID: "123",
  }), []);
});

test("detects an existing scheduler or external post ID before republishing", () => {
  assert.equal(hasPublicationIdentity("", "Metricool:351326300"), true);
  assert.equal(hasPublicationIdentity("", "  "), false);
});

test("builds the Metricool media object from a normalized mediaId", () => {
  assert.deepEqual(normalizedMediaPayload({ mediaId: 351326300 }), { mediaId: "351326300" });
});

test("does not mistake a normalized URL for a Metricool media identity", () => {
  assert.equal(normalizedMediaPayload({ url: "https://cdn.example.com/video.mp4" }), null);
});
