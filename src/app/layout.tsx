export const metadata = {
    title: "My zk App",
    description: "Powered by Light Protocol + Next.js",
  };
  
  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "sans-serif" }}>{children}</body>
      </html>
    );
  }
  