import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

import { ClerkProvider } from "@clerk/nextjs";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800", "900"],
  preload: true,
});

export const metadata: Metadata = {
  title: "NFVCB Admin",
  description: "NFVCB content management dashboard",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang='en'
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning>
      <body className='min-h-full flex flex-col font-[family-name:var(--font-nunito)]'>
        <ClerkProvider>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange={false}>
            <main className='flex-1'>{children}</main>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
