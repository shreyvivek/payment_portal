// app/api/confirm-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

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
      name,
      phone,
      university,
      isNTU,
      price,
      paynowReferenceTyped,
      paymentProofDataUrl,
      event,
    } = await req.json();

    if (!paymentProofDataUrl || !paynowReferenceTyped) {
      return NextResponse.json({ ok: false, error: "Missing payment proof or typed reference." }, { status: 400 });
    }

    // ---- Validate env early and clearly ----
    const SA_EMAIL = process.env.GDRIVE_CLIENT_EMAIL;
    const SA_KEY_RAW = process.env.GDRIVE_PRIVATE_KEY || "";
    const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || ""; // optional but recommended

    if (!SA_EMAIL || !SA_KEY_RAW) {
      return NextResponse.json(
        { ok: false, error: "Drive credentials missing (GDRIVE_CLIENT_EMAIL / GDRIVE_PRIVATE_KEY)." },
        { status: 500 }
      );
    }

    // IMPORTANT: private key must contain real newlines
    const SA_KEY = SA_KEY_RAW.replace(/\\n/g, "\n");

    // ---- Decode image (note: base64 inflates size by ~33%) ----
    const { buffer, mimeType } = b64ToBuffer(paymentProofDataUrl);
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "png";

    // ---- Init Google Drive client ----
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: SA_EMAIL,
        private_key: SA_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    // ---- Compute filename ----
    const safeName = String(name || "anon").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40);
    const last4 = String(phone || "").replace(/\D/g, "").slice(-4) || "0000";
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const filename = `${safeName}-${last4}-${y}${m}${d}-${hh}${mm}.${ext}`;

    // ---- Upload to Drive (use a stream; some environments dislike raw Buffers) ----
    // Make the buffer a Readable stream:
    const bodyStream = Readable.from(buffer);

    const upload = await drive.files.create({
      requestBody: {
        name: filename,
        parents: FOLDER_ID ? [FOLDER_ID] : undefined,
        mimeType,
        description: `Dandiya ${event?.name || ""} | ${university} | isNTU=${isNTU} | price=${price} | typedRef=${paynowReferenceTyped}`,
      },
      media: { mimeType, body: bodyStream },
      fields: "id,name,parents",
    });

    // ---- Build final reference (AA1234-YYYYMMDD) ----
    const initials = String(name || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NT";
    const finalRef = `${initials}${last4}-${y}${m}${d}`;

    // ---- Append a PAID row in Google Sheets via Apps Script (optional but recommended) ----
    try {
      const APP_URL = process.env.APPS_SCRIPT_URL;
      const APP_TOKEN = process.env.APPS_SCRIPT_TOKEN;

      if (APP_URL && APP_TOKEN) {
        const url = new URL(APP_URL);
        url.searchParams.set("token", APP_TOKEN);

        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "appendPaid",
            dedupeKey: finalRef,
            data: {
              name,
              phone,
              university,
              isNTU,
              price,
              paynowReferenceTyped,
              finalRef,
              driveFileId: upload.data.id,
              event,
              paidAtISO: now.toISOString(),
            },
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("Apps Script appendPaid failed:", res.status, txt);
          // Not fatal—file is already in Drive—but we surface the warning:
          return NextResponse.json({
            ok: true,
            fileId: upload.data.id,
            fileName: upload.data.name,
            finalRef,
            sheetWarning: "Uploaded to Drive, but failed to append to Google Sheet.",
          });
        }
      } else {
        console.warn("APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN not set. Skipping sheet append for payment.");
      }
    } catch (e) {
      console.error("Apps Script appendPaid error:", e);
      // Proceed anyway; Drive upload succeeded
    }

    return NextResponse.json({
      ok: true,
      fileId: upload.data.id,
      fileName: upload.data.name,
      finalRef,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("confirm-payment error:", msg);
    return NextResponse.json({ ok: false, error: msg || "Upload failed." }, { status: 500 });
  }
}


