import { signDevelopmentInitDataForPersona } from "@/lib/mini-app/development-init-data.server";

export function GET(request: Request): Response {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const persona = new URL(request.url).searchParams.get("persona");
  const initDataRaw = signDevelopmentInitDataForPersona(persona);
  if (!initDataRaw) {
    return Response.json({ error: "Unknown persona" }, { status: 404 });
  }

  return Response.json({ initDataRaw });
}
