"use client";

import {useCallback} from "react";
import {type FieldValues, type UseFormReturn,} from "react-hook-form";
import {useApiRequest, type UseApiRequestOptions, type UseApiRequestResult,} from "./use-api-request";
import type {Service} from "./use-request/types";
import {useFormFieldErrorSpecification} from "./use-form-field-error-specification";

export type UseFormApiRequestOptions<
  TData,
  TParams extends unknown[],
  TFieldValues extends FieldValues = FieldValues,
> = Omit<UseApiRequestOptions<TData, TParams>, "manual" | "disableErrorNotification"> & {
  /** 表单实例，422 错误将回填到对应字段 */
  form: UseFormReturn<TFieldValues>;
  /**
   * 是否对非 422 错误弹出警告提示，默认 true。
   * - 422 字段错误始终回填到表单，不受此选项控制
   * - 其他 HTTP 错误 / 非业务异常受此选项控制
   */
  noticeError?: boolean | null;
};

export type UseFormApiRequestResult<
  TData,
  TParams extends unknown[],
> = UseApiRequestResult<TData, TParams>;

/**
 * 表单专用 API 请求 Hook。
 *
 * 在 {@link useApiRequest} 基础上强制：
 * - `manual: true`：表单必须显式触发提交
 * - `disableErrorNotification: true`：关闭默认错误 toast，改由字段错误规范接管
 *
 * 错误处理流程（通过 `useFormFieldErrorSpecification` 实现）：
 * - HTTP 422：解析响应体 `fields`，逐字段回填到 `form`
 * - 其他错误：通过全局 notifier 弹 warning（受 `noticeError` 控制）
 * - 任何错误都会 `throw`，`runAsync` 的调用方需要 try/catch
 *
 * `run` 不会抛出（与 ahooks 一致），错误已在内部消化；`runAsync` 会抛出供 await 链处理。
 *
 * @param service 请求函数
 * @param options
 * @param options.form 表单实例（必填）
 * @param options.noticeError 是否弹出非字段错误的警告，默认 true
 *
 * @example
 * ```tsx
 * const form = useForm<FormValues>({resolver: zodResolver(schema)});
 * const {runAsync, loading} = useFormApiRequest(createUser, {form});
 *
 * const onSubmit = form.handleSubmit(async (values) => {
 *   try {
 *     await runAsync(values);
 *   } catch {
 *     // 字段错误已回填表单，其他错误已弹 warning
 *   }
 * });
 * ```
 */
export function useFormApiRequest<
  TData,
  TParams extends unknown[],
  TFieldValues extends FieldValues = FieldValues,
>(
  service: Service<TData, TParams>,
  options: UseFormApiRequestOptions<TData, TParams, TFieldValues>,
): UseFormApiRequestResult<TData, TParams> {
  const {form, noticeError, ...rest} = options;

  const {runAsync, ...restReturn} = useApiRequest(service, {
    ...rest,
    manual: true,
    disableErrorNotification: true,
  });

  const specify = useFormFieldErrorSpecification(form, {noticeError});

  const runAsyncSpecify = useCallback(
    async (...params: TParams): Promise<TData> => {
      return await specify(() => runAsync(...params));
    },
    [runAsync, specify],
  );

  const runSpecify = useCallback(
    (...params: TParams): void => {
      void specify(() => runAsync(...params));
    },
    [runAsync, specify],
  );

  return {
    ...restReturn,
    run: runSpecify,
    runAsync: runAsyncSpecify,
  };
}

export default useFormApiRequest;
