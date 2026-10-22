import {ApiError} from '@lingya-ai/agents-sdk/browser';
/** 直接读取 SDK 解析的业务错误码 */
export function getApiBusinessCode(error:unknown):string|undefined {return error instanceof ApiError ? error.code : undefined;}
/** 直接读取 SDK 解析的业务错误消息 */
export function getApiBusinessMessage(error:unknown):string|undefined {return error instanceof ApiError ? error.message : undefined;}
/** 资源限制的具体内容由后端提供，组件不依赖内部套餐跳转 */
export function getResourceLimitMessage(error:unknown):string|undefined {return error instanceof ApiError && error.code?.startsWith('resource.limit.') ? error.message : undefined;}
