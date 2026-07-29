export const BUFFER_PLATFORMS = new Set(["X", "LinkedIn", "Pinterest"]);
export const NATIVE_PLATFORMS = new Set(["Instagram", "Facebook", "LinkedIn", "YouTube Shorts"]);
export const METRICOOL_PLATFORMS = new Set(["Instagram", "TikTok", "YouTube", "YouTube Shorts"]);

function allIn(platforms, allowed) {
  return platforms.length > 0 && platforms.every((platform) => allowed.has(platform));
}

export function resolvePublisher({ platforms, sendToBuffer = false, distributionRoute = "" }) {
  const route = String(distributionRoute).trim().toLowerCase();

  if (/manual/.test(route)) return { publisher: "manual" };
  if (/metricool|external video/.test(route)) {
    const unsupported = platforms.filter((platform) => !METRICOOL_PLATFORMS.has(platform));
    return unsupported.length
      ? { publisher: "invalid", reason: `Metricool route contains unsupported platform(s): ${unsupported.join(", ")}` }
      : { publisher: "metricool" };
  }

  if (sendToBuffer) {
    const unsupported = platforms.filter((platform) => !BUFFER_PLATFORMS.has(platform));
    return unsupported.length
      ? { publisher: "invalid", reason: `Buffer route contains unsupported platform(s): ${unsupported.join(", ")}` }
      : { publisher: "buffer" };
  }

  if (allIn(platforms, NATIVE_PLATFORMS)) return { publisher: "native" };
  if (allIn(platforms, METRICOOL_PLATFORMS)) return { publisher: "metricool" };

  return {
    publisher: "invalid",
    reason: `Record mixes publishers or has no supported publisher: ${platforms.join(", ") || "(none)"}`,
  };
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
  return values.some((value) => String(value || "").trim().length > 0);
}
