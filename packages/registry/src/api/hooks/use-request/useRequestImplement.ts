'use client';

import type {RefObject} from 'react';
import useLatest from '../use-latest';
import useCreation from '../use-creation';
import useMemoizedFn from '../use-memoized-fn';
import useUnmount from '../use-unmount';
import useUpdate from '../use-update';

import Fetch from './Fetch';
import type {Options, Plugin, Result, Service} from './types';

/**
 * Core implementation of useRequest
 * Manages the Fetch instance and plugins
 */
function useRequestImplement<TData, TParams extends unknown[]>(
  service: Service<TData, TParams>,
  options: Options<TData, TParams> = {},
  plugins: Plugin<TData, TParams>[] = []
): Result<TData, TParams> {
  const {manual = false, ready = true, ...rest} = options;

  const fetchOptions = {
    manual,
    ready,
    ...rest,
  };

  const serviceRef = useLatest(service) as RefObject<Service<TData, TParams>>;

  const update = useUpdate();

  const fetchInstance = useCreation(() => {
    const initState = plugins.map((p) => p?.onInit?.(fetchOptions)).filter(Boolean);

    return new Fetch<TData, TParams>(
      serviceRef,
      fetchOptions,
      update,
      Object.assign({}, ...initState)
    );
  }, []);

  fetchInstance.options = fetchOptions;

  // run all plugins hooks
  fetchInstance.pluginImpls = plugins.map((p) => p(fetchInstance, fetchOptions));


  useUnmount(() => {
    fetchInstance.cancel();
  });

  return {
    loading: fetchInstance.state.loading,
    data: fetchInstance.state.data,
    error: fetchInstance.state.error,
    params: fetchInstance.state.params || [],
    cancel: useMemoizedFn(fetchInstance.cancel.bind(fetchInstance)),
    refresh: useMemoizedFn(fetchInstance.refresh.bind(fetchInstance)),
    refreshAsync: useMemoizedFn(fetchInstance.refreshAsync.bind(fetchInstance)),
    run: useMemoizedFn(fetchInstance.run.bind(fetchInstance)),
    runAsync: useMemoizedFn(fetchInstance.runAsync.bind(fetchInstance)),
    mutate: useMemoizedFn(fetchInstance.mutate.bind(fetchInstance)),
  } as Result<TData, TParams>;
}

export default useRequestImplement;
