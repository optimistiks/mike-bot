import { describe, expect, it } from "vitest";

import {
  parseUserIdFromInitData,
  readInitDataFromAuthorization,
} from "./init-data";

describe("parseUserIdFromInitData", () => {
  it("reads user.id from a URL-encoded initData query string", () => {
    const initData =
      "query_id=AAE&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Alice%22%7D&auth_date=1700000000&hash=abc";

    expect(parseUserIdFromInitData(initData)).toBe(12345);
  });

  it("returns null when user is missing", () => {
    expect(parseUserIdFromInitData("auth_date=1700000000&hash=abc")).toBeNull();
  });

  it("returns null for invalid user json", () => {
    expect(parseUserIdFromInitData("user=not-json&hash=abc")).toBeNull();
  });
});

describe("readInitDataFromAuthorization", () => {
  it("strips the tma prefix from Authorization", () => {
    const header = "tma query_id=1&user=%7B%22id%22%3A99%7D&hash=x";

    expect(readInitDataFromAuthorization(header)).toBe(
      "query_id=1&user=%7B%22id%22%3A99%7D&hash=x",
    );
  });

  it("returns null for missing or invalid headers", () => {
    expect(readInitDataFromAuthorization(null)).toBeNull();
    expect(readInitDataFromAuthorization("Bearer token")).toBeNull();
  });
});
