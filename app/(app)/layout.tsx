import { UserButton } from "@clerk/nextjs";
import { requireStaff } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { BottomNav } from "@/components/BottomNav";
import { getOpenTabCount } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [staff, openTabs] = await Promise.all([requireStaff(), getOpenTabCount().catch(() => 0)]);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <header className="pt-safe sticky top-0 z-20 border-b border-line/70 bg-bg/85 px-4 pb-2 backdrop-blur-xl">
        <div className="flex h-9 items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
            <div className="min-w-0 leading-none">
              <div className="truncate text-[15px] font-bold tracking-tight">{APP_NAME}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted">
                {staff.name}
                {staff.role === "admin" ? " · Admin" : ""}
              </div>
            </div>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="pb-nav px-4 pt-3">{children}</main>
      <BottomNav openTabs={openTabs} />
    </div>
  );
}
