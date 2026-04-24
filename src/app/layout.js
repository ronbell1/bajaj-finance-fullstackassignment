import "./globals.css";

export const metadata = {
  title: "BFHL Hierarchy Visualizer | SRM Full Stack Challenge",
  description:
    "Visualize hierarchical node relationships with cycle detection, tree construction, and depth analysis. Built for the Bajaj Finserv Health Full Stack Engineering Challenge.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
