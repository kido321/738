import { UserButton } from "@clerk/nextjs";
import { requireStaff } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <div className="leading-tight">
              <div className="font-bold">{APP_NAME}</div>
              <div className="text-xs text-muted">
                {staff.name}
                {staff.role === "admin" ? " · Admin" : ""}
              </div>
            </div>
          </div>
          <UserButton />
        </div>
      </header>
      <main className="pb-nav px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
