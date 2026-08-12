import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

// Inter вместо Geist: нужен шрифт с кириллицей — интерфейс русскоязычный.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RADEYA",
  description: "Магазин и система управления бизнесом",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
