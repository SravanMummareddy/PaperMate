import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PaperMate",
  description: "Mini ERP/CRM for paper plates (free tier).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* use a loud color so it's obvious */}
      <body className="min-h-screen bg-red-200 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
