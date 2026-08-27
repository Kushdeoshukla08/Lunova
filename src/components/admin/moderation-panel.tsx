"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { applyModerationAction, resolveReportAction } from "@/lib/admin/actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/auth/form-message";

const ACTIONS = [
  ["WARN", "Warn — notify the member"],
  ["RESTRICT_DISCOVERY", "Restrict discovery"],
  ["RESTRICT_MESSAGING", "Restrict messaging"],
  ["SUSPEND", "Suspend (time-boxed)"],
  ["BAN", "Ban (admin only)"],
  ["CLEAR", "Clear — no action needed"],
  ["REINSTATE", "Reinstate — undo a hold"],
] as const;

export function ModerationPanel({
  targetUserId,
  reportId,
}: {
  targetUserId: string;
  reportId?: string;
}) {
  const router = useRouter();
  const [action, setAction] = React.useState("WARN");
  const [reason, setReason] = React.useState("");
  const [days, setDays] = React.useState("7");
  const [msg, setMsg] = React.useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = React.useTransition();

  const submit = () =>
    start(async () => {
      const res = await applyModerationAction({
        targetUserId,
        action: action as never,
        reason,
        durationDays: action === "SUSPEND" ? Number(days) : undefined,
        reportId,
      });
      setMsg(res.ok ? { ok: true } : { error: res.error });
      if (res.ok) router.refresh();
    });

  const resolve = (decision: "DISMISSED" | "REVIEWING") =>
    start(async () => {
      if (!reportId) return;
      const res = await resolveReportAction({ reportId, decision, note: reason || undefined });
      setMsg(res.ok ? { ok: true } : { error: res.error });
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardTitle>Take action</CardTitle>
      {msg?.error && <FormMessage error={msg.error} className="mt-3" />}
      {msg?.ok && <FormMessage notice="Done — recorded in the audit log." className="mt-3" />}

      <div className="mt-4 flex flex-col gap-4">
        <Field label="Action">
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>

        {action === "SUSPEND" && (
          <Field label="Duration (days)">
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-28"
            />
          </Field>
        )}

        <Field label="Reason (internal — recorded)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="What was decided and why"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} loading={pending} disabled={reason.trim().length < 3}>
            Apply
          </Button>
          {reportId && (
            <>
              <Button variant="ghost" onClick={() => resolve("REVIEWING")} disabled={pending}>
                Mark reviewing
              </Button>
              <Button variant="ghost" onClick={() => resolve("DISMISSED")} disabled={pending}>
                Dismiss report
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
