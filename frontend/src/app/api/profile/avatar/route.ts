import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { getSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "profile-avatars";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export async function POST(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, WEBP, or GIF images are allowed" }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Avatar must be between 1 byte and 5 MB" }, { status: 400 });
    }

    const extension = extensionForMimeType(file.type);
    const path = `${wallet}/${Date.now()}.${extension}`;

    const sb = getSupabaseAdmin();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = sb.storage.from(BUCKET).getPublicUrl(path);

    const { error: updateError } = await sb
      .from("users")
      .upsert(
        {
          wallet_address: wallet,
          avatar_url: publicUrl,
        },
        { onConflict: "wallet_address" },
      );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatarUrl: publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
