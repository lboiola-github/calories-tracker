import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { NavigationProgress } from "@/components/nav/navigation-progress";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <main className="mx-auto w-full max-w-md px-5 pt-safe pb-nav">{children}</main>
      <BottomNav />
    </>
  );
}
