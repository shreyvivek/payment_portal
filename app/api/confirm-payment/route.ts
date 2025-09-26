import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function b64ToBuffer(dataUrl: string) {
  const m = dataUrl?.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const mimeType = m[1];
  const b64 = m[2];
  return { buffer: Buffer.from(b64, "base64"), mimeType };
}

export const runtime = "nodejs"; // ensure Node (Buffer + googleapis)

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

    // Decode image
    const { buffer, mimeType } = b64ToBuffer(paymentProofDataUrl);
    const ext =
      mimeType === "image/png" ? "png" :
      mimeType === "image/jpeg" ? "jpg" :
      "png"; // default

    // Auth: Google Drive (service account)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GDRIVE_CLIENT_EMAIL,
        private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });

    // Filename
    const safeName = String(name || "anon").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 40);
    const last4 = String(phone || "").replace(/\D/g, "").slice(-4) || "0000";
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const filename = `${safeName}-${last4}-${y}${m}${d}-${hh}${mm}.${ext}`;

    // Upload to Drive
    const folderId = process.env.GDRIVE_FOLDER_ID;
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

    // Build final reference (AA1234-YYYYMMDD) for logging/deduping
    const initials =
      String(name || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NT";
    const finalRef = `${initials}${last4}-${y}${m}${d}`;

    // Append ONE row to your Google Sheet via Apps Script (optional but recommended)
    try {
      if (process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN) {
        const url = new URL(process.env.APPS_SCRIPT_URL);
        url.searchParams.set("token", process.env.APPS_SCRIPT_TOKEN);

        await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "appendPaid",
            dedupeKey: finalRef, // have Apps Script ignore if exists
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
    } catch (e) {
      // Non-fatal: Drive upload succeeded; sheet write can fail without blocking user
      console.error("Apps Script append failed:", e);
    }

    return NextResponse.json({
      ok: true,
      fileId: upload.data.id,
      fileName: upload.data.name,
      finalRef,
    });
  } catch (err: any) {
    console.error("confirm-payment error:", err?.message || err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}

