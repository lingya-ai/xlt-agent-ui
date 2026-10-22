import { describe, expect, it } from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
const client=(channelId="channel")=>new AgentsClient({baseUrl:"https://test.invalid",channelId,auth:{type:"token",tokenProvider:()=>"private-test-token"}});

import { buildChatClientCacheKey } from "./chat-client-cache-key";

describe("宿主聊天缓存实例隔离", () => {
  it("同服务同资源在两空间或两身份客户端下不共享缓存", () => {
    const original=client();
    const spaceA=client("a");
    const spaceB=client("b");
    const nextIdentity=client("a");
    const key = buildChatClientCacheKey(
      spaceA,
      "file-preview",
      "same-conversation",
      1,
    );
    expect(
      buildChatClientCacheKey(spaceA, "file-preview", "same-conversation", 1),
    ).toBe(key);
    expect(
      new Set([
        key,
        buildChatClientCacheKey(spaceB, "file-preview", "same-conversation", 1),
        buildChatClientCacheKey(
          nextIdentity,
          "file-preview",
          "same-conversation",
          1,
        ),
        buildChatClientCacheKey(
          original,
          "file-preview",
          "same-conversation",
          1,
        ),
      ]).size,
    ).toBe(4);
  });
  it("不同投影和文件不碰撞，凭据不进入键", () => {
    const sdkClient=client();
    const key = buildChatClientCacheKey(sdkClient, "file", "conversation-1", 1);
    expect(key).not.toContain("private-test");
    expect(key).not.toBe(
      buildChatClientCacheKey(sdkClient, "file", "conversation-1", 2),
    );
    expect(key).not.toBe(
      buildChatClientCacheKey(sdkClient, "config", "conversation-1", 1),
    );
  });
});
