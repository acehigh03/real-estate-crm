import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Real Estate SMS CRM",
  description: "Manage seller leads, SMS outreach, and follow-up activity."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
