import { getLocale } from "./i18n";

/** A short relative time for sidebars and metadata. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((then - Date.now()) / 1000);
  const locale = getLocale() === "zh" ? "zh-CN" : "en";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return getLocale() === "zh" ? "刚刚" : "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), "day");
  return new Date(then).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

/** Wall-clock time shown under a message. */
export function messageTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString(getLocale() === "zh" ? "zh-CN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Truncates a middle path for narrow rows. */
export function shortPath(path: string, max = 46): string {
  if (path.length <= max) return path;
  const parts = path.split("/");
  const tail = parts.slice(-2).join("/");
  if (tail.length + 2 <= max) return `…/${tail}`;
  return `…${path.slice(-(max - 1))}`;
}

/** Humanizes a platform key. */
export function platformName(platform: string): string {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return platform;
  }
}
