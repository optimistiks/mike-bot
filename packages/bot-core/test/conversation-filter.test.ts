import { describe, expect, it } from "vitest";

import { postProcess } from "#src/conversation/filter.js";

describe("conversation reply filters", () => {
  it("strips a leading name label and keeps the reply", () => {
    expect.hasAssertions();
    expect(postProcess("[alice] че")).toStrictEqual({
      filters: ["leading-label"],
      text: "че",
    });
  });

  it("strips self-reply labels with time and quote", () => {
    expect.hasAssertions();
    expect(postProcess('[Ты → alice][0 сек. назад][на "бот"] че')).toStrictEqual({
      filters: ["leading-label"],
      text: "че",
    });
  });

  it("strips consecutive labels split by newlines", () => {
    expect.hasAssertions();
    expect(postProcess("[alice]\n[0 сек. назад] че")).toStrictEqual({
      filters: ["leading-label"],
      text: "че",
    });
  });

  it("does not lowercase names in the reply body", () => {
    expect.hasAssertions();
    expect(postProcess("Max сказал")).toStrictEqual({
      filters: [],
      text: "Max сказал",
    });
  });

  it("does not cap the reply at two sentences", () => {
    expect.hasAssertions();
    expect(postProcess("one! two? three!")).toStrictEqual({
      filters: [],
      text: "one! two? three!",
    });
  });

  it("strips emoji", () => {
    expect.hasAssertions();
    expect(postProcess("че 👋")).toStrictEqual({
      filters: ["emoji"],
      text: "че",
    });
  });

  it("strips a trailing period", () => {
    expect.hasAssertions();
    expect(postProcess("че.")).toStrictEqual({
      filters: [],
      text: "че",
    });
  });

  it("truncates a following labeled line", () => {
    expect.hasAssertions();
    expect(postProcess("че\n[bob] ку")).toStrictEqual({
      filters: ["label-truncate"],
      text: "че",
    });
  });

  it("strips a leading label then truncates the next labeled line", () => {
    expect.hasAssertions();
    expect(postProcess("[alice] че\n[bob] ку")).toStrictEqual({
      filters: ["leading-label", "label-truncate"],
      text: "че",
    });
  });

  it("treats a labels-only reply as empty", () => {
    expect.hasAssertions();
    expect(postProcess("[alice][0 сек. назад]")).toStrictEqual({
      filters: ["leading-label", "empty"],
      text: "",
    });
  });

  it("leaves empty brackets in place", () => {
    expect.hasAssertions();
    expect(postProcess("[] че")).toStrictEqual({
      filters: [],
      text: "[] че",
    });
  });

  it("leaves an unclosed bracket prefix in place", () => {
    expect.hasAssertions();
    expect(postProcess("[alice че")).toStrictEqual({
      filters: [],
      text: "[alice че",
    });
  });
});
