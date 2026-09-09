import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Montserrat.woff2 is the Google Fonts "latin" variable file (weights 400–800),
 * self-hosted so builds never depend on reaching fonts.googleapis.com.
 */
const montserrat = localFont({
  src: "./fonts/Montserrat.woff2",
  variable: "--font-montserrat",
  display: "swap",
  weight: "400 800",
});

export const metadata: Metadata = {
  title: {
    default: "ISP Service Provision",
    template: "%s · ISP Service Provision",
  },
  description: "Bandwidth provisioning and customer management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
