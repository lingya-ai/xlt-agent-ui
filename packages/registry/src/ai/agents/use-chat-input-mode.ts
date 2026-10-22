"use client";

import { useEffect, useRef, useState } from "react";

/** 下一条消息的输入模式；三种模式互斥，同一时刻只能是其中一个。 */
export enum ChatInputMode {
  NORMAL = "NORMAL",
  PLAN = "PLAN",
  GOAL = "GOAL",
}

/**
 * 统一管理普通、计划和目标三种输入模式。
 *
 * 模式属于未发送草稿：后台状态更新不能覆盖用户正在编辑的选择。计划模式可从服务端会话配置恢复，
 * 目标模式只存在于当前聊天内存中，因此提交成功后必须保持用户选择，切换或重启会话才回到普通模式。
 */
export function useChatInputMode(
  conversationId: string | undefined,
  serverPlanMode: boolean | undefined,
  hasDraft: boolean,
) {
  const [mode, setMode] = useState(
    serverPlanMode ? ChatInputMode.PLAN : ChatInputMode.NORMAL,
  );
  const dirty = useRef(false);
  const selectionRevision = useRef(0);
  const submittedRevision = selectionRevision.current;
  const previous = useRef({ conversationId, serverPlanMode });

  useEffect(() => {
    const old = previous.current;
    previous.current = { conversationId, serverPlanMode };
    if (old.conversationId !== conversationId) {
      // 首条消息接纳后分配 ID，保留刚提交的选择；真正切换或重启会话才重置。
      if (old.conversationId !== undefined || conversationId === undefined) {
        dirty.current = false;
        setMode(serverPlanMode ? ChatInputMode.PLAN : ChatInputMode.NORMAL);
      }
      return;
    }
    if (
      serverPlanMode !== undefined &&
      serverPlanMode !== old.serverPlanMode &&
      !dirty.current &&
      !hasDraft
    ) {
      setMode(serverPlanMode ? ChatInputMode.PLAN : ChatInputMode.NORMAL);
    }
  }, [conversationId, hasDraft, serverPlanMode]);

  return {
    mode,
    planMode: mode === ChatInputMode.PLAN,
    goalMode: mode === ChatInputMode.GOAL,
    selectMode: (nextMode: ChatInputMode) => {
      selectionRevision.current += 1;
      dirty.current = true;
      setMode(nextMode);
    },
    markSubmitted: () => {
      // 目标模式无法从服务端会话配置恢复，提交成功后必须保持用户选择；
      // 请求期间再次切换属于下一条草稿，同样不能被上一条提交清除。
      dirty.current =
        mode === ChatInputMode.GOAL ||
        selectionRevision.current !== submittedRevision;
    },
  };
}
