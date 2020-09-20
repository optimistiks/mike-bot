process.env.BOT_KEY = "fake";
process.env.BOT_USERNAME = "fake";
process.env.LOL_TABLE_NAME = "fake";

import { number, string, value } from "unit.js";
import { lambda } from "../src/index";

describe("Tests index", function () {
  it("verifies successful response", async function () {
    const result = await lambda({} as any);
    number(result.statusCode).is(200);
    string(result.body).contains("missing body");
    value(result).hasHeader("content-type", "application/json");
  });
});
