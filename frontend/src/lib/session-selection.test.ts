import { describe, expect, it } from "vitest";

import { pruneSelection } from "./session-selection";

describe("pruneSelection", () => {
  it("keeps only visible paths", () => {
    const selected = new Set(["a", "b"]);
    const next = pruneSelection(selected, ["a", undefined]);
    expect([...next]).toEqual(["a"]);
  });

  it("returns the same set when nothing changes", () => {
    const selected = new Set(["a"]);
    expect(pruneSelection(selected, ["a", "b"])).toBe(selected);
  });

  it("drops undeletable paths without a path", () => {
    const selected = new Set(["a"]);
    expect([...pruneSelection(selected, [undefined])]).toEqual([]);
  });
});
