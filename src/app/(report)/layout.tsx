import "@/app/globals.css";

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <header className="w-full max-w-lg mx-auto px-4 pt-6 pb-2 text-center">
        <p className="text-xl font-bold tracking-tight">BWL</p>
        <p className="text-xs text-muted-foreground">Match Hub</p>
      </header>
      <main className="w-full max-w-lg mx-auto px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
