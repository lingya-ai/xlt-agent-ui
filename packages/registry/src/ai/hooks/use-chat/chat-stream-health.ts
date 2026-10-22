export type ChatStreamHealthStatus =
  | "unknown"
  | "healthy"
  | "suspected"
  | "buffered"
  | "unavailable"
  | "inconclusive";

export type ChatStreamHealthReason =
  | "no-response-headers"
  | "no-first-chunk"
  | "no-transport-ready"
  | "transport-gap"
  | "burst-after-stall"
  | "probe-buffered"
  | "probe-timeout"
  | "probe-error"
  | "probe-partial"
  | "probe-schedule"
  | "page-hidden"
  | "main-thread-stall"
  | "offline";

export type ChatStreamProbeFrame = {
  sequence: number;
  serverElapsedMs: number;
  clientReceivedAt: number;
};

export type ChatStreamProbeResult = {
  classification: "healthy" | "buffered" | "unavailable" | "inconclusive";
  reason?: ChatStreamHealthReason;
  serverSpanMs?: number;
  clientSpanMs?: number;
  maxClientGapMs?: number;
  maxEventLoopDriftMs: number;
  frameCount: number;
};

export type ChatStreamHealthState = {
  status: ChatStreamHealthStatus;
  reason?: ChatStreamHealthReason;
  requestId?: string;
  detectedAt?: number;
  isProbing: boolean;
  probeResult?: ChatStreamProbeResult;
};

export type ClassifyChatStreamProbeInput = {
  frames: ChatStreamProbeFrame[];
  remainedVisible: boolean;
  remainedOnline: boolean;
  maxEventLoopDriftMs: number;
};

const EXPECTED_SEQUENCES = [0, 1, 2, 3] as const;
const MIN_SERVER_SPAN_MS = 2_500;
const MAX_SERVER_SPAN_MS = 5_000;
const BUFFERED_CLIENT_SPAN_MS = 500;
const HEALTHY_CLIENT_SPAN_MS = 1_800;
const HEALTHY_MIN_CLIENT_GAP_MS = 300;
const HEALTHY_MAX_CLIENT_GAP_MS = 1_700;
const MAX_EVENT_LOOP_DRIFT_MS = 1_000;

/**
 * 根据服务端产生节奏和浏览器接收节奏判断同链路 SSE 探测结果。
 *
 * 只有完整、前台、主线程未明显卡顿且服务端按预期分时产生的四帧，才允许给出 buffered 结论。
 */
export function classifyChatStreamProbe(input: ClassifyChatStreamProbeInput): ChatStreamProbeResult {
  const {frames, remainedVisible, remainedOnline, maxEventLoopDriftMs} = input;
  const base = {frameCount: frames.length, maxEventLoopDriftMs};

  if (!remainedOnline) {
    return {...base, classification: "inconclusive", reason: "offline"};
  }
  if (!remainedVisible) {
    return {...base, classification: "inconclusive", reason: "page-hidden"};
  }
  if (maxEventLoopDriftMs > MAX_EVENT_LOOP_DRIFT_MS) {
    return {...base, classification: "inconclusive", reason: "main-thread-stall"};
  }
  if (
    frames.length !== EXPECTED_SEQUENCES.length ||
    frames.some((frame, index) => frame.sequence !== EXPECTED_SEQUENCES[index]) ||
    frames.some((frame, index) => index > 0 && frame.serverElapsedMs <= (frames[index - 1]?.serverElapsedMs ?? -1))
  ) {
    return {...base, classification: "inconclusive", reason: "probe-partial"};
  }

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  if (!firstFrame || !lastFrame) {
    return {...base, classification: "inconclusive", reason: "probe-partial"};
  }

  const serverSpanMs = lastFrame.serverElapsedMs - firstFrame.serverElapsedMs;
  const clientSpanMs = lastFrame.clientReceivedAt - firstFrame.clientReceivedAt;
  const clientGaps = frames.slice(1).map((frame, index) => frame.clientReceivedAt - (frames[index]?.clientReceivedAt ?? 0));
  const maxClientGapMs = Math.max(...clientGaps);
  const metrics = {...base, serverSpanMs, clientSpanMs, maxClientGapMs};

  if (serverSpanMs < MIN_SERVER_SPAN_MS || serverSpanMs > MAX_SERVER_SPAN_MS) {
    return {...metrics, classification: "inconclusive", reason: "probe-schedule"};
  }
  if (clientSpanMs <= BUFFERED_CLIENT_SPAN_MS) {
    return {...metrics, classification: "buffered", reason: "probe-buffered"};
  }

  const healthyGapCount = clientGaps.filter((gap) => gap >= HEALTHY_MIN_CLIENT_GAP_MS).length;
  if (
    clientSpanMs >= HEALTHY_CLIENT_SPAN_MS &&
    healthyGapCount >= 2 &&
    maxClientGapMs <= HEALTHY_MAX_CLIENT_GAP_MS
  ) {
    return {...metrics, classification: "healthy"};
  }

  return {...metrics, classification: "inconclusive", reason: "probe-partial"};
}
