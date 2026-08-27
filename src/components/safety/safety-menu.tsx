"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/auth/form-message";
import { blockAction, reportAction, unmatchAction } from "@/lib/safety/actions";
import { REPORT_CATEGORY_LABELS } from "@/lib/enums/labels";
import { cn } from "@/lib/cn";

type Dialog = null | "unmatch" | "block" | "report";

/**
 * Block / report / unmatch — a first-class control, present wherever you can see
 * another member. Never hidden behind a paywall.
 */
export function SafetyMenu({
  subjectUserId,
  subjectName,
  matchId,
  conversationId,
  className,
}: {
  subjectUserId: string;
  subjectName: string;
  matchId?: string;
  conversationId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string>();

  const [category, setCategory] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [alsoReport, setAlsoReport] = React.useState(true);

  const close = () => {
    setDialog(null);
    setError(undefined);
  };

  const doUnmatch = () =>
    start(async () => {
      const res = await unmatchAction(matchId!);
      if (!res.ok) setError(res.error);
      // unmatchAction redirects on success
    });

  const doBlock = () =>
    start(async () => {
      const res = await blockAction({
        userId: subjectUserId,
        alsoReport: alsoReport && Boolean(category),
        category: category || undefined,
        details: details || undefined,
      });
      if (!res.ok) return setError(res.error);
      close();
      router.push("/connections");
      router.refresh();
    });

  const doReport = () =>
    start(async () => {
      const res = await reportAction({
        subjectUserId,
        category,
        details: details || undefined,
        conversationId,
      });
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          aria-label="Safety options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <circle cx="4" cy="10" r="1.6" fill="currentColor" />
            <circle cx="10" cy="10" r="1.6" fill="currentColor" />
            <circle cx="16" cy="10" r="1.6" fill="currentColor" />
          </svg>
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-[var(--radius-md)] border border-line bg-paper-raised py-1 shadow-[var(--shadow-md)]"
          >
            {matchId && (
              <MenuItem onClick={() => { setOpen(false); setDialog("unmatch"); }}>
                Unmatch
              </MenuItem>
            )}
            <MenuItem onClick={() => { setOpen(false); setDialog("report"); }}>
              Report
            </MenuItem>
            <MenuItem
              destructive
              onClick={() => { setOpen(false); setDialog("block"); }}
            >
              Block
            </MenuItem>
          </div>
        )}
      </div>

      <Modal
        open={dialog === "unmatch"}
        onClose={close}
        title={`Unmatch with ${subjectName}?`}
        description="Your conversation disappears for both of you. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={doUnmatch}>Unmatch</Button>
          </>
        }
      >
        <FormMessage error={error} />
        <p className="text-sm text-ink-soft">
          {subjectName} won&apos;t be told. You just won&apos;t see each other in
          Connections anymore.
        </p>
      </Modal>

      <Modal
        open={dialog === "block"}
        onClose={close}
        title={`Block ${subjectName}?`}
        description="You won't see each other anywhere on Lunova, and any match ends."
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={doBlock}>Block</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormMessage error={error} />
          <Checkbox
            checked={alsoReport}
            onChange={(e) => setAlsoReport(e.currentTarget.checked)}
            label="Also report them to our safety team"
          />
          {alsoReport && (
            <ReportFields
              category={category}
              setCategory={setCategory}
              details={details}
              setDetails={setDetails}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === "report"}
        onClose={close}
        title={`Report ${subjectName}`}
        description="Reports are private. Our safety team reviews every one."
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={!category}
              onClick={doReport}
            >
              Submit report
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormMessage error={error} />
          <ReportFields
            category={category}
            setCategory={setCategory}
            details={details}
            setDetails={setDetails}
          />
        </div>
      </Modal>
    </>
  );
}

function ReportFields({
  category,
  setCategory,
  details,
  setDetails,
}: {
  category: string;
  setCategory: (v: string) => void;
  details: string;
  setDetails: (v: string) => void;
}) {
  return (
    <>
      <RadioGroup
        name="report-category"
        value={category}
        onValueChange={setCategory}
        options={Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <Textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Anything that helps us understand what happened (optional)"
        aria-label="Report details"
      />
    </>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "block w-full px-3.5 py-2 text-left text-sm hover:bg-sand",
        destructive ? "text-danger" : "text-ink",
      )}
    >
      {children}
    </button>
  );
}
