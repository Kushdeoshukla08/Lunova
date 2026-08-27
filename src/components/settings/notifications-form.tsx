"use client";

import { useActionState } from "react";
import { updateNotificationPrefsAction, type SettingsResult } from "@/lib/settings/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function NotificationsForm({
  defaults,
}: {
  defaults: {
    newLike: boolean;
    newMatch: boolean;
    newMessage: boolean;
    product: boolean;
    channelEmail: boolean;
    channelPush: boolean;
  };
}) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updateNotificationPrefsAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Card>
        <CardTitle>Tell me about</CardTitle>
        <div className="mt-3 flex flex-col gap-3">
          <Checkbox name="newMatch" value="on" defaultChecked={defaults.newMatch} label="New matches" />
          <Checkbox name="newMessage" value="on" defaultChecked={defaults.newMessage} label="New messages" />
          <Checkbox name="newLike" value="on" defaultChecked={defaults.newLike} label="Someone liked me" />
          <Checkbox name="product" value="on" defaultChecked={defaults.product} label="Product news and tips" />
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Safety and security alerts are always on — they can&apos;t be turned off.
        </p>
      </Card>

      <Card>
        <CardTitle>How</CardTitle>
        <div className="mt-3 flex flex-col gap-3">
          <Checkbox name="channelPush" value="on" defaultChecked={defaults.channelPush} label="Push notifications" />
          <Checkbox name="channelEmail" value="on" defaultChecked={defaults.channelEmail} label="Email" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>Save</Button>
        {state?.ok && <span className="text-sm text-ok" role="status">Saved</span>}
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
