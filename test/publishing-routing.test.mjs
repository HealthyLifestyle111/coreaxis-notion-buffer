import test from "node:test";
import assert from "node:assert/strict";
import { hasPublicationIdentity, missingCredentials, resolvePublisher } from "../scripts/publishing-routing.mjs";
import { notionReconciliationProperties, providerOutcome, stripMetricoolPrefix } from "../scripts/metricool-reconciliation.mjs";

test("routes approved Buffer platforms only when Send to Buffer is checked", () => assert.equal(resolvePublisher({ platforms: ["X", "Pinterest"], sendToBuffer: true }).publisher, "buffer"));
test("fails closed when a Buffer record contains Instagram", () => assert.equal(resolvePublisher({ platforms: ["X", "Instagram"], sendToBuffer: true }).publisher, "invalid"));
test("honors an explicit Metricool route for Instagram and TikTok", () => assert.equal(resolvePublisher({ platforms: ["Instagram", "TikTok"], distributionRoute: "Metricool" }).publisher, "metricool"));
test("does not silently route an implicit Instagram and TikTok record to native", () => assert.equal(resolvePublisher({ platforms: ["Instagram", "TikTok"] }).publisher, "metricool"));
test("routes a native-only Instagram record to native", () => assert.equal(resolvePublisher({ platforms: ["Instagram"] }).publisher, "native"));
test("requires both Meta credentials for Instagram", () => { assert.deepEqual(missingCredentials("Instagram", { META_ACCESS_TOKEN: "token" }), ["META_IG_USER_ID"]); assert.deepEqual(missingCredentials("Instagram", { META_ACCESS_TOKEN: "token", META_IG_USER_ID: "123" }), []); });
test("detects any existing publication identity before republishing", () => { assert.equal(hasPublicationIdentity("", "Metricool:351326300"), true); assert.equal(hasPublicationIdentity("", "  "), false); });
test("strips Metricool scheduler prefix", () => assert.equal(stripMetricoolPrefix("Metricool:351326300"), "351326300"));
test("requires all providers to publish before declaring publication", () => assert.equal(providerOutcome({ providers: [{ network: "instagram", status: "PUBLISHED", externalId: "ig1", url: "https://instagram.com/p/ig1" }, { network: "tiktok", status: "PENDING" }] }).state, "pending"));
test("extracts real external IDs and public URL after publication", () => { const outcome = providerOutcome({ providers: [{ network: "instagram", status: "PUBLISHED", externalId: "ig1", url: "https://instagram.com/p/ig1" }] }); assert.deepEqual(outcome, { state: "published", externalId: "ig1", publicUrl: "https://instagram.com/p/ig1", error: "" }); const properties = notionReconciliationProperties(outcome, new Date("2026-08-01T12:00:00.000Z")); assert.equal(properties["Publishing Status"].select.name, "Published"); assert.equal(properties["External Post ID"].rich_text[0].text.content, "ig1"); assert.equal(properties["Public Post URL"].url, "https://instagram.com/p/ig1"); });
test("fails closed when Metricool claims publication without public proof", () => assert.equal(notionReconciliationProperties({ state: "published", externalId: "ig1", publicUrl: "", error: "" })["Publishing Status"].select.name, "Failed"));
