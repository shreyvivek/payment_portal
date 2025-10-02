import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uploadProofToDrive(appUrl: string, token: string, base64: string, filename: string) {
  const url = new URL(appUrl);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveProof",
      data: { base64, filename }
    }),
  });

  const j = await res.json().catch(() => ({}));
  return j.url || "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name, phone, telegram, matric, university,
      isNTU, price, remarks, event,
      finalRef, registeredAtISO,
      proofBase64,
    } = body || {};

    if (
      !name || !phone || !telegram || !matric || !university ||
      typeof isNTU !== "boolean" || typeof price !== "number" ||
      !finalRef || !proofBase64
    ) {
      return NextResponse.json({ ok: false, error: "Missing/invalid fields." }, { status: 400 });
    }

    const APP_URL = process.env.APPS_SCRIPT_URL;
    const APP_TOKEN = process.env.APPS_SCRIPT_TOKEN;
    if (!APP_URL || !APP_TOKEN) {
      return NextResponse.json({ ok: false, error: "Apps Script URL/token not set." }, { status: 500 });
    }

    // filename = NAME(without spaces) + PHONE
    const safeName = (name || "").replace(/\s+/g, "").toUpperCase();
    const refFileName = `${safeName}${phone}`;

    const proofUrl = await uploadProofToDrive(APP_URL, APP_TOKEN, proofBase64, refFileName);

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
          finalRef,
          remarks,
          event,
          proofUrl,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("appendRegistration failed:", res.status, txt);
      return NextResponse.json({ ok: false, error: "Failed to append to Google Sheet." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("register route error:", msg);
    return NextResponse.json({ ok: false, error: "Register route failed." }, { status: 500 });
  }
}
