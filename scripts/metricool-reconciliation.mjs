export function stripMetricoolPrefix(value) {
  return String(value || "").trim().replace(/^Metricool:/i, "");
}

export function providerOutcome(post) {
  const providers = Array.isArray(post?.providers) ? post.providers : [];
  const published = providers.filter((p) => /published|sent|success|done/i.test(String(p?.status || "")));
  const failed = providers.filter((p) => /error|failed|rejected/i.test(String(p?.status || "")));
  const pending = providers.filter((p) => !published.includes(p) && !failed.includes(p));
  const ids = published.map((p) => p?.externalId || p?.postId || p?.id).filter(Boolean).map(String);
  const urls = published.map((p) => p?.url || p?.permalink || p?.postUrl || p?.externalUrl).filter(Boolean).map(String);
  return {
    state: failed.length ? "failed" : (published.length && pending.length === 0 ? "published" : "pending"),
    externalId: ids.join(","),
    publicUrl: urls[0] || post?.url || post?.permalink || post?.postUrl || post?.externalUrl || "",
    error: failed.map((p) => p?.error || p?.message || `${p?.network || "provider"}:${p?.status}`).filter(Boolean).join(" | "),
  };
}

export function notionReconciliationProperties(outcome, now = new Date()) {
  if (outcome.state === "published") {
    if (!outcome.externalId || !outcome.publicUrl) {
      return {
        "CoreAxis Automation Status": { select: { name: "Error" } },
        "Publishing Status": { select: { name: "Failed" } },
        "Publishing Error": { rich_text: [{ text: { content: "Metricool reported publication without both a real external post ID and public URL." } }] },
      };
    }
    return {
      "External Post ID": { rich_text: [{ text: { content: outcome.externalId.slice(0, 1900) } }] },
      "Public Post URL": { url: outcome.publicUrl },
      "Published At": { date: { start: now.toISOString() } },
      "CoreAxis Automation Status": { select: { name: "Published" } },
      "Publishing Status": { select: { name: "Published" } },
      "Publishing Error": { rich_text: [] },
    };
  }
  if (outcome.state === "failed") {
    return {
      "CoreAxis Automation Status": { select: { name: "Error" } },
      "Publishing Status": { select: { name: "Failed" } },
      "Publishing Error": { rich_text: [{ text: { content: String(outcome.error || "Metricool publication failed").slice(0, 1900) } }] },
    };
  }
  return {};
}
