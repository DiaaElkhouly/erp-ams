import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "IMS | Integrated Manufacturing System",
  description: "Enterprise manufacturing, inventory, sales and purchasing management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${inter.variable} ${jbmono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
