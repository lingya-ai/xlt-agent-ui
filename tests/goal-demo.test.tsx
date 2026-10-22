import {render, screen, fireEvent, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {createDemoClient} from "../packages/registry/src/examples/mock-client";
import {AgentGoalDemo} from "../packages/registry/src/examples/goal-demo";
import {AgentProvider} from "../packages/registry/src/openapi/provider";
import {AgentGoalPhase, AgentGoalRecordState} from "../packages/registry/src/ai/hooks/use-chat/agent-goal-schema";

const create = (client: ReturnType<typeof createDemoClient>, id = "demo", query = "分析季度销售") =>
  client.chat.continueChat(id,{query,goalMode:true});

describe("目标模拟契约", () => {
  it("创建、编辑、暂停、恢复、清除并保留分页历史", async () => {
    const client = createDemoClient(); const api = client.chat;
    expect((await api.getGoal("demo")).goal).toBeNull();
    await create(client);
    let goal = (await api.getGoal("demo")).goal!;
    expect(goal.objective).toBe("分析季度销售");
    expect(goal.phase).toBe(AgentGoalPhase.Active);
    goal = await api.editGoal("demo", {...goal, objective: "完成分析报告"});
    expect(goal.goalRevision).toBe(2);
    goal = await api.pauseGoal("demo", goal);
    expect(goal.phase).toBe(AgentGoalPhase.Paused);
    expect(goal.effectivelyArmed).toBe(false);
    goal = await api.resumeGoal("demo", goal);
    expect(goal.phase).toBe(AgentGoalPhase.Active);
    expect(goal.effectivelyArmed).toBe(true);
    const cleared = await api.clearGoal("demo", goal);
    expect(cleared.recordState).toBe(AgentGoalRecordState.Cleared);
    expect((await api.getGoal("demo")).goal).toBeNull();
    await create(client, "demo", "第二个目标");
    const first = await api.getGoalHistory("demo", {page:0,size:1});
    expect(first.items[0]?.objective).toBe("第二个目标"); expect(first.hasNext).toBe(true);
    const second = await api.getGoalHistory("demo", {page:1,size:1});
    expect(second.items[0]?.recordState).toBe(AgentGoalRecordState.Cleared);
    expect(second.hasNext).toBe(false);
    
  });
  it("拒绝重复创建、过期版本和错误目标引用且不污染现有目标", async () => {
    const client = createDemoClient(); const api = client.chat;
    await create(client); const original = (await api.getGoal("demo")).goal!;
    await expect(create(client)).rejects.toMatchObject({status: 409});
    await api.pauseGoal("demo", original);
    await expect(api.resumeGoal("demo", original)).rejects.toMatchObject({status: 409});
    await expect(api.clearGoal("demo", {...original, goalId: "replaced"})).rejects.toMatchObject({status: 410});
    expect((await api.getGoal("demo")).goal?.phase).toBe(AgentGoalPhase.Paused);
    
  });
  it("隔离会话和模拟客户端，普通聊天不创建目标", async () => {
    const client = createDemoClient(); const other = createDemoClient();
    await client.chat.createChat({query:"普通聊天"});
    expect((await client.chat.getGoal("demo")).goal).toBeNull();
    await create(client, "other-conversation");
    expect((await client.chat.getGoal("other-conversation")).goal).not.toBeNull();
    expect((await client.chat.getGoal("demo")).goal).toBeNull();
    expect((await other.chat.getGoal("other-conversation")).goal).toBeNull();
     
  });
  it("校验创建正文、模式互斥与历史分页", async () => {
    const client = createDemoClient();
    await expect(create(client, "demo", " ")).rejects.toMatchObject({status: 400});
    await expect(client.chat.createChat({query:"目标",goalMode:true,planMode:true})).rejects.toMatchObject({status: 400});
    await expect(client.chat.getGoalHistory("demo",{page:-1})).rejects.toMatchObject({status: 400});
    await expect(client.chat.getGoalHistory("demo",{page:0,size:101})).rejects.toMatchObject({status: 400});
    
  });
});

it("目标演示通过实际组件创建、编辑、暂停、恢复与清除", async () => {
  const client = createDemoClient();
  const view = render(<AgentProvider client={client} identityKey="goal-test"><AgentGoalDemo initialConversationId="demo" simulated/></AgentProvider>);
  fireEvent.change(screen.getByLabelText("目标正文"), {target: {value: "验证交互目标"}});
  await waitFor(() => expect((screen.getByRole("button", {name: "创建目标"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "创建目标"}));
  await screen.findAllByRole("button", {name: "暂停目标"});
  await waitFor(() => expect(screen.getAllByText("验证交互目标", {exact:true}).length).toBeGreaterThanOrEqual(3));
  fireEvent.click(screen.getAllByRole("button", {name: "暂停目标"})[0]!);
  await screen.findAllByRole("button", {name: "恢复目标"});
  expect((await client.chat.getGoal("demo")).goal?.phase).toBe(AgentGoalPhase.Paused);
  fireEvent.click(screen.getAllByRole("button", {name: "恢复目标"})[0]!);
  await screen.findAllByRole("button", {name: "暂停目标"});
  fireEvent.click(screen.getAllByRole("button", {name: "编辑目标"})[0]!);
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("目标内容"), {target:{value:"编辑后的目标"}});
  fireEvent.click(within(dialog).getByRole("button", {name:"保存"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await client.chat.getGoal("demo")).goal?.objective).toBe("编辑后的目标");
  fireEvent.click(screen.getByRole("button", {name:"清除目标"}));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", {name:"清除"}));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect((await client.chat.getGoal("demo")).goal).toBeNull();
  expect((await client.chat.getGoalHistory("demo")).items[0]?.recordState).toBe(AgentGoalRecordState.Cleared);
  view.unmount(); 
});

it("目标创建使用身份作用域信号，切换身份后旧信号中止", async () => {
  const client = createDemoClient();
  const submit = vi.spyOn(client.chat, "continueChat");
  const view = render(<AgentProvider client={client} identityKey="before"><AgentGoalDemo initialConversationId="demo" simulated/></AgentProvider>);
  fireEvent.change(screen.getByLabelText("目标正文"), {target: {value: "身份隔离目标"}});
  await waitFor(() => expect((screen.getByRole("button", {name: "创建目标"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "创建目标"}));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  const signal = submit.mock.calls[0]?.[2]?.signal;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal?.aborted).toBe(false);
  view.rerender(<AgentProvider client={client} identityKey="after"><AgentGoalDemo initialConversationId="demo" simulated/></AgentProvider>);
  await waitFor(() => expect(signal?.aborted).toBe(true));
  view.unmount();
});
