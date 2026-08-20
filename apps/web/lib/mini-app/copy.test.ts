import { describe, expect, it } from "vitest";

import {
  GO_REGISTER_EMPTY_STATE_HINT,
  GO_REGISTER_EMPTY_STATE_TITLE,
} from "./copy";

describe("go register empty state copy", () => {
  it("titles the registration requirement", () => {
    expect(GO_REGISTER_EMPTY_STATE_TITLE).toMatch(/зарегистрир/i);
    expect(GO_REGISTER_EMPTY_STATE_TITLE).toMatch(/лидер/i);
  });

  it("prompts to react to the Registration message", () => {
    expect(GO_REGISTER_EMPTY_STATE_HINT).toMatch(/реакци/i);
    expect(GO_REGISTER_EMPTY_STATE_HINT).toMatch(/регистрац/i);
  });

  it("asks a group admin to run /register", () => {
    expect(GO_REGISTER_EMPTY_STATE_HINT).toContain("/register");
    expect(GO_REGISTER_EMPTY_STATE_HINT).toMatch(/администратор/i);
  });
});
