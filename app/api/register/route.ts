export async function POST(req: Request) {
  try {
    // You can still read the payload if you want to log/validate locally:
    // const payload = await req.json();
    // (No sheet writes here — only confirm-payment will append after success.)

    return new Response("OK");
  } catch (e) {
    console.error("Proxy error:", e);
    return new Response("Bad Request", { status: 400 });
  }
}
