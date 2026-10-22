// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useConversationFolderPages } from "./use-conversation-folder-pages";
import {
  ConversationQueryStatus,
  type ConversationPageInput,
} from "./use-conversation-operations";

afterEach(cleanup);

function createFolderPages() {
  let records = Array.from({ length: 18 }, (_, index) => ({
    id: String(index),
  }));
  const getPage = vi.fn(
    async ({ current = 0, size = 5 }: ConversationPageInput) => ({
      records: records.slice(current * size, (current + 1) * size),
      page: { current, size, total: records.length },
    }),
  );
  const options = {
    enabled: true,
    identityKey: "user-1",
    getGroups: async () => ({ records: [] }),
    getPage,
    getConversationId: (record: { id: string }) => record.id,
  };
  const hook = renderHook(() => useConversationFolderPages(options));
  return {
    ...hook,
    getPage,
    setRecords: (next: typeof records) => {
      records = next;
    },
  };
}

it("刷新分组保留已展开页数，并从下一页继续加载", async () => {
  const { result, setRecords } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  expect(result.current.records).toHaveLength(10);

  const reordered = Array.from({ length: 18 }, (_, index) => ({
    id: String(17 - index),
  }));
  setRecords(reordered);
  await act(() => result.current.reloadFolder(null));
  expect(result.current.records).toEqual(reordered.slice(0, 10));
  expect(result.current.folders[0]?.current).toBe(1);

  await act(() => result.current.loadMore(null));
  expect(result.current.records).toEqual(reordered.slice(0, 15));
});

it("完整刷新目录也保留已展开范围", async () => {
  const { result } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  await act(() => result.current.reload());
  expect(result.current.records).toHaveLength(10);
  expect(result.current.folders[0]?.current).toBe(1);
});

it("刷新后续页失败时保留完整旧列表与分页位置", async () => {
  const { result, getPage } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  const previous = result.current.records;
  getPage
    .mockResolvedValueOnce({
      records: [{ id: "changed" }],
      page: { current: 0, size: 5, total: 18 },
    })
    .mockRejectedValueOnce(new Error("第二页刷新失败"));
  await act(() => result.current.reloadFolder(null));
  expect(result.current.records).toEqual(previous);
  expect(result.current.folders[0]).toMatchObject({ current: 1, failed: true });
});

it("服务端总数减少时停在最后一页", async () => {
  const { result, getPage, setRecords } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  await act(() => result.current.loadMore(null));
  setRecords([{ id: "remaining" }]);
  getPage.mockClear();
  await act(() => result.current.reloadFolder(null));
  expect(getPage).toHaveBeenCalledTimes(1);
  expect(result.current.folders[0]).toMatchObject({ current: 0, total: 1 });
  expect(result.current.records).toEqual([{ id: "remaining" }]);
});

it("切换视图重置页数并隔离旧视图的延迟响应", async () => {
  let resolveActive:
    | ((value: {
        records: { id: string }[];
        page: { current: number; size: number; total: number };
      }) => void)
    | undefined;
  const getPage = vi.fn(({ status }: ConversationPageInput) =>
    status === ConversationQueryStatus.ACTIVE
      ? new Promise<{
          records: { id: string }[];
          page: { current: number; size: number; total: number };
        }>((resolve) => {
          resolveActive = resolve;
        })
      : Promise.resolve({
          records: [{ id: "archived" }],
          page: { current: 0, size: 5, total: 1 },
        }),
  );
  const options = {
    enabled: true,
    identityKey: "user",
    getPage,
    getGroups: async () => ({ records: [] }),
    getConversationId: (item: { id: string }) => item.id,
  };
  const { result, rerender } = renderHook(
    ({ status }) => useConversationFolderPages({ ...options, status }),
    { initialProps: { status: ConversationQueryStatus.ACTIVE } },
  );
  await waitFor(() => expect(resolveActive).toBeDefined());
  rerender({ status: ConversationQueryStatus.ARCHIVED });
  await waitFor(() =>
    expect(result.current.records).toEqual([{ id: "archived" }]),
  );
  await act(async () =>
    resolveActive?.({
      records: [{ id: "stale-active" }],
      page: { current: 0, size: 5, total: 40 },
    }),
  );
  expect(result.current.records).toEqual([{ id: "archived" }]);
  expect(result.current.folders[0]).toMatchObject({ current: 0, total: 1 });
});

it("确认删除或状态移出视图后立即扣减总数，后台失败保留已确认结果", async () => {
  const { result, getPage } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  act(() => result.current.removeConversation("0"));
  expect(result.current.folders[0]).toMatchObject({ current: 1, total: 17 });
  expect(result.current.records).toHaveLength(9);
  getPage.mockRejectedValue(new Error("同步失败"));
  await act(() => result.current.reloadFolder(null));
  expect(result.current.records).toHaveLength(9);
  expect(result.current.folders[0]).toMatchObject({ current: 1, total: 17 });
});

it("本地归档移除后继续展开会补齐页边界，不跳过下一条会话", async () => {
  const { result, setRecords } = createFolderPages();
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.loadMore(null));
  act(() => result.current.removeConversation("0"));
  const remaining = Array.from({ length: 17 }, (_, index) => ({
    id: String(index + 1),
  }));
  setRecords(remaining);
  await act(() => result.current.loadMore(null));
  expect(result.current.records).toEqual(remaining.slice(0, 15));
  expect(result.current.folders[0]).toMatchObject({ current: 2, total: 17 });
});
