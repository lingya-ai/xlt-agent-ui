"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyConversationReplayStep,
  getConversationReplayDelay,
  projectConversationReplay,
  type ConversationReplaySource,
  type ReplaySpeed,
} from "./history-replay";
import type { ChatItem } from "./types";

export type ConversationReplayStatus =
  | "preparing"
  | "playing"
  | "paused"
  | "completed";

export type UseConversationHistoryReplayOptions = {
  source?: ConversationReplaySource;
  autoPlay?: boolean;
  defaultSpeed?: ReplaySpeed;
};

export type UseConversationHistoryReplayResult = {
  status: ConversationReplayStatus;
  visibleChatList: ChatItem[];
  currentStep: number;
  totalSteps: number;
  speed: ReplaySpeed;
  play: () => void;
  pause: () => void;
  restart: () => void;
  revealAll: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
};

/**
 * 驱动只读会话历史逐步回放。
 *
 * 任意时刻只保留一个定时器；暂停、倍速切换、重新开始和数据源切换都会使旧定时器失效。
 */
export function useConversationHistoryReplay({
  source,
  autoPlay = true,
  defaultSpeed = 1,
}: UseConversationHistoryReplayOptions): UseConversationHistoryReplayResult {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const generationRef = useRef(0);
  const [status, setStatus] = useState<ConversationReplayStatus>("preparing");
  const [visibleChatList, setVisibleChatList] = useState<ChatItem[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [speed, setSpeedState] = useState<ReplaySpeed>(defaultSpeed);
  const totalSteps = source?.steps.length ?? 0;

  const invalidateTimer = useCallback(() => {
    generationRef.current += 1;
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    invalidateTimer();
    setVisibleChatList([]);
    setCurrentStep(0);
    setSpeedState(defaultSpeed);

    if (!source) {
      setStatus("preparing");
    } else if (source.steps.length === 0) {
      setStatus("completed");
    } else {
      setStatus(autoPlay ? "playing" : "paused");
    }
  }, [autoPlay, defaultSpeed, invalidateTimer, source]);

  useEffect(() => {
    if (!source || status !== "playing") return;

    const step = source.steps[currentStep];
    if (!step) {
      setStatus("completed");
      return;
    }

    const generation = generationRef.current;
    timerRef.current = setTimeout(
      () => {
        if (generationRef.current !== generation) return;

        setVisibleChatList((chatList) =>
          applyConversationReplayStep(chatList, source, step),
        );
        setCurrentStep((stepIndex) => stepIndex + 1);
        timerRef.current = undefined;
      },
      getConversationReplayDelay(source, step, speed),
    );

    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [currentStep, source, speed, status]);

  useEffect(() => () => invalidateTimer(), [invalidateTimer]);

  const play = useCallback(() => {
    if (
      !source ||
      source.steps.length === 0 ||
      currentStep >= source.steps.length
    )
      return;
    setStatus("playing");
  }, [currentStep, source]);

  const pause = useCallback(() => {
    invalidateTimer();
    setStatus((currentStatus) =>
      currentStatus === "playing" ? "paused" : currentStatus,
    );
  }, [invalidateTimer]);

  const restart = useCallback(() => {
    if (!source) return;

    invalidateTimer();
    setVisibleChatList([]);
    setCurrentStep(0);
    setStatus(source.steps.length === 0 ? "completed" : "playing");
  }, [invalidateTimer, source]);

  const revealAll = useCallback(() => {
    if (!source) return;

    invalidateTimer();
    setVisibleChatList(projectConversationReplay(source));
    setCurrentStep(source.steps.length);
    setStatus("completed");
  }, [invalidateTimer, source]);

  const setSpeed = useCallback(
    (nextSpeed: ReplaySpeed) => {
      invalidateTimer();
      setSpeedState(nextSpeed);
    },
    [invalidateTimer],
  );

  return {
    status,
    visibleChatList,
    currentStep,
    totalSteps,
    speed,
    play,
    pause,
    restart,
    revealAll,
    setSpeed,
  };
}
