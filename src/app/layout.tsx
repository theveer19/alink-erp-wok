import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A Link Tours — Booking ERP",
  description: "Run every booking from enquiry to invoice, in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
