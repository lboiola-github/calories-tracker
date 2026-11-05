import { BottomNav } from "@/components/nav/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pt-safe pb-nav">{children}</main>
      <BottomNav />
    </>
  );
}
