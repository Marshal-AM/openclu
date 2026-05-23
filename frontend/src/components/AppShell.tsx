"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3Icon, ChevronDownIcon, LogOutIcon, MonitorIcon, PenToolIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import { OpenCluLogo } from "@/components/OpenCluLogo";
import { WalletAddressChip } from "@/components/WalletAddressChip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { href: "/contributions", label: "My Contributions", icon: BarChart3Icon },
  { href: "/devices", label: "My Devices", icon: MonitorIcon },
];

type HeaderProfile = {
  displayName: string | null;
  avatarUrl: string | null;
};

function avatarFallbackLabel(displayName: string | null, wallet: string | null | undefined): string {
  const trimmed = displayName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
    if (letters) return letters;
  }
  const address = wallet?.trim();
  if (address && address.startsWith("0x") && address.length >= 6) {
    return address.slice(2, 4).toUpperCase();
  }
  return "U";
}

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
  const [profile, setProfile] = useState<HeaderProfile>({ displayName: null, avatarUrl: null });

  const activeWallet = walletAddress ?? wallet;

  const profileLabel = useMemo(() => {
    if (profile.displayName?.trim()) return profile.displayName.trim();
    return shortAddress(activeWallet);
  }, [activeWallet, profile.displayName]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileSummary() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const payload = (data as { profile?: { displayName?: string | null; avatarUrl?: string | null } })
          .profile;
        if (!mounted || !payload) return;
        setProfile({
          displayName: payload.displayName ?? null,
          avatarUrl: payload.avatarUrl ?? null,
        });
      } catch {
        if (mounted) {
          setProfile({ displayName: null, avatarUrl: null });
        }
      }
    }

    void loadProfileSummary();
    return () => {
      mounted = false;
    };
  }, [walletAddress]);

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
            <p className="text-sm font-medium">Clu Dashboard</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <WalletAddressChip address={activeWallet} className="hidden sm:inline-flex" />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="ghost" className="h-auto gap-2 rounded-full px-1.5 py-1" />
                }
              >
                <Avatar size="sm">
                  <AvatarImage src={profile.avatarUrl ?? undefined} alt="Profile" />
                  <AvatarFallback>{avatarFallbackLabel(profile.displayName, activeWallet)}</AvatarFallback>
                </Avatar>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">{profileLabel}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{activeWallet ?? "Wallet"}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <UserIcon />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
