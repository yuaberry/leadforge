import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

import { ReplyForm } from "@/components/inbox/reply-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import {
  listConversationMessages,
  listConversations,
  markConversationRead,
} from "@/server/db/repositories/inbox";
import { withTenantDb } from "@/server/db/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Inbox",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const selectedId = typeof sp.c === "string" ? sp.c : null;

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const conversations = await listConversations(db, ctx.organization.id);
    const entry = selectedId
      ? conversations.find((c) => c.conversation.id === selectedId) ?? null
      : null;
    let messages: Awaited<ReturnType<typeof listConversationMessages>> = [];
    if (entry && entry.conversation.unreadCount > 0) {
      await markConversationRead(db, ctx.organization.id, entry.conversation.id);
    }
    if (entry) {
      messages = await listConversationMessages(
        db,
        ctx.organization.id,
        entry.conversation.id
      );
    }
    return { conversations, selected: entry, messages };
  });

  const { conversations, selected, messages } = data;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp e e-mail num só lugar — tudo registrado no CRM.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista */}
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {conversations.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda. Elas nascem de respostas de WhatsApp e envios de
                campanhas.
              </p>
            )}
            {conversations.map(({ conversation, contactName, contactEmail, contactPhone, companyName }) => (
              <Link
                key={conversation.id}
                href={`/inbox?c=${conversation.id}`}
                className={cn(
                  "flex items-start gap-3 p-3 transition-colors hover:bg-secondary/40",
                  selectedId === conversation.id && "bg-secondary/60"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 rounded-md p-1.5",
                    conversation.channel === "whatsapp"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-blue-500/15 text-blue-400"
                  )}
                >
                  {conversation.channel === "whatsapp" ? (
                    <MessageCircle className="size-4" aria-hidden="true" />
                  ) : (
                    <Mail className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {contactName ?? contactEmail ?? contactPhone ?? "Contato"}
                    </span>
                    {conversation.unreadCount > 0 && (
                      <Badge variant="default">{conversation.unreadCount}</Badge>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {conversation.lastMessagePreview ?? "—"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground/60">
                    {companyName ?? "—"} ·{" "}
                    {new Date(conversation.lastMessageAt).toLocaleString("pt-BR")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Conversa */}
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          {!selected ? (
            <p className="m-auto text-sm text-muted-foreground">
              Selecione uma conversa à esquerda.
            </p>
          ) : (
            <>
              <div className="border-b border-border p-4">
                <p className="text-sm font-semibold">
                  {selected.contactName ?? selected.contactEmail ?? "Contato"}
                  {selected.companyName ? ` · ${selected.companyName}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.conversation.channel === "whatsapp"
                    ? `WhatsApp ${selected.contactPhone ?? ""}`
                    : selected.contactEmail ?? ""}
                  {" · "}
                  <Link
                    href={`/leads/${selected.conversation.leadId}`}
                    className="text-primary hover:underline"
                  >
                    abrir lead
                  </Link>
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                      message.direction === "inbound"
                        ? "bg-secondary text-secondary-foreground"
                        : "ml-auto bg-primary/15 text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className="mt-1 text-right text-[10px] text-muted-foreground/60">
                      {new Date(message.createdAt).toLocaleString("pt-BR")} · {message.status}
                    </p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Sem mensagens registradas.
                  </p>
                )}
              </div>

              <div className="border-t border-border p-4">
                <ReplyForm conversationId={selected.conversation.id} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
