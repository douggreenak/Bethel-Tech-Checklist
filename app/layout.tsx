import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-roboto-flex",
});

export const metadata: Metadata = {
  title: "Church Tech Checklist",
  description: "A shared weekly checklist for a church tech team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Church Tech",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={robotoFlex.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var th = JSON.parse(localStorage.getItem('church-tech-theme') || '{}');
                  var m = th.mode;
                  var r = document.documentElement;
                  if (m === 'light' || m === 'dark') {
                    r.setAttribute('data-theme', m);
                  }
                  var mm = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
                  var isDark = m === 'dark' || (m !== 'light' && mm && mm.matches);
                  var ACC = [
                    ["Blue", 216, 85], ["Sage", 105, 28], ["Teal", 170, 28],
                    ["Periwinkle", 235, 45], ["Terracotta", 20, 48],
                    ["Lavender", 262, 30], ["Mauve", 320, 28], ["Gray", 210, 8]
                  ];
                  var a = ACC[th.acc] || ACC[0];
                  var h = a[1], sa = a[2], t = Math.min(sa + 10, 70);
                  var v = isDark ? {
                    "--acc": "hsl(" + h + "," + (sa + 10) + "%, 78%)",
                    "--on": "hsl(" + h + "," + sa + "%, 16%)",
                    "--pc": "hsl(" + h + "," + sa + "%, 26%)",
                    "--opc": "hsl(" + h + "," + sa + "%, 90%)",
                    "--tr": "hsla(" + h + "," + sa + "%, 90%, .22)",
                    "--invp": "hsl(" + h + "," + sa + "%, 36%)"
                  } : {
                    "--acc": "hsl(" + h + "," + sa + "%, 38%)",
                    "--on": "#fff",
                    "--pc": "hsl(" + h + "," + t + "%, 82%)",
                    "--opc": "hsl(" + h + "," + t + "%, 14%)",
                    "--tr": "hsla(" + h + "," + sa + "%, 14%, .16)",
                    "--invp": "hsl(" + h + "," + sa + "%, 82%)"
                  };
                  for (var k in v) {
                    r.style.setProperty(k, v[k]);
                  }
                  r.style.setProperty('--ok', v['--acc']);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
