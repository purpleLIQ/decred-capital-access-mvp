import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decred Capital Access MVP",
  description:
    "A demo-mode DCR-backed lending app that shows how Decred holders could borrow without selling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
