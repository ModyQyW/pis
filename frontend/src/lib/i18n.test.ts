import { afterEach, describe, expect, it } from "vitest";

import { getLocale, setLocale, t } from "./i18n";

afterEach(() => setLocale("en"));

describe("i18n", () => {
  it("translates known copy and keeps unknown copy", () => {
    setLocale("zh");
    expect(getLocale()).toBe("zh");
    expect(document.documentElement.lang).toBe("zh-Hans");
    expect(t("New chat")).toBe("新对话");
    expect(t("a string that is not translated")).toBe("a string that is not translated");
  });

  it("fills placeholders in translated copy", () => {
    setLocale("zh");
    expect(t("{count} files", { count: 3 })).toBe("3 个文件");
    expect(t("Revert {path}?", { path: "a.ts" })).toBe("还原 a.ts？");
  });
});
