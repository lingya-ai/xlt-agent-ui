"use client";

import { useEffect, useState } from "react";
import { useMemoizedFn, useTimeout } from "ahooks";
import {
  ProcessActivityKind,
  type ProcessActivity,
} from "./process-activity-summary";

/** 空档保留上一活动，真实候选最多每150ms整体替换一次；结束立即取消排队更新。 */
export function useLiveProcessActivity(
  activity: ProcessActivity,
  active: boolean,
  latestActivity?: ProcessActivity,
): ProcessActivity {
  const current =
    activity.kind === ProcessActivityKind.Idle
      ? (latestActivity ?? activity)
      : activity;
  const [state, setState] = useState(() => ({
    active,
    displayed: current,
    displayedAt: Date.now(),
  }));
  // 同一组重新进入执行时使用当前投影，不沿用上一次执行的展示缓存。
  if (state.active !== active)
    setState({ active, displayed: current, displayedAt: Date.now() });
  const displayed = state.active === active ? state.displayed : current;
  const candidate =
    activity.kind === ProcessActivityKind.Idle &&
    (!latestActivity || current.key === displayed.key)
      ? displayed
      : current;
  const changed =
    displayed.kind !== candidate.kind ||
    displayed.key !== candidate.key ||
    displayed.action !== candidate.action ||
    displayed.preparing !== candidate.preparing ||
    displayed.detail !== candidate.detail;
  const remaining = 150 - (Date.now() - state.displayedAt);
  const commit = useMemoizedFn(() => {
    if (!active || !changed) return;
    setState({ active, displayed: candidate, displayedAt: Date.now() });
  });
  // 连续token只替换候选，不推迟既定提交时刻；空档不制造思考候选。
  useTimeout(
    commit,
    active && changed && remaining > 0 ? remaining : undefined,
  );
  useEffect(() => {
    if (active && changed && remaining <= 0) commit();
  }, [active, changed, remaining, commit]);
  return active ? displayed : current;
}
