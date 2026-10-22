"use client";

import type { ApiError } from "@lingya-ai/agents-sdk/browser";
import {getResourceLimitMessage} from "../utils/business-error";
import {
  type Service,
  useRequest,
} from "./use-request/index";
import type {
  Options as RequestOptions,
  Result as UseRequestReturnType,
} from "./use-request/types";

/**
 * 通知器接口
 *
 * 由消费方（如 apps/studio）在启动时通过 `setApiNotifier` 注入，
 * 让数据层在错误/成功时回调 UI 提示，而不直接依赖任何 UI 库。
 */
export interface ApiNotifier {
  /** 错误提示，参数为错误消息字符串 */
  error?: (message: string) => void;
  /** 警告提示，参数为警告消息字符串（用于表单等需要区别于硬错误的场景） */
  warning?: (message: string) => void;
  /** 成功提示，参数为成功消息字符串 */
  success?: (message: string) => void;
}

const defaultErrorMessage = "请求失败，请稍后重试";
const defaultSuccessMessage = "操作成功";

let currentNotifier: ApiNotifier = {};

/**
 * 注入全局通知器（通常在应用启动时调用一次）。
 *
 * @example
 * ```ts
 * import { toast } from "sonner";
 * import { setApiNotifier } from "./use-api-request";
 *
 * setApiNotifier({
 *   error: (msg) => toast.error(msg),
 *   warning: (msg) => toast.warning(msg),
 *   success: (msg) => toast.success(msg),
 * });
 * ```
 */
export function setApiNotifier(notifier: ApiNotifier): void {
  currentNotifier = notifier;
}

/**
 * 获取当前已注入的通知器（主要用于测试）。
 */
export function getApiNotifier(): ApiNotifier {
  return currentNotifier;
}

function notifyError(message: string): void {
  const fn = currentNotifier.error;
  if (fn) {
    fn(message);
    return;
  }
  // 未注入时降级到 console，避免静默失败
  console.error(`[api error] ${message}`);
}

function notifyWarning(message: string): void {
  const fn = currentNotifier.warning;
  if (fn) {
    fn(message);
    return;
  }
  console.warn(`[api warning] ${message}`);
}

function notifySuccess(message: string): void {
  const fn = currentNotifier.success;
  if (fn) {
    fn(message);
    return;
  }
  console.info(`[api success] ${message}`);
}

export {notifyError, notifyWarning, notifySuccess};

export interface UseApiRequestOptions<TData, TParams extends unknown[]>
  extends RequestOptions<TData, TParams> {
  /** 关闭错误时的自动通知（默认 false，即默认开启通知） */
  disableErrorNotification?: boolean;
  /** 开启成功时的自动通知（默认 false） */
  enableSuccessNotification?: boolean;
  /** 自定义成功通知文案 */
  successMessage?: string;
  /** 自定义错误消息提取逻辑 */
  getErrorMessage?: (error: ApiError) => string;
}

export type UseApiRequestResult<
  TData,
  TParams extends unknown[],
> = UseRequestReturnType<TData, TParams>;

/**
 * 在 `useRequest` 基础上封装的错误/成功通知增强 hook。
 *
 * 与 `useRequest` 完全兼容，额外支持：
 * - 错误时自动调用注入的通知器（可通过 `disableErrorNotification` 关闭）
 * - 成功时按需调用注入的通知器（通过 `enableSuccessNotification` 开启）
 *
 * 通知策略由 `setApiNotifier` 决定，本 hook 不直接依赖任何 UI 库。
 */
function useApiRequest<TData, TParams extends unknown[]>(
  service: Service<TData, TParams>,
  options?: UseApiRequestOptions<TData, TParams>,
): UseApiRequestResult<TData, TParams> {
  const {
    disableErrorNotification = false,
    enableSuccessNotification = false,
    successMessage,
    getErrorMessage,
    onError: originalOnError,
    onSuccess: originalOnSuccess,
    ...restOptions
  } = options || {};

  return useRequest<TData, TParams>(service, {
    ...restOptions,
    onError: (error: ApiError, params: TParams) => {
      console.error(error);
      try {
        originalOnError?.(error, params);
      } catch (callbackError) {
        console.error(callbackError);
      }

      // 401 由应用级 onUnauthorized 统一处理，避免与重新登录界面重复提示。
      if (!disableErrorNotification && error.status !== 401) {
        const safeError = error;
        const message =
          getResourceLimitMessage(safeError) ||
          getErrorMessage?.(safeError as ApiError) ||
          safeError.message ||
          defaultErrorMessage;
        notifyError(message);
      }
    },
    onSuccess: (data: TData, params: TParams) => {
      originalOnSuccess?.(data, params);

      if (enableSuccessNotification) {
        notifySuccess(successMessage || defaultSuccessMessage);
      }
    },
  });
}

export { useApiRequest };
