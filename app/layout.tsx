import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PushNotificationProvider from "./components/PushNotificationProvider";
import AppFooter from "./components/AppFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "닥터 도슨 (Dr. Docent)",
  description: "데이터로 완성하는 나만의 건강 차트",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "닥터 도슨",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2DD4BF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <PushNotificationProvider>
          <main className="flex-1">
            {children}
          </main>
          <AppFooter />
        </PushNotificationProvider>
      </body>
    </html>
  );
}
