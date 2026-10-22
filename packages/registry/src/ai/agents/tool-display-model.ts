import {AiChatEventTypeEnum, isKnownToolExtensionInfo, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import type { ToolPresentation } from "./tool-presentation-projection";

/** 只描述展示语义，不在事件或派生状态中生成文案。 */
export enum ToolDisplayLabelKind {
  Business = "business",
  ActionStatus = "action-status",
}

export interface ToolDisplayModel {
  action: string;
  state: string;
  labelKind: ToolDisplayLabelKind;
  businessTitle?: string;
  /** 真实业务摘要才可作为通用输出；本地化标题绝不写入此字段。 */
  output?: string;
  errorText?: string;
  failureKind?: ToolCallStatusEnum;
  unsupportedPreview: boolean;
}

/** 将现有派生视图投影为无语言依赖的展示模型，不读取原始参数或 result。 */
export function buildToolDisplayModel(
  tool: ToolPresentation,
): ToolDisplayModel {
  const { derived } = tool;
  const failureKind = getToolFailureKind(derived.state);
  const candidates = failureKind
    ? [derived.errorMessage, derived.summary, derived.responseData]
    : [
        derived.sqlResultSummary,
        derived.summary,
        derived.responseData,
        derived.errorMessage,
      ];
  const businessTitle = candidates.map((value) => value?.trim()).find(Boolean);
  return {
    action: derived.action,
    state: derived.state,
    labelKind: businessTitle
      ? ToolDisplayLabelKind.Business
      : ToolDisplayLabelKind.ActionStatus,
    businessTitle,
    output: derived.responseData?.trim() ? derived.responseData : undefined,
    errorText: derived.errorMessage?.trim() || undefined,
    failureKind,
    unsupportedPreview: tool.events.some(
      (event) =>
        !("rawJson" in event) && event.type === AiChatEventTypeEnum.ToolExecution &&
        event.extension?.specialRender === true &&
        !isKnownToolExtensionInfo(event.extension),
    ),
  };
}

/** 无业务错误摘要的失败终态仍需显示对应的本地化说明。 */
function getToolFailureKind(
  state: string,
): ToolCallStatusEnum | undefined {
  switch (state) {
    case ToolCallStatusEnum.Error:
    case ToolCallStatusEnum.Timeout:
    case ToolCallStatusEnum.Blocked:
    case ToolCallStatusEnum.ApprovalDenied:
    case ToolCallStatusEnum.Interrupted:
      return state;
    default:
      return undefined;
  }
}
