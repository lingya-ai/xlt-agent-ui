"use client";

import {useCallback} from "react";
import {
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import {fieldsRespMsgSchema} from "../schemas/common";
import {notifyWarning} from "./use-api-request";

export type SpecificationService<T> = () => Promise<T>;

export type FieldErrorSpecificationCallback = <T>(
  service: SpecificationService<T>,
) => Promise<T>;

export type UseFormFieldErrorSpecificationOptions = {
  /** 是否对非 422 错误弹出警告提示，默认 true */
  noticeError?: boolean | null;
};

/**
 * 表单提交字段错误规范 Hook。
 *
 * 包装一个异步 service，捕获异常后：
 * - HTTP 422：读取 SDK `ApiError.fields`，逐字段调用 `form.setError` 回填到表单
 * - HTTP 401：交给应用级 `onUnauthorized` 统一处理，不重复弹出 warning
 * - 其他 HTTP 错误：通过全局通知器以 warning 形式提示（受 `noticeError` 控制）
 * - 非业务异常：统一警告提示（受 `noticeError` 控制）
 *
 * 无论是否提示，最终都会 `throw` 异常，由调用方决定后续处理。
 *
 * @param form react-hook-form 表单实例
 * @param options
 * @param options.noticeError 是否对非字段级错误弹出警告，默认 true；传 null 等同于 true
 *
 * @example
 * ```tsx
 * const specify = useFormFieldErrorSpecification(form);
 * const handleSubmit = async (values) => {
 *   try {
 *     await specify(() => createUser(values));
 *   } catch {
 *     // 错误已由 hook 处理（回填字段或弹 warning）
 *   }
 * };
 * ```
 */
export function useFormFieldErrorSpecification<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  options?: UseFormFieldErrorSpecificationOptions,
): FieldErrorSpecificationCallback {
  const noticeRaw = options?.noticeError;
  const notice = noticeRaw === null || noticeRaw === undefined ? true : noticeRaw;
  const {setError} = form;

  return useCallback(
    async <T,>(service: SpecificationService<T>): Promise<T> => {
      try {
        return await service();
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 422) {
            const visited = new Set<string>();
            for (const field of error.fields ?? []) {
              if (visited.has(field.field)) continue;
              visited.add(field.field);
              setError(field.field as FieldPath<TFieldValues>, {type: 'server', message: field.message});
            }
          } else if (error.status !== 401 && notice) {
            notifyWarning(error.message || "请求失败，请稍后重试");
          }
        } else if (notice) {
          const message = error instanceof Error ? error.message : "";
          const detail = message.trim() === "" ? "未知异常！" : `未知异常：${message}`;
          notifyWarning(detail);
        }

        throw error;
      }
    },
    [setError, notice],
  );
}

export default useFormFieldErrorSpecification;
