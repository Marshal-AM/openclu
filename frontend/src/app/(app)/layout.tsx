import { AppShell } from "@/components/AppShell";
import { getSessionWallet } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const wallet = await getSessionWallet();

  return <AppShell wallet={wallet}>{children}</AppShell>;
}
