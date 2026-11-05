import type { ReactNode } from "react";
import { BottomNav } from "@/components/nav/bottom-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pt-safe pb-nav">{children}</main>
      <BottomNav />
    </>
  );
}
