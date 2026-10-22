import {useCallback} from "react";
import type {AgentsClient, ListWorkspaceArtifactsOptions, WorkspaceArtifactList} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";
export type {WorkspaceFile, WorkspaceArtifactList, WorkspaceNonFileArtifact} from "@lingya-ai/agents-sdk/browser";
export {WorkspaceNonFileArtifactKindEnum} from "./workspace-non-file-artifact-schema";
export type {WorkspaceNonFileArtifactKind} from "./workspace-non-file-artifact-schema";
export type WorkspaceFileListInput = Pick<ListWorkspaceArtifactsOptions, "prefix" | "current" | "size">;
export type UseWorkspaceFilesOptions = {httpClient: AgentsClient};
/** 使用 SDK 查询工作区；工作区文件通过相对路径标识，消息文件另有版本 ID。 */
export function useWorkspaceFiles({httpClient}: UseWorkspaceFilesOptions) {
 const signal=useAiChatRequestSignal(httpClient);
 return useCallback((conversationId:string,input:WorkspaceFileListInput={}):Promise<WorkspaceArtifactList> =>
 httpClient.workspace.listWorkspaceArtifacts(conversationId,{...input,signal}),[httpClient,signal]);
}
