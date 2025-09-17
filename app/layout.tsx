// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Browser tab title
  title: "NTU Dandiya Night 2025 – Registration",
  description:
    "Register for NTU Dandiya Night on 11 Oct 2025 (6–10pm) at Nanyang Auditorium, Level 3, NTU Singapore.",

  applicationName: "NTU Dandiya Registration",
  themeColor: "#7e2b16",

  // Favicon / home-screen icons (using your current logo for now)
  icons: {
    icon: "/ntu-logo.jpeg",           // tab icon (you can later swap to /favicon.ico)
    apple: "/ntu-logo.jpeg",          // iOS “Add to Home Screen”
  },

  // Link preview when sharing (WhatsApp/Slack/etc.)
  openGraph: {
    title: "NTU Dandiya Night 2025 – Registration",
    description:
      "Join us for garba & dandiya! 11 Oct 2025, 6–10pm, Nanyang Auditorium, NTU Singapore.",
    type: "website",
    siteName: "NTU Dandiya",
    images: ["/ntu-logo.jpeg"],       // you can replace with /og.png (1200×630) later
  },
  twitter: {
    card: "summary_large_image",
    title: "NTU Dandiya Night 2025 – Registration",
    description:
      "Register now for Dandiya Night at NTU Singapore (11 Oct, 6–10pm).",
    images: ["/ntu-logo.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

