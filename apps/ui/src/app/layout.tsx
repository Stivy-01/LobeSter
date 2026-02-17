import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "LobeSter",
  description: "Manage OpenClaw skills and engrams",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
