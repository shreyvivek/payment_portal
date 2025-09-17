"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Check, CreditCard, Calendar, MapPin, Phone, AtSign, University } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * NTU Dandiya Registration – Updated per spec
 * ------------------------------------------------------------
 * Changes:
 * - Removed sparkles icon block
 * - Header top-right replaced with dandiya sticks image
 * - “Tell us about you ✨” → “Personal details”
 * - Remarks label → “Any comments/queries”
 * - Telegram note: “Include @…”
 * - Hidden non-NTU signup counter display (logic retained)
 * - Show $0.00 until a university is selected
 * - Wording: Non-NTU “Early Bird” → “General”
 * - Payment page: removed “QR shown for…”, Back button is yellow
 * - Simplified CONFIG.images (ntuLogo, dandiyaSticks, paynow images)
 */

// ===== CONFIG =====
const CONFIG = {
  pricing: {
    NTU: 6,
    OTHER_BASE: 10,
    OTHER_SURGE: 12,
    NON_NTU_THRESHOLD: 50,
  },
  images: {
    ntuLogo: "/ntu-logo.jpeg",
    dandiyaSticks: "/dandiya_sticks.jpeg",
    paynowNTU: "/paynow-ntu-6.jpeg",
    paynowOther: "/paynow-other-10.jpeg",
    paynowOtherSurge: "/paynow-other-12.jpeg",
  },
  event: {
    name: "NTU Dandiya Night 2025",
    dateStr: "Saturday, 11 October 2025",
    timeStr: "6:00 PM – 10:00 PM",
    venue: "Nanyang Auditorium, Level 3",
    city: "NTU Singapore",
  },
};

// ===== Simple local counters (replace with DB if needed) =====
const getNonNTUSignupCount = () => {
  try {
    return parseInt(localStorage.getItem("ntu_dandiya_nonntu_signup_count") || "0", 10);
  } catch {
    return 0;
  }
};
const bumpNonNTUSignupCount = (isNTU: boolean) => {
  try {
    if (!isNTU) {
      const next = getNonNTUSignupCount() + 1;
      localStorage.setItem("ntu_dandiya_nonntu_signup_count", String(next));
    }
  } catch {}
};

// ===== Pricing helpers =====
function computePrice(isNTU: boolean, nonNtuCount: number) {
  if (isNTU) return CONFIG.pricing.NTU;
  return nonNtuCount >= CONFIG.pricing.NON_NTU_THRESHOLD
    ? CONFIG.pricing.OTHER_SURGE
    : CONFIG.pricing.OTHER_BASE;
}
function pickQR(isNTU: boolean, price: number) {
  if (isNTU) return CONFIG.images.paynowNTU;
  return price === CONFIG.pricing.OTHER_SURGE
    ? CONFIG.images.paynowOtherSurge
    : CONFIG.images.paynowOther;
}

// University list
const universities = [
  "NTU",
  "NUS",
  "SMU",
  "SIT",
  "SUTD",
  "SIM",
  "SUSS",
  "ESSEC",
  "Lasalle",
  "SP Jain",
  "Others",
];

