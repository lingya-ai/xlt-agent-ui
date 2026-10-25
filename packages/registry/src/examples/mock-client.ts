import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {createMockGoals} from "./mock-goals";

const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), {...init, headers: {"Content-Type": "application/json", ...init?.headers}});
const time = "2026-10-20T08:00:00Z";
const page = (records: unknown[]) => ({records, page: {total: records.length, current: 0, size: 30}});
const usage={inputTokens:40,outputTokens:80,totalTokens:120};
const conversation = {conversationType:"CHAT",usage,conversationId: "demo", title: "源码分发接入示例", titleState: "AUTO", status: "ACTIVE",
  messageCount: 1, totalTokens: 120, totalInputTokens: 40, totalOutputTokens: 80, createdTime: time, lastUpdateTime: time,
  groupId: null, groupName: null};
const message = (id: string, query: string) => ({messageId: id, userMessage: {text: query,type:"USER",metadata:{},executionType:"USER_MESSAGE",attachments:[]},executionType:"USER_MESSAGE",usage,status: "COMPLETED",
  inputTokens: 40, outputTokens: 80, totalTokens: 120, executionTimeMillis: 800, processingSteps: 1, totalToolCalls: 0,
  createdTime: time, lastUpdateTime: time});
const reply = "这是使用真实组件与本地模拟传输的演示。\n\n组件源码安装到你的项目中，认证、主题与部署由你控制。\n\n- 短期令牌由服务端签发\n- SDK 负责解析 SSE 事件\n- 消息、工具和工作区可以独立组合";
function events(id: string, text = reply) {
  return [
    {type: "start"},
    {type: "message", message: text},
    {type: "end", executionTimeMillis: 800, processingSteps: 1, totalToolCalls: 0, artifacts:[],nonFileArtifacts:[],totalUsage: usage},
  ].map(event => ({...event, conversationId: "demo", messageId: id}));
}

/** 默认演示仅在内存运行，不访问真实渠道；未知接口明确报错。 */
export function createDemoClient() {
  const goals = createMockGoals();
  const messages = [message("history-1", "如何把 Agent 界面嵌入自己的产品？")];
  const contents = new Map<string, string>();
  let counter = 0;
  const mockFetch: typeof fetch = async (input, init) => {
    if (input instanceof Request) {init = {method: input.method, headers: input.headers, signal: input.signal, body: ["GET", "HEAD"].includes(input.method) ? undefined : await input.text()};}
    if (init?.signal?.aborted) throw new DOMException("已取消", "AbortError");
    const url = new URL(input instanceof Request ? input.url : String(input));
    const route = url.pathname.replace(/^.*\/chat/, "");
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const goalResponse = goals.handle(url, init?.method ?? "GET", body);
    if (goalResponse) return goalResponse;
    let result: unknown;
    if (route === "/config") result = {modelConfig: {defaultModel: {keyGroupId: 1, model: "demo"}, modelKeyGroups: [
      {keyGroupId: 1, keyGroupName: "模拟服务", models: [{maker: "local", modelName: "demo", modelLabel: "本地模拟",
        modelDescription: "不连接外部服务", maxContextTokens: 32000, maxOutputTokens: 4096, supportImage: false,
        supportVideo: false, thinkingMode: false}]}]}, supportAttachmentExt: [], maxAttachmentCount: 0,
      goal: {supported: true, continuationEnabled: true}};
    else if ((route === "" || /^\/conversations\/[^/]+$/.test(route)) && init?.method === "POST") {
      if (data.goalMode === true && data.planMode === true) return json({code:"ai.chat.mode_conflict",message:"计划模式与目标模式不能同时开启"},{status:400});
      if (data.goalMode === true) {
        const failure = goals.create(route ? decodeURIComponent(route.split("/").at(-1)!) : "demo", data.query);
        if (failure) return failure;
      }
      const id = `message-${++counter}`;
      const query = typeof data.query === "string" ? data.query : "继续";
      contents.set(id, `你发送了：${query}\n\n${reply}`);
      messages.push(message(id, query));
      result = {conversationId: route ? decodeURIComponent(route.split("/").at(-1)!) : "demo", messageId: id, disposition: "STARTED", status: "PENDING"};
    } else if (route.endsWith("/stream")) {
      const id = typeof data.messageId === "string" ? data.messageId : `message-${counter}`;
      const chunks = events(id, contents.get(id)).map(event => `data: ${JSON.stringify(event)}\n\n`);
      let index = 0;
      const stream = new ReadableStream<Uint8Array>({async pull(controller) {
        await new Promise(resolve => setTimeout(resolve, 180));
        if (init?.signal?.aborted) { controller.error(new DOMException("已取消", "AbortError")); return; }
        const chunk = chunks[index++];
        if (chunk) controller.enqueue(new TextEncoder().encode(chunk)); else controller.close();
      }});
      return new Response(stream, {headers: {"Content-Type": "text/event-stream"}});
    } else if (route.endsWith("/events/batch")) {
      result = {records: messages.map(item => ({messageId: item.messageId, events: events(item.messageId, contents.get(item.messageId))})),skipped:[]};
    } else if (route.endsWith("/events")) {
      const id = route.split("/").at(-2) ?? "history-1"; result = {records: events(id, contents.get(id))};
    } else if (route === "/conversations") result = page([conversation]);
    else if (route === "/conversations/active" || route === "/conversations/unread") result = {conversationIds: []};
    else if (route === "/conversations/activity/query") result = {records: [{conversationId: "demo", executionStatus: "IDLE",
      activeMessageId: null, executionEpoch: null, executionStartedTime: null, latestTerminalMessageId: "history-1",
      latestTerminalTime: time, hasUnreadCompletion: false, requiresUserConfirmation: false}]};
    else if (route === "/conversation-groups") result = {records: []};
    else if (route.endsWith("/config")) result = {lastChatModelSpec: null, planMode: false};
    else if (route.endsWith("/workspace/files")) result = {fileArtifacts: page([{fileId: 1, relativePath: "guide.md", size: 128, fileName: "guide.md", mimeType: "text/markdown", lastUpdateTime: time}]), nonFileArtifacts: []};
    else if (route.endsWith("/preview")) result = {url: "data:text/markdown;charset=utf-8," + encodeURIComponent("# OpenAPI Agent UI\n\n这是工作区文件预览示例。\n\n安装源码后，可按需调整文件预览与下载交互。")};
    else if (route.endsWith("/async-tasks/sync")) result = {activeTasks: [], notificationMessages: [], nextMessageId: null, hasMore: false, pollingRequired: false};
    else if (route.endsWith("/subagents/sync")) result = {activeTasks: [], changedTasks: [], nextCursor: null, pollingRequired: false, hasUnreadTerminalResults: false};
    else if (route.endsWith("/messages/sync")) result = {messages: [], nextMessageId: messages.at(-1)?.messageId ?? null, hasMore: false};
    else if (route.endsWith("/async-tasks") || route.endsWith("/subagents")) result = page([]);
    else if (route.endsWith("/messages")) result = page([...messages].reverse());
    else if (/\/messages\/[^/]+$/.test(route)) result = messages.find(item => item.messageId === route.split("/").at(-1));
    else if (route.endsWith("/title")) result = {conversationId: "demo", title: conversation.title, titleState: "AUTO"};
    else if (route === "/conversations/demo") result = conversation;
    else return json({code: "not-found", message: `模拟器未实现：${route}`}, {status: 404});
    return json(result ?? null);
  };
  return new AgentsClient({baseUrl: "https://demo.invalid", channelId: "demo", fetch: mockFetch,
    auth: {type: "token", tokenProvider: async () => "local-demo"}});
}
