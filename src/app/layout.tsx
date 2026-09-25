import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});


export const metadata: Metadata = {
  title: "RIVIX | Enterprise Compliance Portal",
  description: "Secure, 24/7 access to your industrial workwear batch certificates, quality inspection reports, and order tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --rivix-red: #c61213;
            --rivix-light: #f2f2f2;
            --background: #ffffff;
          }
          body {
            background-color: var(--background) !important;
            color: #0f172a !important; /* Slate 900 */
            font-family: var(--font-poppins), sans-serif !important;
            margin: 0;
            min-height: 100vh;
          }
          .text-rivix { color: var(--rivix-red) !important; }
          .bg-rivix { background-color: var(--rivix-red) !important; }
        `}} />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased text-slate-900">{children}</body>

    </html>



  );
}
