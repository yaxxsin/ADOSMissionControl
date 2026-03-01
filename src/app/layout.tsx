import type { Metadata } from "next";
import "./globals.css";
import { CommandShell } from "@/components/layout/CommandShell";
import { ToastProvider } from "@/components/ui/toast";
import ConvexClientProvider from "./ConvexClientProvider";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

export const metadata: Metadata = {
  title: "ADOS Mission Control",
  description: "Open-source Ground Control Station by Altnautica",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <ToastProvider>
      <CommandShell>{children}</CommandShell>
    </ToastProvider>
  );

  const body = (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden bg-bg-primary text-text-primary font-body">
        <ConvexClientProvider>
          {content}
        </ConvexClientProvider>
      </body>
    </html>
  );

  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <ConvexAuthNextjsServerProvider>
        {body}
      </ConvexAuthNextjsServerProvider>
    );
  }

  return body;
}
