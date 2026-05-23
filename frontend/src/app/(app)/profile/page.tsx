"use client";

import { UploadIcon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import { WalletAddressChip } from "@/components/WalletAddressChip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Profile = {
  walletAddress: string;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

function initialsFromProfile(profile: Profile | null): string {
  const name = profile?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length > 0) {
      return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
    }
  }
  return "U";
}

export default function ProfilePage() {
  const { walletAddress } = useCurrentWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeWallet = useMemo(
    () => profile?.walletAddress ?? walletAddress ?? null,
    [profile?.walletAddress, walletAddress],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not load profile");
      const incoming = (data as { profile: Profile }).profile;
      setProfile(incoming);
      setDisplayName(incoming.displayName ?? "");
      setEmail(incoming.email ?? "");
      setBio(incoming.bio ?? "");
    } catch (e) {
      toast.error("Could not load profile", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, bio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not save profile");
      }
      const next = (data as { profile: Profile }).profile;
      setProfile(next);
      setDisplayName(next.displayName ?? "");
      setEmail(next.email ?? "");
      setBio(next.bio ?? "");
      toast.success("Profile updated.");
    } catch (e) {
      toast.error("Could not save profile", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not upload avatar");
      }
      const avatarUrl = (data as { avatarUrl: string }).avatarUrl;
      setProfile((current) =>
        current
          ? {
              ...current,
              avatarUrl,
            }
          : current,
      );
      toast.success("Profile photo updated.");
    } catch (e) {
      toast.error("Could not upload avatar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details and photo.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your wallet-based identity.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-4">
            <Avatar className="size-24 shrink-0 text-2xl after:border-2">
              <AvatarImage src={profile?.avatarUrl ?? undefined} alt="Profile photo" />
              <AvatarFallback>{initialsFromProfile(profile)}</AvatarFallback>
            </Avatar>

            <WalletAddressChip address={activeWallet} />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              {uploading ? "Uploading..." : "Upload photo"}
            </Button>
          </div>

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadAvatar(file);
              }
              event.target.value = "";
            }}
          />

          <div className="grid gap-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              Member since:{" "}
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Unavailable"}
            </p>
            <p>
              Last login:{" "}
              {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "Unavailable"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>These details are stored in Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading profile...</div>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel>Display name</FieldLabel>
                <Input
                  placeholder="Enter your display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                />
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Bio</FieldLabel>
                <Textarea
                  rows={5}
                  placeholder="Tell others what you work on."
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={320}
                />
              </Field>
            </FieldGroup>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={() => void saveProfile()} disabled={loading || saving}>
              <UserIcon data-icon="inline-start" />
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
