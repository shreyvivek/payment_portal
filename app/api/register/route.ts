export async function POST(req: Request) {
  try {
    // const payload = await req.json(); // if you want to inspect/validate
    return new Response("OK");
  } catch (e) {
    console.error("register route error:", e);
    return new Response("Bad Request", { status: 400 });
  }
}
