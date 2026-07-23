import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shivtei Yisroel — Loans CRM",
  description: "Gemach Shivtei Yisroel membership & loans CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
