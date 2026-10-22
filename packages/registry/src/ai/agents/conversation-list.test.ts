// @vitest-environment jsdom

import { notifyConversationStatusChanged } from "../hooks/use-chat/conversation-lifecycle-events";
import { ConversationStatus } from "../hooks/use-chat/conversation-status";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationList } from "./conversation-list";

const mocks = vi.hoisted(() => ({
  canManage: true,
  operations: {
    getConversationPage: vi.fn(),
    updateStatus: vi.fn(),
    deleteConversation: vi.fn(),
    updateTitle: vi.fn(),
    moveConversation: vi.fn(),
    createConversationGroup: vi.fn(),
    getConversationGroups: vi.fn(),
    renameConversationGroup: vi.fn(),
    deleteConversationGroup: vi.fn(),
  },
  chatContext: {
    setPendingConversationGroupId: vi.fn(),
    clearPendingConversationGroupId: vi.fn(),
  },
  titleSync: {
    resume: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
  labels: new Proxy(
    Object.fromEntries(
      [
        "newConversation",
        "moreActions",
        "expandFolder",
        "collapseFolder",
        "dragConversation",
        "noConversations",
        "untitled",
        "deleteConversation",
        "deleteConfirmTitle",
        "deleteConfirmDesc",
        "deleteSuccess",
        "cancel",
        "allGroups",
        "ungrouped",
        "newGroup",
        "createGroup",
        "renameConversation",
        "moveToGroup",
        "loadMore",
        "renameGroup",
        "deleteGroup",
        "deleteGroupConfirm",
        "nameDialogDescription",
        "nameLabel",
        "save",
        "saving",
      ].map((key) => [key, { value: key }]),
    ),
    {
      get: (target, key) =>
        typeof key === "string" ? (target[key] ?? { value: key }) : undefined,
    },
  ),
}));

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: (key: string) =>
    key === "ai-conversation-archive-controls"
      ? new Proxy(
          {},
          {
            get: (_, field) =>
              field === "loadMore"
                ? ({ count }: { count: number }) => ({
                    value: `Show ${count} remaining`,
                  })
                : { value: String(field) },
          },
        )
      : mocks.labels,
  useAgentLocale: () => ({ locale: "en" }),
}));
vi.mock("@dnd-kit/react", async () => {
  const ReactModule = await import("react");
  return {
    DragOverlay: () => null,
    DragDropProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useDraggable: () => ({
      ref: () => {},
      handleRef: () => {},
      isDragging: false,
    }),
    useDroppable: () => ({ ref: () => {}, isDropTarget: false }),
  };
});
vi.mock("../../api/hooks/use-api-request", () => ({
  useApiRequest: (service: (...args: unknown[]) => Promise<unknown>) => ({
    runAsync: service,
    loading: false,
  }),
}));
vi.mock(
  "../hooks/use-chat/use-conversation-operations",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../hooks/use-chat/use-conversation-operations")
    >()),
    useConversationOperations: () => mocks.operations,
  }),
);
vi.mock("../hooks/use-chat/use-conversation-title-sync", () => ({
  useConversationTitleSync: () => mocks.titleSync,
}));
vi.mock("./use-ai-chat-access", () => ({
  useAiChatAccess: () => ({
    canRead: true,
    canWrite: mocks.canManage,
    canExecute: mocks.canManage,
    requireAccess: vi.fn(),
  }),
}));
vi.mock("./context.tsx", () => ({
  useAiChatContext: () => ({ httpClient: {}, ...mocks.chatContext }),
}));

afterEach(cleanup);

