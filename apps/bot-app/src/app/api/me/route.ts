import { env } from "@/env";
import { authenticateTmaOpener } from "@/tma/init-data";

function GET(request: Request): Response {
  const opener = authenticateTmaOpener(request.headers.get("authorization"), env.BOT_TOKEN);
  if (opener === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(opener);
}

export { GET };
