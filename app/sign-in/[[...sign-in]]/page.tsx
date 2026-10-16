import { SignIn } from "@clerk/nextjs";
import { APP_NAME } from "@/lib/config";

export default function SignInPage() {
  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center justify-center gap-6 px-4 pb-10">
      <div className="text-center">
        <img src="/icon-192.png" alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl" />
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        <p className="text-sm text-muted">Sign in to start selling</p>
      </div>
      <SignIn />
    </main>
  );
}
