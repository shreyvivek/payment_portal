// app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      name,
      phone,
      telegram,
      matric,
      university,
      isNTU,
      price,
      paymentRef,
      event,
      remarks,
    } = body || {};

    // Basic validation so we don’t spam the sheet with junk
    if (
      !name || !phone || !telegram || !matric || !university ||
      typeof isNTU !== "boolean" || typeof price !== "number"
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid fields in registration payload." },
        { status: 400 }
      );
    }

    // Optional: append a row to Google Sheets via your Apps Script (initial registration)
    const APP_URL = process.env.APPS_SCRIPT_URL;
    const APP_TOKEN = process.env.APPS_SCRIPT_TOKEN;

    if (!APP_URL || !APP_TOKEN) {
      // Not fatal; you may want to treat this as an error if Sheets is required
      console.warn("APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN not set. Skipping sheet append for registration.");
    } else {
      const url = new URL(APP_URL);
      url.searchParams.set("token", APP_TOKEN);

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appendRegistration",
          data: {
            name,
            phone,
            telegram,
            matric,
            university,
            isNTU,
            price,
            paymentRef,
            remarks,
            event,
            registeredAtISO: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Apps Script appendRegistration failed:", res.status, txt);
        // Not fatal to user flow, but let’s surface it
        return NextResponse.json(
          { ok: false, error: "Registration saved locally, but failed to append to Google Sheet." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("register route error:", msg);
    return NextResponse.json({ ok: false, error: "Register route failed." }, { status: 500 });
  }
}
