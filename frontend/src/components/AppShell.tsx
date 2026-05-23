"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOutIcon, MonitorIcon, PenToolIcon } from "lucide-react";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import { Button } from "@/components/ui/button";
import { OpenCluLogo } from "@/components/OpenCluLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { shortAddress } from "@/lib/privy-user";

const NAV = [
  { href: "/contribute", label: "Contribute Agent Skills", icon: PenToolIcon },
  { href: "/devices", label: "My Devices", icon: MonitorIcon },
];

export function AppShell({
  children,
  wallet,
}: {
  children: React.ReactNode;
  wallet?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { walletAddress, signOut } = useCurrentWallet();

  async function logout() {
    await signOut();
    router.push("/login");
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-1">
          <Link
            href="/contribute"
            aria-label="Skill Capture"
            className="flex h-24 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg group-data-[collapsible=icon]:size-14"
          >
            <OpenCluLogo
              priority
              className="h-20 w-full object-contain group-data-[collapsible=icon]:hidden"
            />
            <span className="hidden size-14 shrink-0 overflow-hidden rounded-lg group-data-[collapsible=icon]:grid group-data-[collapsible=icon]:place-items-center">
              <OpenCluLogo markOnly className="size-12 object-contain" />
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-2 px-2 group-data-[collapsible=icon]:px-0">
          <SidebarGroup className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger />
            <OpenCluLogo className="h-6 w-auto md:hidden" />
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="text-sm font-medium">Agent Skills Dashboard</p>
            <p className="truncate text-xs text-muted-foreground">Capture, publish, and manage your local skill contributions.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-full border bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground sm:block">
              {shortAddress(walletAddress ?? wallet)}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOutIcon />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
