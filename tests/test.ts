process.env.BOT_KEY = "fake";
process.env.BOT_USERNAME = "fake";

import { number, string, value } from "unit.js";
import { lambda } from "../src/index";

describe("Tests index", function () {
  it("verifies successful response", async function () {
    const result = await lambda({} as any);
    number(result.statusCode).is(200);
    string(result.body).contains("ok");
    value(result).hasHeader("content-type", "application/json");
  });
});
