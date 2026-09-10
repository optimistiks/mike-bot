import { describe, expect, it } from "vitest";

import { postProcess } from "#src/chat/filter.js";

describe("chat reply filters", () => {
  it("strips a leading name label and keeps the reply", () => {
    expect.hasAssertions();
    expect(postProcess("[alice] че")).toBe("че");
  });

  it("strips self-reply labels with time and quote", () => {
    expect.hasAssertions();
    expect(postProcess('[Ты → alice][0 сек. назад][на "бот"] че')).toBe("че");
  });

  it("strips consecutive labels split by newlines", () => {
    expect.hasAssertions();
    expect(postProcess("[alice]\n[0 сек. назад] че")).toBe("че");
  });

  it("does not lowercase names in the reply body", () => {
    expect.hasAssertions();
    expect(postProcess("Max сказал")).toBe("Max сказал");
  });

  it("does not cap the reply at two sentences", () => {
    expect.hasAssertions();
    expect(postProcess("one! two? three!")).toBe("one! two? three!");
  });

  it("strips emoji", () => {
    expect.hasAssertions();
    expect(postProcess("че 👋")).toBe("че");
  });

  it("strips a trailing period", () => {
    expect.hasAssertions();
    expect(postProcess("че.")).toBe("че");
  });

  it("truncates a following labeled line", () => {
    expect.hasAssertions();
    expect(postProcess("че\n[bob] ку")).toBe("че");
  });

  it("strips a leading label then truncates the next labeled line", () => {
    expect.hasAssertions();
    expect(postProcess("[alice] че\n[bob] ку")).toBe("че");
  });

  it("treats a labels-only reply as empty", () => {
    expect.hasAssertions();
    expect(postProcess("[alice][0 сек. назад]")).toBe("");
  });

  it("leaves empty brackets in place", () => {
    expect.hasAssertions();
    expect(postProcess("[] че")).toBe("[] че");
  });

  it("leaves an unclosed bracket prefix in place", () => {
    expect.hasAssertions();
    expect(postProcess("[alice че")).toBe("[alice че");
  });
});
