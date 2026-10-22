export type {WorkspaceNonFileArtifact} from "@lingya-ai/agents-sdk/browser";
/** 已知预览类型；SDK 返回其他类型时由列表保留显示。 */
export enum WorkspaceNonFileArtifactKindEnum { HTML_PAGE = "HTML_PAGE" }
export type WorkspaceNonFileArtifactKind = string;
/** 宿主显式授予的预览能力，不属于 SDK 制品响应。 */
export enum HtmlPageAuthoringModeEnum { SOURCE = "SOURCE", DIAGRAM = "DIAGRAM" }
