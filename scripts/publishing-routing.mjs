export const BUFFER_PLATFORMS = new Set(["X", "LinkedIn", "Pinterest"]);
export const NATIVE_PLATFORMS = new Set(["Instagram", "Facebook", "LinkedIn", "YouTube Shorts"]);
export const METRICOOL_PLATFORMS = new Set(["Instagram", "TikTok", "YouTube", "YouTube Shorts"]);

const normalize = (value) => String(value || "").trim();

export function resolvePublisher({ platforms = [], sendToBuffer = false, distributionRoute = "" }) {
  const route = normalize(distributionRoute).toLowerCase();
  const unique = [...new Set(platforms.map(normalize).filter(Boolean))];
  if (!unique.length) return { publisher: "invalid", reason: "No platform is selected." };
  if (/manual/.test(route)) return { publisher: "manual" };
  if (/metricool|external video/.test(route)) {
    const unsupported = unique.filter((p) => !METRICOOL_PLATFORMS.has(p));
    return unsupported.length ? { publisher: "invalid", reason: `Metricool route contains unsupported platform(s): ${unsupported.join(", ")}` } : { publisher: "metricool" };
  }
  if (sendToBuffer) {
    const unsupported = unique.filter((p) => !BUFFER_PLATFORMS.has(p));
    return unsupported.length ? { publisher: "invalid", reason: `Buffer route contains unsupported platform(s): ${unsupported.join(", ")}` } : { publisher: "buffer" };
  }
  if (unique.every((p) => NATIVE_PLATFORMS.has(p))) return { publisher: "native" };
  if (unique.every((p) => METRICOOL_PLATFORMS.has(p))) return { publisher: "metricool" };
  return { publisher: "invalid", reason: `Record mixes publishers or has no supported publisher: ${unique.join(", ")}` };
}

export function requiredCredentials(platform) {
  if (platform === "Instagram") return ["META_ACCESS_TOKEN", "META_IG_USER_ID"];
  if (platform === "Facebook") return ["META_ACCESS_TOKEN", "META_PAGE_ID"];
  if (platform === "YouTube Shorts") return ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"];
  if (platform === "LinkedIn") return ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"];
  return [];
}

export function missingCredentials(platform, env = process.env) {
  return requiredCredentials(platform).filter((name) => !env[name]);
}

export function hasPublicationIdentity(...values) {
  return values.some((value) => normalize(value).length > 0);
}
