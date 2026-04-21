import type { Metadata } from "next";
import AuthProvider from "@/providers/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "EIALM | Asset Management",
  description: "Enterprise Infrastructure Asset Lifecycle Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1218] text-slate-200 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
