export default function V2UIPrototypeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed top-4 left-4 z-50 bg-background px-4 py-3 focus:not-sr-only focus:outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        К содержанию
      </a>
      <main
        id="main-content"
        className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        {children}
      </main>
    </>
  );
}
