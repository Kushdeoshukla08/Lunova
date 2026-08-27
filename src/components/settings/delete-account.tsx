"use client";

import * as React from "react";
import { useActionState } from "react";
import { deleteAccountAction, type SettingsResult } from "@/lib/settings/actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccount() {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    deleteAccountAction,
    null,
  );

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account"
        description="This is permanent. Your profile, photos, matches and messages are removed, and your data is anonymised."
      >
        <form action={action} className="flex flex-col gap-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Your profile disappears from Discover and Connections immediately.</li>
            <li>Open conversations end for the people you were matched with.</li>
            <li>This can&apos;t be undone — you&apos;d need to start a new account.</li>
          </ul>
          <label className="text-sm text-ink">
            Type <span className="font-semibold">DELETE</span> to confirm
            <Input name="confirm" autoComplete="off" className="mt-1" />
          </label>
          {state && !state.ok && (
            <p className="text-sm text-danger" role="alert">{state.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Permanently delete
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
