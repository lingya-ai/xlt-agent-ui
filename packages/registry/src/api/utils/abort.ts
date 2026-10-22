/**
 * 将宿主生命周期及单次请求的取消信号连接到本次请求控制器。
 *
 * 不依赖 Chromium 102 尚未提供的 AbortSignal.any；请求结束后调用返回的清理函数。
 */
export function linkAbortSignals(
  controller: AbortController,
  signals: readonly (AbortSignal | null | undefined)[],
): () => void {
  const sources = [
    ...new Set(
      signals.filter((signal): signal is AbortSignal => Boolean(signal)),
    ),
  ];
  if (sources.some((signal) => signal.aborted)) {
    controller.abort();
    return () => undefined;
  }
  const abort = () => {
    controller.abort();
  };
  for (const signal of sources)
    signal.addEventListener("abort", abort, { once: true });
  return () => {
    for (const signal of sources) signal.removeEventListener("abort", abort);
  };
}
