/**
 * Wraps a Table in a scrollable container on mobile.
 * Use this instead of bare <Table> in admin pages.
 */
export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="min-w-[640px] sm:min-w-0">
        {children}
      </div>
    </div>
  );
}
