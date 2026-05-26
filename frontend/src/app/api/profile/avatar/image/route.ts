import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { getPortalUserAvatar } from "@/lib/portal-db";

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { avatar } = await getPortalUserAvatar(wallet);
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    const bytes = Buffer.from(avatar.dataBase64, "base64");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": avatar.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
