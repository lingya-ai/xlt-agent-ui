// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ChatInputMode, useChatInputMode } from "./use-chat-input-mode";

afterEach(cleanup);

it("三种模式互斥，同一时刻只有一个模式生效", () => {
  const { result } = renderHook(() => useChatInputMode("c1", false, false));
  act(() => result.current.selectMode(ChatInputMode.PLAN));
  expect(result.current).toMatchObject({ planMode: true, goalMode: false });
  act(() => result.current.selectMode(ChatInputMode.GOAL));
  expect(result.current).toMatchObject({ planMode: false, goalMode: true });
  act(() => result.current.selectMode(ChatInputMode.NORMAL));
  expect(result.current).toMatchObject({ planMode: false, goalMode: false });
});

it("上一条提交完成不能清除请求期间的新模式选择", () => {
  const { result, rerender } = renderHook(
    ({ serverMode }) => useChatInputMode("c1", serverMode, false),
    { initialProps: { serverMode: false } },
  );
  act(() => result.current.selectMode(ChatInputMode.PLAN));
  const completePreviousSubmission = result.current.markSubmitted;
  act(() => result.current.selectMode(ChatInputMode.NORMAL));
  act(() => completePreviousSubmission);
  rerender({ serverMode: true });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
});

it("新会话默认普通，模式选择在发送之前不写服务端", () => {
  const { result } = renderHook(() =>
    useChatInputMode(undefined, undefined, false),
  );
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
  act(() => result.current.selectMode(ChatInputMode.PLAN));
  expect(result.current.mode).toBe(ChatInputMode.PLAN);
});

it("后台刷新不能覆盖模式选择或正在编辑的正文", () => {
  const { result, rerender } = renderHook(
    ({ server, draft }) => useChatInputMode("c1", server, draft),
    { initialProps: { server: true, draft: false } },
  );
  act(() => result.current.selectMode(ChatInputMode.NORMAL));
  rerender({ server: false, draft: true });
  rerender({ server: true, draft: true });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
  act(() => result.current.markSubmitted());
  rerender({ server: false, draft: false });
  rerender({ server: true, draft: true });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
});

it("目标模式提交成功后不被服务端计划状态覆盖", () => {
  const { result, rerender } = renderHook(
    ({ server }) => useChatInputMode("c1", server, false),
    { initialProps: { server: false } },
  );
  act(() => result.current.selectMode(ChatInputMode.GOAL));
  act(() => result.current.markSubmitted());
  rerender({ server: true });
  rerender({ server: false });
  expect(result.current.mode).toBe(ChatInputMode.GOAL);
});

it("首条消息分配会话ID保持选择，切换已有会话和重启恢复默认", () => {
  const { result, rerender } = renderHook(
    ({ cid, server }) => useChatInputMode(cid, server, false),
    {
      initialProps: {
        cid: undefined as string | undefined,
        server: undefined as boolean | undefined,
      },
    },
  );
  act(() => result.current.selectMode(ChatInputMode.PLAN));
  rerender({ cid: "c1", server: false });
  expect(result.current.mode).toBe(ChatInputMode.PLAN);
  act(() => result.current.selectMode(ChatInputMode.GOAL));
  rerender({ cid: "c2", server: false });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
  act(() => result.current.selectMode(ChatInputMode.GOAL));
  rerender({ cid: undefined, server: undefined });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
});

it("空草稿随审批退出和模型主动进入更新模式", () => {
  const { result, rerender } = renderHook(
    ({ server }) => useChatInputMode("c1", server, false),
    { initialProps: { server: true } },
  );
  rerender({ server: false });
  expect(result.current.mode).toBe(ChatInputMode.NORMAL);
  rerender({ server: true });
  expect(result.current.mode).toBe(ChatInputMode.PLAN);
});
