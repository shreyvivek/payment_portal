// app/api/register/route.ts
export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const url = new URL(process.env.APPS_SCRIPT_URL!); // your GAS /exec
    url.searchParams.set("token", process.env.APPS_SCRIPT_TOKEN!); // shared secret

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) return new Response("Upstream error", { status: 502 });
    return new Response("OK");
  } catch (e) {
    console.error("Proxy error:", e);
    return new Response("Bad Request", { status: 400 });
  }
}
