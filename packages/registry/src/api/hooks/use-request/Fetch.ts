'use client';

import type {RefObject} from 'react';
import type {ApiError} from '@lingya-ai/agents-sdk/browser';
import type {FetchState, PluginReturn, Service, Subscribe} from './types';

/**
 * Fetch class for managing request state and execution
 * Core class that handles request lifecycle and plugin coordination
 */
export default class Fetch<TData, TParams extends unknown[]> {
  pluginImpls: PluginReturn<TData, TParams>[] = [];

  count: number = 0;

  /** 是否已成功加载过至少一次（用于轮询静默加载） */
  private _hasLoadedOnce: boolean = false;
  /** 当前请求是否由手动调用触发（run/runAsync） */
  private _isManualCall: boolean = false;

  state: FetchState<TData, TParams> = {
    loading: false,
    params: undefined,
    data: undefined,
    error: undefined,
  };

  constructor(
    public serviceRef: RefObject<Service<TData, TParams>>,
    public options: {
      manual?: boolean;
      pollingSilentLoading?: boolean;
      onBefore?: (params: TParams) => void;
      onSuccess?: (data: TData, params: TParams) => void;
      onError?: (error: ApiError, params: TParams) => void;
      onFinally?: (params: TParams, data?: TData, error?: ApiError) => void;
      prepare?: (...args: TParams) => TParams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    },
    public subscribe: Subscribe,
    public initState: Partial<FetchState<TData, TParams>> = {}
  ) {
    this.state = {
      ...this.state,
      loading: !options.manual,
      ...initState,
    };
  }

  setState(s: Partial<FetchState<TData, TParams>> = {}): void {
    this.state = {
      ...this.state,
      ...s,
    };
    this.subscribe();
  }

  runPluginHandler(event: keyof PluginReturn<TData, TParams>, ...rest: unknown[]): Record<string, unknown> {
    // @ts-expect-error - dynamic access to plugin methods
    const r = this.pluginImpls.map((i) => i[event]?.(...rest)).filter(Boolean);
    return Object.assign({}, ...r) as Record<string, unknown>;
  }

  async runAsync(...params: TParams): Promise<TData> {
    this.count += 1;
    const currentCount = this.count;

    // 使用 prepare 函数处理参数
    const finalParams = this.options.prepare ? this.options.prepare(...params) : params;

    const {
      stopNow = false,
      returnNow = false,
      ...state
    } = this.runPluginHandler('onBefore', finalParams) as {
      stopNow?: boolean;
      returnNow?: boolean;
      [key: string]: unknown;
    };

    // stop request
    if (stopNow) {
      this._isManualCall = true;
      return Promise.reject(new Error('Request was stopped'));
    }

    // 判断是否需要显示 loading（读取后立即重置为 true，确保下次直接调用时显示 loading）
    const shouldShowLoading = this._shouldShowLoading();
    this._isManualCall = true;

    this.setState({
      loading: shouldShowLoading,
      params: finalParams,
      ...state,
    } as Partial<FetchState<TData, TParams>>);

    // return now
    if (returnNow) {
      return Promise.resolve(state.data as TData);
    }

    this.options.onBefore?.(finalParams);

    try {
      // replace service
      let {servicePromise} = this.runPluginHandler('onRequest', this.serviceRef.current, finalParams) as {
        servicePromise?: Promise<TData>;
      };

      if (!servicePromise) {
        servicePromise = this.serviceRef.current(...finalParams);
      }

      const res = await servicePromise;

      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        return Promise.reject(new Error('Request was canceled'));
      }

      // 标记已成功加载过
      this._hasLoadedOnce = true;

      this.setState({
        data: res,
        error: undefined,
        loading: false,
      });

      this.options.onSuccess?.(res, finalParams);
      this.runPluginHandler('onSuccess', res, finalParams);

      this.options.onFinally?.(finalParams, res, undefined);

      if (currentCount === this.count) {
        this.runPluginHandler('onFinally', finalParams, res, undefined);
      }

      return res;
    } catch (error) {
      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        return Promise.reject(new Error('Request was canceled'));
      }

      this.setState({
        error: error as ApiError | undefined,
        loading: false,
      });

      this.options.onError?.(error as ApiError, finalParams);
      this.runPluginHandler('onError', error, finalParams);

      this.options.onFinally?.(finalParams, undefined, error as ApiError);

      if (currentCount === this.count) {
        this.runPluginHandler('onFinally', finalParams, undefined, error);
      }

      throw error;
    }
  }

  run(...params: TParams): void {
    this._isManualCall = true; // 标记为手动调用
    this._runAsyncInternal(...params);
  }

  /** 内部方法：执行请求并处理错误（不设置 _isManualCall 标记） */
  private _runAsyncInternal(...params: TParams): void {
    this.runAsync(...params).catch((error) => {
      // 忽略取消错误
      if (error?.message === 'Request was canceled' || error?.message === 'Request was stopped') {
        return;
      }
      if (!this.options.onError) {
        console.error(error);
      }
    });
  }

  cancel(): void {
    this.count += 1;
    this.setState({
      loading: false,
    });

    this.runPluginHandler('onCancel');
  }

  refresh(): void {
    this._isManualCall = true; // 标记为手动调用
    // @ts-expect-error - params could be undefined
    this._runAsyncInternal(...(this.state.params || []));
  }

  /** 插件内部使用的静默刷新（轮询、窗口焦点等自动触发，受 pollingSilentLoading 控制） */
  silentRefresh(): void {
    this._isManualCall = false;
    // @ts-expect-error - params could be undefined
    this._runAsyncInternal(...(this.state.params || []));
  }

  refreshAsync(): Promise<TData> {
    this._isManualCall = true; // 标记为手动调用，确保显示 loading 状态
    // @ts-expect-error - params could be undefined
    return this.runAsync(...(this.state.params || []));
  }

  mutate(data?: TData | ((oldData?: TData) => TData | undefined)): void {
    const targetData = typeof data === 'function' ? (data as (oldData?: TData) => TData)(this.state.data) : data;
    this.runPluginHandler('onMutate', targetData);
    this.setState({
      data: targetData,
    });
  }

  /**
   * 判断是否应该显示 loading 状态
   * @returns true 表示显示 loading，false 表示静默加载
   */
  private _shouldShowLoading(): boolean {
    const pollingSilentLoading = this.options.pollingSilentLoading ?? true;

    // 如果未启用轮询静默加载，总是显示 loading
    if (!pollingSilentLoading) {
      return true;
    }

    // 手动调用总是显示 loading
    if (this._isManualCall) {
      return true;
    }

    // 首次加载显示 loading
    if (!this._hasLoadedOnce) {
      return true;
    }

    // 轮询刷新且已加载过，不显示 loading（静默刷新）
    return false;
  }
}
