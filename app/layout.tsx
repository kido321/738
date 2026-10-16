import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Track party sales, inventory and staff.",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0b10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#f2b544",
          colorPrimaryForeground: "#1a1306",
          colorBackground: "#15151d",
          colorForeground: "#f2f0ea",
          colorMutedForeground: "#9a98a6",
          colorInput: "#1e1e29",
          colorInputForeground: "#f2f0ea",
          colorNeutral: "#f2f0ea",
          colorBorder: "#2a2a38",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html lang="en">
        <body className="min-h-dvh antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
