import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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
      return NextResponse.json({ ok: false, error: "Missing proof/ref" }, { status: 400 });
    }

    const { buffer, mimeType } = b64ToBuffer(paymentProofDataUrl);

    // Auth with service account (kept in server-only env)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GDRIVE_CLIENT_EMAIL,
        private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });

    // Build a neat filename
    const safeName = String(name || "anon").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40);
    const last4 = String(phone || "").replace(/\D/g, "").slice(-4) || "0000";
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const filename = `${safeName}-${last4}-${y}${m}${d}-${hh}${mm}.png`;

    const folderId = process.env.GDRIVE_FOLDER_ID; // keep private
    const upload = await drive.files.create({
      requestBody: {
        name: filename,
        parents: folderId ? [folderId] : undefined,
        mimeType,
        description: `Dandiya ${event?.name || ""} | ${university} | isNTU=${isNTU} | price=${price} | typedRef=${paynowReferenceTyped}`,
      },
      media: { mimeType, body: buffer },
      fields: "id,name,parents",
    });

    // ---- NEW: append ONE row to your sheet (only on success) with dedupe ----
    try {
      // Build the same final reference the client shows
      const initials =
        String(name || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NT";
      const finalLast4 = last4; // already computed
      const finalRef = `${initials}${finalLast4}-${y}${m}${d}`;

      // Post to your Apps Script Web App
      if (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN) {
        const url = new URL(process.env.APPS_SCRIPT_URL);
        // keep your existing token style (as query param)
        url.searchParams.set("token", process.env.APPS_SCRIPT_TOKEN);

        await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "appendPaid",
            dedupeKey: finalRef, // let GAS ignore if already present
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
      }
    } catch (ee) {
      console.error("sheet append failed (non-fatal):", ee);
      // do not fail the upload if sheet write fails
    }
    // ------------------------------------------------------------------------

    return NextResponse.json({ ok: true, fileId: upload.data.id, fileName: upload.data.name });
  } catch (err) {
    console.error("confirm-payment error:", err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}

// Force Node runtime (not Edge) so Buffer works reliably
export const runtime = "nodejs";
