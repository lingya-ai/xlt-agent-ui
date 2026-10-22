"use client";

import { useAgentMessages } from "../../i18n/runtime";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../ui/components/sheet";
import { useWorkspaceController } from "./workspace-controller";
import { WorkspaceContentTabs } from "./workspace-content-tabs";

/** 窄容器下的工作区抽屉，所有预览都在同一个标签外壳中展示。 */
export function WorkspaceSheetPanel() {
  const t = useAgentMessages("workspace-sheet-panel");
  const { workspaceOpen, closeWorkspace } = useWorkspaceController();
  return (
    <Sheet
      open={workspaceOpen}
      onOpenChange={(open) => {
        if (!open) closeWorkspace();
      }}
    >
      <SheetContent
        showClose={false}
        className="flex h-full w-full min-w-0 max-w-none flex-col gap-0 p-0 sm:w-[80vw] sm:max-w-[1000px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t.title}</SheetTitle>
          <SheetDescription>{t.description}</SheetDescription>
        </SheetHeader>
        {workspaceOpen && <WorkspaceContentTabs />}
      </SheetContent>
    </Sheet>
  );
}
