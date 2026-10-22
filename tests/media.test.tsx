import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {AgentMediaProvider, OptionalFilePreview} from "../packages/registry/src/integration/media";
import {AgentLocale, AgentMessagesProvider} from "../packages/registry/src/i18n/runtime";
import type {FilePreviewProps} from "../packages/registry/src/file-preview/props";

describe("可选重型渲染能力", () => {
  it("基础聊天保留下载入口和可覆盖文案，不需要文件预览实现", () => {
    render(<AgentMessagesProvider locale={AgentLocale.En} messages={{"optional-capabilities": {download: "Save attachment"}}}>
      <OptionalFilePreview src="https://example.test/file.pdf" fileName="file.pdf"/>
    </AgentMessagesProvider>);
    expect(screen.getByRole("button", {name: "Save attachment"})).toBeTruthy();
    expect(screen.getByText("Install file previews to view this file")).toBeTruthy();
  });
  it("嵌套能力合并时保留外层预览器，并传递原文件属性", () => {
    function Preview({fileName}: FilePreviewProps) {return <p>自定义预览 {fileName}</p>;}
    render(<AgentMediaProvider filePreview={Preview}><AgentMediaProvider>
      <OptionalFilePreview src="https://example.test/report.pdf" fileName="report.pdf"/>
    </AgentMediaProvider></AgentMediaProvider>);
    expect(screen.getByText("自定义预览 report.pdf")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
