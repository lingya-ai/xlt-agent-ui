"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useSize } from "ahooks";
import { cn } from "../../ui/lib/utils";
import { WorkspaceSplitPanel } from "./workspace-split-panel";
import { WorkspaceSheetPanel } from "./workspace-sheet-panel";
import { useWorkspaceController } from "./workspace-controller";

export type AgentsChatWorkspaceOptions = {
  /** 工作区展示模式，默认按容器宽度选择分栏或抽屉。 */
  mode?: "sheet" | "split" | "auto";
  /** 分栏回退为抽屉的容器最小宽度。 */
  collapseBelow?: number;
  /** 工作区存在文件且容器足够宽时，首次加载后默认打开分栏。 */
  defaultOpenWhenFilesAvailable?: boolean;
};
interface AgentsChatWorkspaceLayoutProps {
  workspace?: AgentsChatWorkspaceOptions;
  className?: string;
  children: ReactNode;
}
const AgentsChatWorkspaceLayoutContext = createContext({ isSplit: false });

/** 获取当前实际生效的工作区布局。 */
export function useAgentsChatWorkspaceLayout() {
  return useContext(AgentsChatWorkspaceLayoutContext);
}

/** 使用同一展示开关切换分栏与抽屉，保持聊天子树和标签状态稳定。 */
export function AgentsChatWorkspaceLayout({
  workspace,
  className,
  children,
}: AgentsChatWorkspaceLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useSize(containerRef);
  const { files, workspaceOpen, openWorkspace, closeWorkspace } =
    useWorkspaceController();
  const defaultOpenAppliedRef = useRef(false);
  const mode = workspace?.mode ?? "auto";
  const collapseBelow = workspace?.collapseBelow ?? 960;
  const isWideEnough = size !== undefined && size.width >= collapseBelow;
  const isSplit = workspaceOpen && mode !== "sheet" && isWideEnough;

  useEffect(() => {
    if (mode === "split") openWorkspace();
  }, [mode, openWorkspace]);
  useEffect(() => {
    if (!workspace?.defaultOpenWhenFilesAvailable || files.length === 0) {
      defaultOpenAppliedRef.current = false;
      return;
    }
    if (mode !== "auto" || !isWideEnough || defaultOpenAppliedRef.current)
      return;
    defaultOpenAppliedRef.current = true;
    openWorkspace();
  }, [
    files.length,
    isWideEnough,
    mode,
    openWorkspace,
    workspace?.defaultOpenWhenFilesAvailable,
  ]);

  return (
    <AgentsChatWorkspaceLayoutContext.Provider value={{ isSplit }}>
      <div
        ref={containerRef}
        className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      >
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            isSplit && "min-w-[360px]",
          )}
        >
          {children}
        </section>
        {isSplit ? (
          <WorkspaceSplitPanel onClose={closeWorkspace} />
        ) : (
          <WorkspaceSheetPanel />
        )}
      </div>
    </AgentsChatWorkspaceLayoutContext.Provider>
  );
}
