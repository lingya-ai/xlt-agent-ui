import {describe, expect, it} from "vitest";

import {classifyChatStreamProbe} from "./chat-stream-health";

const serverFrames = [0, 1, 2, 3].map((sequence) => ({
  sequence,
  serverElapsedMs: sequence * 1_000,
  clientReceivedAt: sequence * 1_000,
}));

describe("classifyChatStreamProbe", () => {
  it("将服务端和客户端相近的分时节奏判定为 healthy", () => {
    expect(classifyChatStreamProbe({
      frames: serverFrames,
      remainedVisible: true,
      remainedOnline: true,
      maxEventLoopDriftMs: 20,
    }).classification).toBe("healthy");
  });

  it("将服务端分时产生但客户端集中收到判定为 buffered", () => {
    const frames = serverFrames.map((frame, index) => ({...frame, clientReceivedAt: 10_000 + index * 100}));
    const result = classifyChatStreamProbe({
      frames,
      remainedVisible: true,
      remainedOnline: true,
      maxEventLoopDriftMs: 20,
    });

    expect(result.classification).toBe("buffered");
    expect(result.serverSpanMs).toBe(3_000);
    expect(result.clientSpanMs).toBe(300);
  });

  it.each([
    {remainedVisible: false, remainedOnline: true, maxEventLoopDriftMs: 20, reason: "page-hidden"},
    {remainedVisible: true, remainedOnline: false, maxEventLoopDriftMs: 20, reason: "offline"},
    {remainedVisible: true, remainedOnline: true, maxEventLoopDriftMs: 1_200, reason: "main-thread-stall"},
  ])("在浏览器环境证据不可靠时返回 inconclusive: $reason", (input) => {
    const result = classifyChatStreamProbe({frames: serverFrames, ...input});
    expect(result).toMatchObject({classification: "inconclusive", reason: input.reason});
  });

  it("在帧缺失、重复或乱序时返回 inconclusive", () => {
    for (const frames of [
      serverFrames.slice(0, 3),
      [serverFrames[0]!, serverFrames[1]!, serverFrames[1]!, serverFrames[3]!],
      [serverFrames[0]!, serverFrames[2]!, serverFrames[1]!, serverFrames[3]!],
    ]) {
      expect(classifyChatStreamProbe({
        frames,
        remainedVisible: true,
        remainedOnline: true,
        maxEventLoopDriftMs: 20,
      })).toMatchObject({classification: "inconclusive", reason: "probe-partial"});
    }
  });

  it("在服务端自身未按约三秒产生事件时不归因网络", () => {
    const frames = serverFrames.map((frame) => ({...frame, serverElapsedMs: frame.sequence * 100}));
    expect(classifyChatStreamProbe({
      frames,
      remainedVisible: true,
      remainedOnline: true,
      maxEventLoopDriftMs: 20,
    })).toMatchObject({classification: "inconclusive", reason: "probe-schedule"});
  });
});
