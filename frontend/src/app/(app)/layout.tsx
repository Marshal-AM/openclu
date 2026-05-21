import { AppShell } from "@/components/AppShell";
import { fetchOrchestratorUrlFromDb, getSessionWallet } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const wallet = await getSessionWallet();
  let orchestratorUrl: string | null = null;
  if (wallet) {
    try {
      orchestratorUrl = await fetchOrchestratorUrlFromDb(wallet);
    } catch {
      orchestratorUrl = null;
    }
  }

  return <AppShell orchestratorUrl={orchestratorUrl}>{children}</AppShell>;
}