describe("ConversationList 分组界面", () => {
  let groups: Array<{ id: number; name: string }>;
  let loadedConversation: Record<string, unknown> | null;

  beforeEach(() => {
    mocks.canManage = true;
    groups = [];
    loadedConversation = null;
    vi.clearAllMocks();
    mocks.operations.getConversationPage.mockResolvedValue({
      records: [],
      page: { current: 0, size: 30, total: 0 },
    });
    mocks.operations.getConversationGroups.mockImplementation(async () => ({
      records: [...groups],
      page: { current: 0, size: 100, total: groups.length },
    }));
    mocks.operations.createConversationGroup.mockImplementation(
      async ({ name }: { name: string }) => {
        const group = { id: 1, name };
        groups.push(group);
        return group;
      },
    );
    mocks.operations.renameConversationGroup.mockImplementation(
      async (id: number, { name }: { name: string }) => {
        groups = groups.map((group) =>
          group.id === id ? { ...group, name } : group,
        );
        return groups.find((group) => group.id === id);
      },
    );
  });

  it("创建分组后显示服务端目录结果", async () => {
    render(
      React.createElement(ConversationList, {
        onConversationSelect: vi.fn(),
        onNewConversation: vi.fn(),
        labels: {
          newConversation: "New conversation",
          pendingConversation: "New session",
          noConversations: "No conversations",
          untitled: "Untitled",
          deleteConversation: "Delete conversation",
          deleteConfirmTitle: "Delete conversation?",
          deleteConfirmDesc: "This cannot be undone",
          deleteSuccess: "Deleted",
          cancel: "Cancel",
          allGroups: "All conversations",
          ungrouped: "Ungrouped",
          newGroup: "New group",
          createGroup: "Create group",
          moreActions: "More actions",
          renameConversation: "Rename conversation",
          moveToGroup: "Move to group",
          loadMore: "Load more",
          renameGroup: "Rename group",
          deleteGroup: "Delete group",
          deleteGroupConfirm: "Delete group?",
          nameDialogDescription: "Enter a name",
          nameLabel: "Name",
          save: "Save",
          saving: "Saving",
        },
      }),
    );

    await waitFor(() =>
      expect(mocks.operations.getConversationGroups).toHaveBeenCalled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Projects" })).toBeTruthy(),
    );
    expect(mocks.operations.createConversationGroup).toHaveBeenCalledWith({
      name: "Projects",
    });

    expect(mocks.operations.getConversationPage).toHaveBeenCalled();
  });

  it("点击分组的新会话按钮会把该分组设为草稿目标", async () => {
    const onNewConversation = vi.fn();
    const props = {
      onConversationSelect: vi.fn(),
      onNewConversation,
      showNewConversationButton: false,
      labels: {
        newConversation: "New conversation",
        pendingConversation: "New session",
        noConversations: "No conversations",
        newGroup: "New group",
        createGroup: "Create group",
        ungrouped: "Ungrouped",
        moreActions: "More actions",
        nameLabel: "Name",
        save: "Save",
      },
      get refreshSignal() {
        return loadedConversation ? 1 : 0;
      },
      get activeConversationId() {
        return loadedConversation?.conversationId as string | undefined;
      },
    };
    mocks.operations.getConversationPage.mockImplementation(
      async (input: { groupId?: number }) => ({
        records:
          loadedConversation && input.groupId === 1 ? [loadedConversation] : [],
        page: { current: 0, size: 30, total: loadedConversation ? 1 : 0 },
      }),
    );
    const view = render(React.createElement(ConversationList, props));

    await waitFor(() =>
      expect(mocks.operations.getConversationGroups).toHaveBeenCalled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Projects" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    expect(
      mocks.chatContext.setPendingConversationGroupId,
    ).toHaveBeenCalledWith(1);
    expect(onNewConversation).toHaveBeenCalledWith(1);
    const pendingButton = screen.getByRole("button", { name: "New session" });
    expect(pendingButton).toBeTruthy();
    expect(pendingButton.parentElement?.className).toContain(
      "bg-sidebar-accent",
    );

    loadedConversation = {
      conversationId: "real-conversation-id",
      title: "Real conversation",
      status: "ACTIVE",
      messageCount: 1,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      usage: null,
      createdTime: new Date(),
      lastUpdateTime: new Date(),
      groupId: 1,
      groupName: "Projects",
      pinned: false,
    };
    view.rerender(React.createElement(ConversationList, props));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Real conversation" }),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "New session" })).toBeNull();
  });
  function row(status = "ACTIVE") {
    return {
      conversationId: "row",
      title: "会话",
      status,
      messageCount: 1,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      createdTime: new Date(),
      lastUpdateTime: new Date(),
      groupId: null,
      pinned: true,
    };
  }
  async function openRowMenu() {
    const more = await screen.findByRole("button", { name: "moreActions" });
    fireEvent.keyDown(more, { key: "Enter" });
  }
  it("正常会话使用归档入口，归档当前会话后回到新会话", async () => {
    const onNewConversation = vi.fn();
    let status = "ACTIVE";
    mocks.operations.getConversationPage.mockImplementation(async () => ({
      records: status === "ACTIVE" ? [row()] : [],
      page: { current: 0, size: 5, total: status === "ACTIVE" ? 1 : 0 },
    }));
    mocks.operations.updateStatus.mockImplementation(async () => {
      status = "ARCHIVED";
    });
    render(
      React.createElement(ConversationList, {
        activeConversationId: "row",
        onNewConversation,
        onConversationSelect: vi.fn(),
      }),
    );
    await openRowMenu();
    expect(
      screen.queryByRole("menuitem", { name: "deleteConversation" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "archive" }));
    await waitFor(() => expect(onNewConversation).toHaveBeenCalled());
    expect(mocks.operations.updateStatus).toHaveBeenCalledWith("row", {
      status: "ARCHIVED",
    });
  });
  it("归档项只提供恢复删除并且没有拖动把手", async () => {
    mocks.operations.getConversationPage.mockResolvedValue({
      records: [row("ARCHIVED")],
      page: { current: 0, size: 5, total: 1 },
    });
    render(
      React.createElement(ConversationList, {
        onNewConversation: vi.fn(),
        onConversationSelect: vi.fn(),
        onTogglePinned: vi.fn(),
      }),
    );
    await openRowMenu();
    expect(screen.getByRole("menuitem", { name: "restore" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "deleteConversation" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "renameConversation" }),
    ).toBeNull();
    expect(screen.queryByLabelText("dragConversation")).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "unpinConversation" }),
    ).toBeNull();
  });
  it("只有读取权限时隐藏状态修改菜单", async () => {
    mocks.canManage = false;
    mocks.operations.getConversationPage.mockResolvedValue({
      records: [row()],
      page: { current: 0, size: 5, total: 1 },
    });
    render(
      React.createElement(ConversationList, {
        onNewConversation: vi.fn(),
        onConversationSelect: vi.fn(),
      }),
    );
    await screen.findByRole("button", { name: "会话" });
    expect(screen.queryByRole("button", { name: "moreActions" })).toBeNull();
  });
  it("顶部恢复入口确认成功后立即移出仅归档视图，后台失败保留结果", async () => {
    mocks.operations.getConversationPage.mockResolvedValue({
      records: [row("ARCHIVED")],
      page: { current: 0, size: 5, total: 1 },
    });
    render(
      React.createElement(ConversationList, {
        onNewConversation: vi.fn(),
        onConversationSelect: vi.fn(),
      }),
    );
    await screen.findByRole("button", { name: "会话" });
    fireEvent.keyDown(screen.getByRole("button", { name: "view" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "archivedOnly" }),
    );
    await waitFor(() =>
      expect(mocks.operations.getConversationPage).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ARCHIVED" }),
      ),
    );
    mocks.operations.getConversationPage.mockRejectedValue(
      new Error("同步失败"),
    );
    act(() =>
      notifyConversationStatusChanged("row", ConversationStatus.ACTIVE),
    );
    expect(screen.queryByRole("button", { name: "会话" })).toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "会话" })).toBeNull(),
    );
  });
});
