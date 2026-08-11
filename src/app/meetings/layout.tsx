import { ThemeProvider } from "@/components/providers/theme-provider";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

export default function MeetingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
