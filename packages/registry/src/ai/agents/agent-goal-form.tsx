"use client";

import { useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAgentMessages } from "../../i18n/runtime";
import { useFormApiRequest } from "../../api/hooks/use-form-api-request";
import { useApiRequest } from "../../api/hooks/use-api-request";
import { Button } from "../../ui/components/button";
import { Textarea } from "../../ui/components/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormDescription,
  FormLabel,
  FormMessage,
} from "../../ui/components/form";
import { toast } from "../../ui/components/sonner";
import type { AgentGoal } from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

interface AgentGoalFormProps {
  controller: AgentGoalController;
  initialGoal: AgentGoal;
  onSuccess: () => void;
  onCancel: () => void;
  footerStart?: ReactNode;
  onSubmittingChange?: (submitting: boolean) => void;
  showSaveAndStart?: boolean;
}

/** 编辑目标正文；目标创建统一经由聊天 goalMode。 */
export function AgentGoalForm({
  controller,
  initialGoal,
  onSuccess,
  onCancel,
  footerStart,
  onSubmittingChange,
  showSaveAndStart = false,
}: AgentGoalFormProps) {
  const t = useAgentMessages("agent-goal-form");
  const schema = z.object({
    objective: z
      .string()
      .trim()
      .min(1, t.objectiveRequired.value)
      .max(4000, t.objectiveTooLong.value),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { objective: initialGoal.objective },
  });
  const submitting = useRef(false);
  const savedGoal = useRef(initialGoal);
  const [starting, setStarting] = useState(false);
  const objective =
    useWatch({ control: form.control, name: "objective" }) ?? "";
  const request = useFormApiRequest<
    AgentGoal,
    [z.infer<typeof schema>],
    z.infer<typeof schema>
  >(
    (values: z.infer<typeof schema>) =>
      controller.edit(values, {
        goalId: savedGoal.current.goalId,
        goalRevision: savedGoal.current.goalRevision,
      }),
    {
      form,
    },
  );
  const startRequest = useApiRequest(
    (goal: AgentGoal) => controller.resume(goal),
    {
      manual: true,
      disableErrorNotification: true,
    },
  );
  const submit = async (values: z.infer<typeof schema>, start: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    setStarting(start);
    onSubmittingChange?.(true);
    try {
      const goal = await request.runAsync(values);
      savedGoal.current = goal;
      form.reset(values);
      if (start) {
        try {
          await startRequest.runAsync(goal);
        } catch {
          toast.warning(t.savedButStartFailed);
          return;
        }
      }
      toast.success(start ? t.savedAndStarted : t.saved);
      onSuccess();
    } catch {
      /* 字段错误由表单 Hook 回填，失败保留草稿。 */
    } finally {
      submitting.current = false;
      setStarting(false);
      onSubmittingChange?.(false);
    }
  };
  const handleSubmit = form.handleSubmit((values) => submit(values, false));
  const handleSaveAndStart = form.handleSubmit((values) =>
    submit(values, true),
  );
  const loading =
    form.formState.isSubmitting ||
    request.loading ||
    startRequest.loading ||
    controller.loading;
  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 min-w-0 flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="objective"
          render={({ field }) => (
            <FormItem className="flex min-h-0 flex-col gap-2">
              <FormLabel className="shrink-0">{t.objective}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className="h-40 min-h-0 resize-none overflow-y-auto"
                  maxLength={4000}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription className="shrink-0 text-right text-xs tabular-nums">
                {t.characterCount({ count: objective.length })}
              </FormDescription>
              <FormMessage className="shrink-0" />
            </FormItem>
          )}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
          {footerStart && <div className="shrink-0">{footerStart}</div>}
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onCancel}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              variant={showSaveAndStart ? "outline" : "default"}
              disabled={loading}
            >
              {loading && !starting ? t.saving : t.save}
            </Button>
            {showSaveAndStart && (
              <Button
                type="button"
                disabled={loading}
                onClick={handleSaveAndStart}
              >
                {loading && starting ? t.savingAndStarting : t.saveAndStart}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
