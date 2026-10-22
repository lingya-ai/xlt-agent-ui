"use client";

import { WorkspaceContentTabs } from "./workspace-content-tabs";
interface WorkspaceSplitPanelProps {
  onClose: () => void;
}

/** 右侧常驻工作区，共用统一的标签内容。 */
export function WorkspaceSplitPanel({ onClose }: WorkspaceSplitPanelProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-[1.45] flex-col border-l bg-background">
      <WorkspaceContentTabs onClose={onClose} />
    </aside>
  );
}
