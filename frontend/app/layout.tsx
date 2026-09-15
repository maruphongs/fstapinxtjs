import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Navbar from "./components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FAST API + NextJS",
  description: "Product and Category Management System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className={`${inter.className} min-h-screen flex flex-col bg-white text-black`}>
        <Navbar />
        <div className="flex-1 flex flex-col w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
