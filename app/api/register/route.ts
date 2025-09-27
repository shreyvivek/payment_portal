import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name, phone, telegram, matric, university,
      isNTU, price, remarks, event,
      paynowReferenceTyped, finalRef, registeredAtISO,
    } = body || {};

    // Require the PayNow reference here (so it only saves after payment)
    if (
      !name || !phone || !telegram || !matric || !university ||
      typeof isNTU !== "boolean" || typeof price !== "number" ||
      !paynowReferenceTyped || !finalRef
    ) {
      return NextResponse.json({ ok: false, error: "Missing/invalid fields." }, { status: 400 });
    }

    const APP_URL = process.env.APPS_SCRIPT_URL;
    const APP_TOKEN = process.env.APPS_SCRIPT_TOKEN;

    if (APP_URL && APP_TOKEN) {
      const url = new URL(APP_URL);
      url.searchParams.set("token", APP_TOKEN);

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appendRegistration",
          data: {
            registeredAtISO: registeredAtISO || new Date().toISOString(),
            name, phone, telegram, matric, university,
            isNTU, price,
            // store the PayNow ref + our finalRef
            paynowReferenceTyped, finalRef,
            remarks, event,
          },
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("appendRegistration failed:", res.status, txt);
        return NextResponse.json({ ok: false, error: "Failed to append to Google Sheet." }, { status: 502 });
      }
    } else {
      console.warn("APPS_SCRIPT_URL/APPS_SCRIPT_TOKEN missing; skipping sheet append.");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("register route error:", msg);
    return NextResponse.json({ ok: false, error: "Register route failed." }, { status: 500 });
  }
}
