import { authenticateTmaRequestOpener } from "@/tma/request-auth";

function GET(request: Request): Response {
  const opener = authenticateTmaRequestOpener(request.headers.get("authorization"));
  if (opener === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(opener);
}

export { GET };
