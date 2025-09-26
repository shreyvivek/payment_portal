export async function POST(_req: Request) {
  try {
    return new Response("OK");
  } catch (e) {
    console.error("register route error:", e);
    return new Response("Bad Request", { status: 400 });
  }
}
