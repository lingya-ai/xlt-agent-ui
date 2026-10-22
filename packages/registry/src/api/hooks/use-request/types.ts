"use client";

import type { DependencyList } from "react";
import type { ApiError } from "@lingya-ai/agents-sdk/browser";
import Fetch from "./Fetch";

/**
 * 服务函数类型
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export type Service<TData, TParams extends unknown[]> = (
  ...args: TParams
) => Promise<TData>;

/**
 * 订阅函数类型 - 触发重新渲染
 */
export type Subscribe = () => void;

/**
 * 超时类型
 */
export type Timeout = ReturnType<typeof setTimeout>;

/**
 * 请求状态接口
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export interface FetchState<TData, TParams extends unknown[]> {
  /** 是否正在加载 */
  loading: boolean;
  /** 请求参数 */
  params?: TParams;
  /** 返回数据 */
  data?: TData;
  /** 错误信息 */
  error?: ApiError;
}

/**
 * 缓存数据类型
 * @template TData 返回数据类型
 * @template TParams 参数类型
 */
export interface CachedData<TData, TParams> {
  /** 缓存数据 */
  data: TData;
  /** 请求参数 */
  params: TParams;
  /** 缓存时间戳 */
  time: number;
}

/**
 * 插件返回类型 - 定义生命周期钩子
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export interface PluginReturn<TData, TParams extends unknown[]> {
  /** 请求前钩子 */
  onBefore?: (params: TParams) =>
    | ({
        /** 是否立即停止请求 */
        stopNow?: boolean;
        /** 是否立即返回 */
        returnNow?: boolean;
      } & Partial<FetchState<TData, TParams>>)
    | void;

  /** 请求钩子 - 可自定义 servicePromise */
  onRequest?: (
    service: Service<TData, TParams>,
    params: TParams,
  ) => {
    servicePromise?: Promise<TData>;
  };

  /** 成功钩子 */
  onSuccess?: (data: TData, params: TParams) => void;
  /** 错误钩子 */
  onError?: (error: ApiError, params: TParams) => void;
  /** 最终钩子 - 无论成功或失败都会执行 */
  onFinally?: (params: TParams, data?: TData, error?: ApiError) => void;
  /** 取消钩子 */
  onCancel?: () => void;
  /** 变更钩子 - 手动修改数据时触发 */
  onMutate?: (data: TData | undefined) => void;
}

/**
 * 插件类型 - 工厂函数，创建插件钩子
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export type Plugin<TData, TParams extends unknown[]> = {
  (
    fetchInstance: Fetch<TData, TParams>,
    options: Options<TData, TParams>,
  ): PluginReturn<TData, TParams>;
  /** 插件初始化钩子 - 可设置初始状态 */
  onInit?: (
    options: Options<TData, TParams>,
  ) => Partial<FetchState<TData, TParams>>;
};

/**
 * useRequest 选项接口
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export interface Options<TData, TParams extends unknown[]> {
  /** 是否手动触发请求（默认 false，自动触发） */
  manual?: boolean;

  /** 请求前回调 */
  onBefore?: (params: TParams) => void;
  /** 成功回调 */
  onSuccess?: (data: TData, params: TParams) => void;
  /** 错误回调 */
  onError?: (error: ApiError, params: TParams) => void;
  /** 最终回调 - 无论成功或失败都会执行 */
  onFinally?: (params: TParams, data?: TData, error?: ApiError) => void;

  /** 默认参数 - 自动触发时使用 */
  defaultParams?: TParams;

  // refreshDeps - 依赖刷新
  /** 依赖项列表 - 变化时重新请求 */
  refreshDeps?: DependencyList;
  /** 自定义刷新动作 */
  refreshDepsAction?: () => void;

  // loading delay - 加载延迟
  /** 延迟显示 loading 时间（毫秒） */
  loadingDelay?: number;

  // polling - 轮询
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 页面隐藏时是否继续轮询 */
  pollingWhenHidden?: boolean;
  /** 轮询时静默加载（首次加载后，轮询刷新不显示 loading） */
  pollingSilentLoading?: boolean;

  // refresh on window focus - 窗口焦点刷新
  /** 窗口获得焦点时是否刷新 */
  refreshOnWindowFocus?: boolean;
  /** 刷新的时间间隔（毫秒） */
  focusTimespan?: number;

  // debounce - 防抖
  /** 防抖等待时间（毫秒） */
  debounceWait?: number;
  /** 是否在延迟开始前调用 */
  debounceLeading?: boolean;
  /** 是否在延迟结束后调用 */
  debounceTrailing?: boolean;
  /** 防抖最大等待时间（毫秒） */
  debounceMaxWait?: number;

  // throttle - 节流
  /** 节流等待时间（毫秒） */
  throttleWait?: number;
  /** 是否在节流开始时调用 */
  throttleLeading?: boolean;
  /** 是否在节流结束时调用 */
  throttleTrailing?: boolean;

  // cache - 缓存
  /** 缓存键 - 用于标识不同请求的缓存 */
  cacheKey?: string;
  /** 缓存存活时间（毫秒） */
  cacheTime?: number;
  /** 数据新鲜时间（毫秒）- 在此时间内不会重新请求 */
  staleTime?: number;

  // retry - 重试
  /** 重试次数 */
  retryCount?: number;
  /** 重试间隔（毫秒） */
  retryInterval?: number;

  // ready - 准备状态
  /** 是否准备就绪 - 为 false 时不会触发请求 */
  ready?: boolean;

  // prepare - 参数预处理
  /** 请求前参数预处理函数 */
  prepare?: (...args: TParams) => TParams;

  /** 扩展属性 - 用于传递自定义配置 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * useRequest 返回接口
 * @template TData 返回数据类型
 * @template TParams 参数类型数组
 */
export interface Result<TData, TParams extends unknown[]> {
  /** 是否正在加载 */
  loading: boolean;
  /** 返回数据 */
  data?: TData;
  /** 错误信息 */
  error?: ApiError;
  /** 当前请求参数 */
  params: TParams | [];
  /** 取消请求 */
  cancel: Fetch<TData, TParams>["cancel"];
  /** 刷新请求（使用当前参数） */
  refresh: Fetch<TData, TParams>["refresh"];
  /** 异步刷新请求（使用当前参数） */
  refreshAsync: Fetch<TData, TParams>["refreshAsync"];
  /** 运行请求（传入新参数） */
  run: Fetch<TData, TParams>["run"];
  /** 异步运行请求（传入新参数） */
  runAsync: Fetch<TData, TParams>["runAsync"];
  /** 手动修改数据 */
  mutate: Fetch<TData, TParams>["mutate"];
}
