import { Geist, Geist_Mono, Newsreader } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["italic"],
  weight: "400",
});

export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`;