export default function DandiyaRegistrationApp() {
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [nonNtuCount, setNonNtuCount] = useState<number>(0);
  useEffect(() => setNonNtuCount(getNonNTUSignupCount()), []);

  const [form, setForm] = useState({
    name: "",
    telegram: "",
    phone: "",
    matric: "",
    university: "",
    remarks: "",
    agree: false,
  });

  const isNTU = useMemo(() => form.university.trim().toUpperCase() === "NTU", [form.university]);
  const price = useMemo(() => computePrice(isNTU, nonNtuCount), [isNTU, nonNtuCount]);
  const qrSrc = useMemo(() => pickQR(isNTU, price), [isNTU, price]);

  const valid = useMemo(() => {
    const phoneOk = /^\+?\d{8,15}$/.test(form.phone.trim());
    return (
      form.name.trim().length > 1 &&
      form.telegram.trim().length >= 3 &&
      phoneOk &&
      form.matric.trim().length >= 3 &&
      form.university.trim().length > 0 &&
      form.agree
    );
  }, [form]);

  const paymentRef = useMemo(() => {
    const initials = form.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NT";
    const last4 = form.phone.replace(/\D/g, "").slice(-4) || "0000";
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${initials}${last4}-${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  }, [form.name, form.phone]);

  const showPrice = form.university.trim().length > 0 ? price : 0; // $0.00 until uni selected
  const nonNtuTierLabel =
    !form.university
      ? ""
      : isNTU
        ? "NTU student tier"
        : nonNtuCount >= CONFIG.pricing.NON_NTU_THRESHOLD
          ? "Non-NTU General"
          : "Non-NTU Early Bird";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;

    // Save a local copy (optional, for your own backup)
    try {
      const key = "ntu_dandiya_registrations";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({ ...form, isNTU, price, paymentRef, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}

    // Send to your secure server route
    try {
      await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isNTU, price, paymentRef, event: CONFIG.event }),
      });
    } catch (err) {
      console.error("Proxy error", err);
    }

    setStep("pay");
  }

  function handlePaidAndConfirm() {
    bumpNonNTUSignupCount(isNTU);
    setNonNtuCount(getNonNTUSignupCount());
    setStep("done");
  }

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden text-amber-50">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-[#3a120c] via-[#5a2817] to-[#8a4720]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_-10%_-10%,rgba(255,214,150,0.08),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_35rem_at_110%_120%,rgba(255,180,130,0.08),transparent_60%)]" />

      {/* Hero header card */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 px-4 sm:px-6 py-4 sm:py-6 shadow-xl">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={CONFIG.images.ntuLogo}
                alt="NTU"
                className="h-10 sm:h-12 w-auto rounded-md bg-white/80 p-1 shadow"
              />
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-yellow-100 drop-shadow-md">
                  {CONFIG.event.name}
                </h1>
                <p className="text-xs sm:text-sm text-amber-200/90 flex flex-wrap items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" /> {CONFIG.event.dateStr}
                  <span className="opacity-60">•</span>
                  <span>{CONFIG.event.timeStr}</span>
                  <span className="opacity-60">•</span>
                  <MapPin className="h-4 w-4" /> {CONFIG.event.venue}, {CONFIG.event.city}
                </p>
              </div>
            </div>
            {/* Top-right: dandiya sticks image */}
            <div className="shrink-0">
              <img
                src={CONFIG.images.dandiyaSticks}
                alt="Dandiya sticks"
                className="h-14 sm:h-16 w-auto rounded-xl bg-white/80 p-1 shadow"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24">
        {/* Stepper */}
        <div className="grid grid-cols-3 gap-2 mb-5 sm:mb-8">
          {["Details", "Payment", "Done"].map((s, i) => {
            const active =
              (step === "form" && i === 0) ||
              (step === "pay" && i === 1) ||
              (step === "done" && i === 2);
            const done = (step === "pay" && i <= 0) || (step === "done" && i <= 1);
            return (
              <div
                key={s}
                className={`h-2 rounded-full ${
                  active ? "bg-yellow-400" : done ? "bg-emerald-400" : "bg-white/20"
                }`}
              />
            );
          })}
        </div>

        {step === "form" && (
          <Card className="bg-white/10 backdrop-blur-md text-amber-50 border border-white/15 shadow-2xl rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Personal details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-2 bg-white/10 border-white/20"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="telegram" className="flex items-center gap-2">
                    <AtSign className="h-4 w-4" /> Telegram ID
                  </Label>
                  <Input
                    id="telegram"
                    value={form.telegram}
                    onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                    className="mt-2 bg-white/10 border-white/20"
                    placeholder="@yourhandle"
                    required
                  />
                  <p className="text-xs text-amber-200/80 mt-1">Include <b>@</b> in your handle.</p>
                </div>
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-2 bg-white/10 border-white/20"
                    inputMode="tel"
                    pattern="\+?\d{8,15}"
                    placeholder="e.g., +65 91234567"
                    required
                  />
                  <p className="text-xs text-amber-200/80 mt-1">
                    Use digits only, with optional +country code.
                  </p>
                </div>
                <div>
                  <Label htmlFor="matric">Matriculation Number</Label>
                  <Input
                    id="matric"
                    value={form.matric}
                    onChange={(e) => setForm({ ...form, matric: e.target.value })}
                    className="mt-2 bg-white/10 border-white/20"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="university" className="flex items-center gap-2">
                    <University className="h-4 w-4" /> University
                  </Label>
                  <select
                    id="university"
                    value={form.university}
                    onChange={(e) => setForm({ ...form, university: e.target.value })}
                    className="mt-2 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2"
                  >
                    <option value="">Select…</option>
                    {universities.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="remarks">Any comments/queries</Label>
                  <Textarea
                    id="remarks"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    className="mt-2 bg-white/10 border-white/20"
                    rows={3}
                  />
                </div>
                <div className="sm:col-span-2 flex items-start gap-3 mt-1">
                  <input
                    id="agree"
                    type="checkbox"
                    className="mt-1"
                    checked={form.agree}
                    onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                  />
                  <Label htmlFor="agree" className="text-sm text-amber-200/90">
                    I agree that my details will be used for event registration and communication.
                  </Label>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between mt-2">
                  {/* Hidden non-NTU signup counter display (logic still works in background) */}
                  <div className="text-amber-200/90 text-xs sm:text-sm" />
                  <div className="text-right">
                    <div className="text-amber-200/90 text-xs">Your ticket</div>
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-yellow-300">
                      ${showPrice}.00
                    </div>
                    <div className="text-[11px] text-amber-200/80">{nonNtuTierLabel}</div>
                  </div>
                </div>

                <div className="sm:col-span-2 flex gap-3 justify-end">
                  <Button
                    type="submit"
                    disabled={!valid}
                    className="w-full sm:w-auto px-6 py-4 text-base rounded-2xl bg-yellow-400 text-red-900 hover:bg-yellow-300 transition"
                  >
                    Continue to Payment <CreditCard className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "pay" && (
          <Card className="bg-white/10 backdrop-blur-md text-amber-50 border border-white/15 shadow-2xl rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Scan & Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col items-center">
                  <img
                    src={qrSrc}
                    alt="PayNow QR"
                    className="w-60 h-60 sm:w-64 sm:h-64 rounded-2xl shadow-2xl border border-amber-100/20 object-contain bg-white"
                  />
                  {/* Removed the “QR shown for …” line */}
                </div>
                <div className="space-y-3">
                  <p className="text-amber-100/90">
                    Please scan the QR and pay <span className="font-bold">${price}.00</span>. Use the
                    reference below so we can match your payment quickly.
                  </p>
                  <div className="p-4 rounded-xl bg-[#3f1a12]/50 border border-amber-100/20">
                    <div className="text-xs text-amber-200/80">Copy this into PayNow “Remarks”</div>
                    <div className="flex items-center justify-between mt-1">
                      <code className="text-lg font-mono text-yellow-200">{paymentRef}</code>
                      <Button
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() => navigator.clipboard.writeText(paymentRef)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <ul className="list-disc list-inside text-sm text-amber-100/85 space-y-1">
                    <li>Open your banking app → PayNow QR → Scan.</li>
                    <li>Pay the exact amount <b>${price}.00</b>.</li>
                    <li>Paste the <b>Payment Reference</b> into the Remarks field.</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <Button
                  className="rounded-2xl px-6 py-4 bg-yellow-400 text-red-900 hover:bg-yellow-300"
                  onClick={() => setStep("form")}
                >
                  Back
                </Button>
                <Button
                  className="w-full sm:w-auto px-6 py-4 text-base rounded-2xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                  onClick={handlePaidAndConfirm}
                >
                  I’ve Paid – Finish <Check className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Card className="bg-white/10 backdrop-blur-md text-amber-50 border border-white/15 shadow-2xl rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">You’re in! 🎉</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold">What happens next</h3>
                  <p className="text-amber-100/90 mt-2 text-sm">
                    We’ve received your registration. You’ll get a confirmation message via Telegram/WhatsApp
                    within 48 hours after we verify your payment.
                  </p>
                  <div className="mt-4 p-4 rounded-xl bg-[#3f1a12]/50 border border-amber-100/20 text-sm">
                    <div className="text-amber-200/80">Your details</div>
                    <ul className="mt-2 space-y-1">
                      <li>
                        <b>Name:</b> {form.name}
                      </li>
                      <li>
                        <b>University:</b> {form.university}
                      </li>
                      <li>
                        <b>Telegram:</b> {form.telegram}
                      </li>
                      <li>
                        <b>Phone:</b> {form.phone}
                      </li>
                      <li>
                        <b>Matric:</b> {form.matric}
                      </li>
                      <li>
                        <b>Paid:</b> ${price}.00
                      </li>
                      <li>
                        <b>Ref:</b> {paymentRef}
                      </li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Event instructions</h3>
                  <ul className="text-sm text-amber-100/90 mt-2 space-y-2 list-disc list-inside">
                    <li>
                      📍 <b>{CONFIG.event.venue}</b>, {CONFIG.event.city}
                    </li>
                    <li>
                      🗓️ <b>{CONFIG.event.dateStr}</b>
                    </li>
                    <li>
                      🕕 <b>{CONFIG.event.timeStr}</b> (doors open 5:30 PM)
                    </li>
                    <li>Bring student ID and payment proof screenshot.</li>
                    <li>Dress code: colorful ethnic or smart casual (comfortable for dancing!)</li>
                    <li>No outside food/drinks in the auditorium.</li>
                  </ul>
                  <div className="mt-4 text-xs text-amber-200/80">
                    Need help? DM <span className="font-medium">@ntudandiya</span> on Telegram.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 text-amber-200/80 text-xs flex items-center justify-between">
        <div>© {new Date().getFullYear()} NTU Indian Society · All rights reserved</div>
        <div>Built with ❤️ for the dandiya season</div>
      </footer>
    </div>
  );
}
