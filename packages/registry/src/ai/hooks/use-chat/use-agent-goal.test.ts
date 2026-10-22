// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import { useAgentGoal } from "./use-agent-goal";
import { goalFixture } from "./agent-goal.test-fixtures";
import { AgentGoalPhase, AgentGoalRecordState } from "./agent-goal-schema";
vi.mock("../../../i18n/runtime", () => ({
  useAgentMessages: () =>
    new Proxy({}, { get: (_, key) => ({ value: String(key) }) }),
}));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() =>
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  }),
);
function setup(id: string | undefined, enabled = true) {
  const get = vi.fn().mockResolvedValue(goalFixture());
  const post = vi.fn().mockResolvedValue({
    ...goalFixture(),
    phase: AgentGoalPhase.Paused,
    goalRevision: 2,
    statusVersion: 2,
    effectivelyArmed: false,
  });
  const patch = vi.fn();
  const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  vi.spyOn(client.chat,'getGoal').mockImplementation((...args)=>get(...args).then((goal:ReturnType<typeof goalFixture>)=>({goal})));
  vi.spyOn(client.chat,'pauseGoal').mockImplementation(post);
  vi.spyOn(client.chat,'resumeGoal').mockImplementation(post);
  vi.spyOn(client.chat,'clearGoal').mockImplementation(post);
  vi.spyOn(client.chat,'editGoal').mockImplementation(patch);
  const hook = renderHook(
    ({ id, enabled }) =>
      useAgentGoal({
        httpClient: client,
        conversationId: id,
        enabled,
        executionActive: false,
        requireAccess: vi.fn(),
      }),
    { initialProps: { id, enabled } },
  );
  return { hook, get, post, patch };
}
it("新会话不读取目标，目标创建通过发送消息完成", () => {
  const {hook, get, post} = setup(undefined);
  expect(get).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(hook.result.current.goal).toBeNull();
});
it("暂停携带版本，旧查询不能覆盖成功结果，相同版本刷新有效激活", async () => {
  const { hook, get, post } = setup("c1");
  await waitFor(() => expect(hook.result.current.goal).not.toBeNull());
  const stale = deferred<ReturnType<typeof goalFixture>>();
  get.mockReturnValueOnce(stale.promise);
  let reading!: Promise<unknown>;
  act(() => {
    reading = hook.result.current.refresh();
  });
  await act(async () => {
    await hook.result.current.pause();
  });
  expect(post).toHaveBeenCalledWith(
    "c1",
    expect.objectContaining({ goalId: "g1", goalRevision: 1 }),
    expect.objectContaining({signal: undefined}),
  );
  await act(async () => {
    stale.resolve(goalFixture());
    await reading;
  });
  expect(hook.result.current.goal?.phase).toBe(AgentGoalPhase.Paused);
  get.mockResolvedValue({
    ...hook.result.current.goal,
    effectivelyArmed: true,
  });
  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.goal?.effectivelyArmed).toBe(true);
});
it("重复点击只发出一次操作；清除在成功后移除当前目标", async () => {
  const { hook, post } = setup("c1");
  await waitFor(() => expect(hook.result.current.goal).not.toBeNull());
  const pending = deferred<ReturnType<typeof goalFixture>>();
  post.mockReturnValue(pending.promise);
  let clearing!: Promise<unknown>;
  act(() => {
    clearing = hook.result.current.clear();
  });
  await act(async () => {
    await expect(hook.result.current.clear()).rejects.toThrow("submitting");
  });
  expect(post).toHaveBeenCalledTimes(1);
  await act(async () => {
    pending.resolve({
      ...goalFixture(),
      recordState: AgentGoalRecordState.Cleared,
    });
    await clearing;
  });
  expect(hook.result.current.goal).toBeNull();
});
it.each([409, 410])(
  "%s 刷新权威状态且不重放操作，只有 410 失效编辑",
  async (status) => {
    const { hook, get, patch } = setup("c1");
    await waitFor(() => expect(hook.result.current.goal).not.toBeNull());
    patch.mockRejectedValue(new ApiError("PATCH", "/goal", status, JSON.stringify({message: "目标已变更"})));
    get.mockResolvedValue({
      ...goalFixture(),
      goalRevision: 2,
      statusVersion: 2,
    });
    await act(async () => {
      await expect(
        hook.result.current.edit({ objective: "保留的草稿" }),
      ).rejects.toThrow();
    });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.goal?.goalRevision).toBe(2);
    expect(hook.result.current.expiredGeneration).toBe(status === 410 ? 1 : 0);
  },
);
it("切换会话隔离旧读取；只读或能力关闭不读取控制面", async () => {
  const { hook, get } = setup("c1", false);
  expect(get).not.toHaveBeenCalled();
  const old = deferred<ReturnType<typeof goalFixture>>();
  get
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue({ ...goalFixture(), goalId: "g2" });
  hook.rerender({ id: "c1", enabled: true });
  hook.rerender({ id: "c2", enabled: true });
  await waitFor(() => expect(hook.result.current.goal?.goalId).toBe("g2"));
  await act(async () => {
    old.resolve(goalFixture());
  });
  expect(hook.result.current.goal?.goalId).toBe("g2");
});
