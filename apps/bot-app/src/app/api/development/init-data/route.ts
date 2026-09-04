import { isProduction } from "@/tma/env";
import { signMockInitData } from "@/tma/sign-mock-init-data";

function GET(): Response {
  if (isProduction()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ initDataRaw: signMockInitData() });
}

export { GET };
