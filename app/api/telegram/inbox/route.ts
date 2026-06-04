import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const TG_API = "https://api.telegram.org";

export type InboxItem = {
  /** Telegram update_id — used as the stable key for dismissal in localStorage. */
  id: number;
  text: string;
  /** Sender's display name + optional @username. */
  from: string;
  /** Unix epoch seconds from Telegram. */
  date: number;
  /** Marked true if the original message was forwarded from another chat
   * (useful so the UI can show "↗ forwarded" — your WhatsApp-via-Telegram
   * messages will all be forwards). */
  isForward: boolean;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    from?: { first_name?: string; last_name?: string; username?: string };
    forward_from?: unknown;
    forward_origin?: unknown;
    forward_from_chat?: unknown;
  };
};

/**
 * Returns the current pending Telegram messages for the configured bot.
 *
 * NB: we deliberately do NOT pass an offset. Telegram's getUpdates uses offsets
 * to mark messages as consumed; passing offset=N deletes everything before N.
 * We want refreshable, idempotent reads. The client filters dismissed messages
 * via localStorage. Telegram itself drops messages after ~24h or when its
 * 100-update server buffer overflows, whichever comes first.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_TOKEN not configured" },
      { status: 500 },
    );
  }

  const tgRes = await fetch(`${TG_API}/bot${token}/getUpdates?timeout=0`, {
    cache: "no-store",
  });
  if (!tgRes.ok) {
    return NextResponse.json(
      { error: `Telegram returned ${tgRes.status}` },
      { status: 502 },
    );
  }
  const payload = (await tgRes.json()) as {
    ok: boolean;
    result?: TelegramUpdate[];
  };
  if (!payload.ok || !payload.result) {
    return NextResponse.json({ items: [] });
  }

  const items: InboxItem[] = payload.result
    .map((u) => normalize(u))
    .filter((i): i is InboxItem => i !== null)
    // Newest first.
    .sort((a, b) => b.date - a.date);

  return NextResponse.json({ items });
}

function normalize(update: TelegramUpdate): InboxItem | null {
  const msg = update.message;
  if (!msg) return null;
  const text = msg.text ?? msg.caption;
  if (!text) return null;

  const from = msg.from
    ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") +
      (msg.from.username ? ` (@${msg.from.username})` : "")
    : "unknown";

  return {
    id: update.update_id,
    text,
    from: from.trim() || "unknown",
    date: msg.date,
    isForward: Boolean(
      msg.forward_from || msg.forward_origin || msg.forward_from_chat,
    ),
  };
}
