"use client";
import type { ReactNode } from "react";

/** 仅用于宿主控制操作展示，不能替代服务端授权。 */
export interface AccessPolicy { allowed: boolean; reason?: string }
export function PermissionExplanation({ decision, subject }: { decision: AccessPolicy; subject?: ReactNode }) {
  return decision.allowed ? null : <p role="status" className="text-sm text-muted-foreground">{decision.reason ?? subject}</p>;
}
