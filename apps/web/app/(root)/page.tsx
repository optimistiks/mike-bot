import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { persona } = await searchParams;
  const destination = new URL("http://mini-app.local/chats");
  if (typeof persona === "string") {
    destination.searchParams.set("persona", persona);
  }
  redirect(`${destination.pathname}${destination.search}`);
}
