"use client";

import { useEffect, useId, useState } from "react";

import { Button } from "../../ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/components/dialog";
import { Input } from "../../ui/components/input";
import { Label } from "../../ui/components/label";

/** 会话和分组命名对话框的本地化文案。 */
export interface ConversationNameDialogLabels {
  description: string;
  nameLabel: string;
  cancel: string;
  submit: string;
  submitting: string;
}

/** 会话和分组共用的键盘可访问命名表单。 */
export function ConversationNameDialog({
  open,
  title,
  initialValue = "",
  maxLength,
  labels,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialValue?: string;
  maxLength: number;
  labels: ConversationNameDialogLabels;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized || submitting) return;
    setSubmitting(true);
    try {
      if (await onSubmit(normalized)) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{labels.nameLabel}</Label>
            <Input
              id={inputId}
              autoFocus
              maxLength={maxLength}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={!value.trim() || submitting}>
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
