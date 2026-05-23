import { Skeleton } from "@/components/ui/skeleton";

export function SkillCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="premium-skill-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="px-4 py-3">
            <Skeleton className="h-[168px] w-full rounded-lg" />
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 pb-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-4 w-16" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}
