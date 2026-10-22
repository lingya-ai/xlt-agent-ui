"use client";
import {useApiRequest, type UseApiRequestOptions} from '../api/hooks/use-api-request';
/** 直接提交 SDK 方法回调；本 Hook 只管理 UI 请求状态 */
export function useOpenApiOperation<T>(service:()=>Promise<T>,options:UseApiRequestOptions<T,[]>={}) {
 return useApiRequest(service,options);
}
