"use client";

import {useCallback, useEffect, useRef, useState} from "react";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError, type ConnectionEvent} from "@lingya-ai/agents-sdk/browser";
import {CHAT_STREAM_HEALTH_EVENT_NAME as HEALTH_EVENT_NAME} from "../../../integration/events";

import {
  classifyChatStreamProbe,
  type ChatStreamHealthReason,
  type ChatStreamHealthState,
  type ChatStreamHealthStatus,
  type ChatStreamProbeFrame,
  type ChatStreamProbeResult,
} from "./chat-stream-health";


const PROBE_COOLDOWN_MS = 60_000;
const PROBE_TOTAL_TIMEOUT_MS = 8_000;
const DRIFT_INTERVAL_MS = 250;
export type ChatStreamDiagnosticContext = {
  conversationId: string;
  messageId: string;
  streamAttempt: number;
  replaying: boolean;
};

const INITIAL_HEALTH_STATE: ChatStreamHealthState = {
  status: "unknown",
  isProbing: false,
};

function createProbeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `probe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dispatchHealthTelemetry(
  state: ChatStreamHealthState,
  context?: ChatStreamDiagnosticContext,
): void {
  window.dispatchEvent(new CustomEvent(HEALTH_EVENT_NAME, {
    detail: {source: "chat", state, context},
  }));
}

/** 管理聊天 SSE 被动诊断、同链路主动探测和用户提示状态。 */
export function useChatStreamHealth(httpClient: AgentsClient, enabled = true) {
  const [streamHealth, setStreamHealth] = useState<ChatStreamHealthState>(INITIAL_HEALTH_STATE);
  const [isOnline, setIsOnline] = useState(true);
  const stateRef = useRef(streamHealth);
  const probeControllerRef = useRef<AbortController | null>(null);
  const probePromiseRef = useRef<Promise<void> | null>(null);
  const lastProbeCompletedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const automaticProbeRef = useRef<() => void>(() => undefined);
  const latestContextRef = useRef<ChatStreamDiagnosticContext | undefined>(undefined);

  const updateHealth = useCallback((
    status: ChatStreamHealthStatus,
    reason?: ChatStreamHealthReason,
    options?: {
      requestId?: string;
      probeResult?: ChatStreamProbeResult;
      isProbing?: boolean;
      context?: ChatStreamDiagnosticContext;
    },
  ) => {
    const currentState = stateRef.current;
    const requestId = options?.requestId ?? currentState.requestId;
    const isProbing = options?.isProbing ?? currentState.isProbing;
    const probeResult = options?.probeResult ?? currentState.probeResult;
    if (
      currentState.status === status &&
      currentState.reason === reason &&
      currentState.requestId === requestId &&
      currentState.isProbing === isProbing &&
      currentState.probeResult === probeResult
    ) {
      return;
    }

    const nextState: ChatStreamHealthState = {
      ...currentState,
      status,
      reason,
      requestId,
      detectedAt: Date.now(),
      isProbing,
      probeResult,
    };
    stateRef.current = nextState;
    if (mountedRef.current) setStreamHealth(nextState);
    dispatchHealthTelemetry(nextState, options?.context ?? latestContextRef.current);
  }, []);

  const completeProbe = useCallback((
    status: "healthy" | "buffered" | "unavailable" | "inconclusive",
    reason?: ChatStreamHealthReason,
    options?: {
      requestId?: string;
      probeResult?: ChatStreamProbeResult;
      context?: ChatStreamDiagnosticContext;
    },
  ) => {
    const currentState = stateRef.current;
    if (currentState.status === "buffered" && status !== "healthy" && status !== "buffered") {
      updateHealth("buffered", currentState.reason ?? "probe-buffered", {
        ...options,
        probeResult: currentState.probeResult,
        isProbing: false,
      });
      return;
    }

    updateHealth(status, reason, {...options, isProbing: false});
  }, [updateHealth]);

  const executeProbe = useCallback(async (force: boolean): Promise<void> => {
    if (!enabled) return;
    if (probePromiseRef.current) return probePromiseRef.current;
    if (!force && Date.now() - lastProbeCompletedAtRef.current < PROBE_COOLDOWN_MS) return;

    const run = (async () => {
      if (document.visibilityState !== "visible") {
        completeProbe("inconclusive", "page-hidden");
        return;
      }
      if (!navigator.onLine) {
        completeProbe("inconclusive", "offline");
        return;
      }

      const frames: ChatStreamProbeFrame[] = [];
      let remainedVisible = true;
      let remainedOnline = true;
      let maxEventLoopDriftMs = 0;
      let probeRequestId: string | undefined;
      let probeFailureReason: ChatStreamHealthReason | undefined;
      let probeUnsupported = false;
      let expectedTickAt = performance.now() + DRIFT_INTERVAL_MS;

      const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") remainedVisible = false;
      };
      const handleOffline = () => {
        remainedOnline = false;
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("offline", handleOffline);
      const driftTimer = window.setInterval(() => {
        const now = performance.now();
        maxEventLoopDriftMs = Math.max(maxEventLoopDriftMs, Math.max(0, now - expectedTickAt));
        expectedTickAt = now + DRIFT_INTERVAL_MS;
      }, DRIFT_INTERVAL_MS);

      updateHealth(stateRef.current.status, stateRef.current.reason, {
        isProbing: true,
        context: latestContextRef.current,
      });

      try {
        const probeId = createProbeId();
        const controller = new AbortController();
        probeControllerRef.current = controller;
        try {
          for await (const event of httpClient.chat.probeEventStream({probeId}, {
            signal: controller.signal, timeoutMs: PROBE_TOTAL_TIMEOUT_MS, idleTimeoutMs: 3_000,
            onConnectionEvent: event => { probeRequestId = event.requestId ?? probeRequestId; },
          })) {
            if (event.probeId === probeId) frames.push({sequence: event.sequence, serverElapsedMs: event.serverElapsedMs, clientReceivedAt: performance.now()});
          }
        } catch (error) {
          probeUnsupported = error instanceof ApiError && error.status === 404;
          probeFailureReason = error instanceof ApiError && error.kind === "timeout" ? "probe-timeout" : "probe-error";
          throw error;
        }
        if (!mountedRef.current) return;

        const result = classifyChatStreamProbe({
          frames,
          remainedVisible,
          remainedOnline,
          maxEventLoopDriftMs,
        });
        completeProbe(result.classification, result.reason, {
          requestId: probeRequestId,
          probeResult: result,
          context: latestContextRef.current,
        });
      } catch {
        if (!mountedRef.current) return;
        if (!remainedVisible) {
          completeProbe("inconclusive", "page-hidden", {
            requestId: probeRequestId,
            context: latestContextRef.current,
          });
        } else if (!remainedOnline) {
          completeProbe("inconclusive", "offline", {
            requestId: probeRequestId,
            context: latestContextRef.current,
          });
        } else if (probeUnsupported) {
          completeProbe("inconclusive", "probe-error", {
            requestId: probeRequestId,
            context: latestContextRef.current,
          });
        } else {
          completeProbe("unavailable", probeFailureReason ?? "probe-error", {
            requestId: probeRequestId,
            context: latestContextRef.current,
          });
        }
      } finally {
        window.clearInterval(driftTimer);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("offline", handleOffline);
        probeControllerRef.current = null;
        lastProbeCompletedAtRef.current = Date.now();
      }
    })();

    probePromiseRef.current = run.finally(() => {
      probePromiseRef.current = null;
    });
    return probePromiseRef.current;
  }, [completeProbe, enabled, httpClient, updateHealth]);

  const runStreamProbe = useCallback(() => executeProbe(true), [executeProbe]);

  useEffect(() => {
    automaticProbeRef.current = () => {
      void executeProbe(false);
    };
  }, [executeProbe]);

  const handleDiagnostic = useCallback((
    diagnostic: ConnectionEvent,
    context: ChatStreamDiagnosticContext,
  ) => {
    if (!enabled) return;
    latestContextRef.current = context;
    if (diagnostic.type === "ready" || diagnostic.type === "heartbeat") {
      if (stateRef.current.status !== "buffered" && !stateRef.current.isProbing)
        updateHealth("healthy", undefined, {requestId: diagnostic.requestId, context});
    } else if (diagnostic.type === "closed" && diagnostic.reason === "error") {
      updateHealth("suspected", "transport-gap", {requestId: diagnostic.requestId, context});
      if (document.visibilityState === "visible" && navigator.onLine) automaticProbeRef.current();
    }
  }, [enabled, updateHealth]);

  useEffect(() => {
    if (enabled) return;
    probeControllerRef.current?.abort();
    probeControllerRef.current = null;
    latestContextRef.current = undefined;
    stateRef.current = INITIAL_HEALTH_STATE;
    setStreamHealth(INITIAL_HEALTH_STATE);
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      setIsOnline(true);
      if (enabled && document.visibilityState === "visible") automaticProbeRef.current();
    };
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      probeControllerRef.current?.abort();
      probeControllerRef.current = null;
    };
  }, [enabled]);

  return {
    streamHealth,
    isOnline,
    handleDiagnostic,
    runStreamProbe,
  };
}
