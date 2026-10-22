"use client";

import { Pause, Play } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { useApiRequest } from "../../api/hooks/use-api-request";
import { Button } from "../../ui/components/button";
import { toast } from "../../ui/components/sonner";
import { AgentGoalPhase } from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

interface AgentGoalToggleProps {
  controller: AgentGoalController;
}

/** 目标条和详情共用的暂停、恢复操作。 */
export function AgentGoalToggle({ controller }: AgentGoalToggleProps) {
  const t = useAgentMessages("agent-goal-toggle");
  const pause = useApiRequest(() => controller.pause(), {
    manual: true,
    onSuccess: () => toast.success(t.paused),
  });
  const resume = useApiRequest(() => controller.resume(), {
    manual: true,
    onSuccess: () => toast.success(t.resumed),
  });
  const goal = controller.goal;
  if (!goal || goal.phase === AgentGoalPhase.Complete) return null;
  const pausable = goal.phase === AgentGoalPhase.Active && goal.effectivelyArmed;
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      disabled={controller.loading || pause.loading || resume.loading}
      aria-label={pausable ? t.pause.value : t.resume.value}
      title={pausable ? t.pause.value : t.resume.value}
      onClick={() => (pausable ? pause.run() : resume.run())}
    >
      {pausable ? <Pause /> : <Play />}
    </Button>
  );
}
