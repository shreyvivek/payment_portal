// app/api/confirm-payment/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function b64ToBuffer(dataUrl: string) {
  const m = dataUrl?.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const mimeType = m[1];
  const b64 = m[2];
  return { buffer: Buffer.from(b64, "base64"), mimeType };
}

export async function POST(req: NextRequest) {
  try {
    const {
      name, phone, university, isNTU, price,
      paynowReferenceTyped, paymentProofDataUrl, event,
    } = await req.json();

    if (!paymentProofDataUrl || !paynowReferenceTyped) {
      return NextResponse.json({ ok:false, error:"Missing payment proof or typed reference." }, { status:400 });
    }

    const { buffer, mimeType } = b64ToBuffer(paymentProofDataUrl);

    // Build finalRef AA1234-YYYYMMDD (server-side)
    const initials = String(name || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NT";
    const last4 = String(phone || "").replace(/\D/g, "").slice(-4) || "0000";
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const finalRef = `${initials}${last4}-${y}${m}${d}`;

    // Prepare multipart form for Apps Script
    const form = new FormData();
    form.set("action", "uploadPaid");
    form.set("name", String(name || ""));
    form.set("phone", String(phone || ""));
    form.set("university", String(university || ""));
    form.set("isNTU", String(isNTU));
    form.set("price", String(price || 0));
    form.set("paynowReferenceTyped", String(paynowReferenceTyped || ""));
    form.set("paidAtISO", now.toISOString());
    form.set("finalRef", finalRef);

    // Flatten event
    if (event) {
      form.set("eventName", String(event.name || ""));
      form.set("eventDate", String(event.dateStr || ""));
      form.set("eventTime", String(event.timeStr || ""));
      form.set("eventVenue", String(event.venue || ""));
      form.set("eventCity", String(event.city || ""));
    }

    // Attach the proof image (field name must be "proof")
    const filename = `${finalRef}.${mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "png"}`;
    const blob = new Blob([buffer], { type: mimeType });
    form.set("proof", blob, filename);

    // Send to Apps Script with token in querystring (kept server-side)
    const APP_URL = process.env.APPS_SCRIPT_URL || "";
    const APP_TOKEN = process.env.APPS_SCRIPT_TOKEN || "";
    if (!APP_URL || !APP_TOKEN) {
      return NextResponse.json({ ok:false, error:"Apps Script URL/token not set on server." }, { status:500 });
    }
    const url = new URL(APP_URL);
    url.searchParams.set("token", APP_TOKEN);

    const res = await fetch(url.toString() + "&action=uploadPaid", {
      method: "POST",
      body: form,
      // Note: do not set Content-Type; fetch will set proper multipart boundary
    });

    const txt = await res.text();
    let js: unknown;
    try { js = JSON.parse(txt); } catch { js = { ok:false, error:"Apps Script non-JSON", raw: txt }; }

    if (!res.ok || !(js as { ok?: boolean }).ok) {
      return NextResponse.json({ ok:false, error:(js as any).error || `Apps Script failed (${res.status})`, raw: js }, { status:502 });
    }

    return NextResponse.json(js);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok:false, error: msg }, { status:500 });
  }
}


