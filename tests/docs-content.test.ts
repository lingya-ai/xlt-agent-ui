import {describe, expect, it} from "vitest";
import {sections} from "../apps/docs/content";
import {componentDocs, guides, navigation, parseBlocks, registryCommand, searchPages} from "../apps/docs/lib/content";
describe("文档内容和导航", () => {
  it("保留旧文档正文和地址，章节不丢失代码块", () => {
    for (const section of sections) {
      const page = guides.find(page => page.href === `/docs/${section.slug}`)!;
      expect(page).toBeDefined();
      expect(page.chapters.flatMap(chapter => chapter.blocks)).toEqual(parseBlocks(section.body));
      expect(new Set(page.chapters.map(chapter => chapter.id)).size).toBe(page.chapters.length);
    }
  });
  it("核心组件与导航地址唯一，安装使用固定版本", () => {
    expect(componentDocs).toHaveLength(6);
    expect(new Set(navigation.map(page => page.href)).size).toBe(navigation.length);
    expect(registryCommand("agent-chat")).toContain("/r/0.2.1/agent-chat.json");
    expect(componentDocs.every(page => page.code.includes(`import {${page.symbol}}`))).toBe(true);
  });
  it("支持正文检索、多词匹配及空结果", () => {
    expect(searchPages("单次使用令牌").some(page => page.href.startsWith("/docs/authentication"))).toBe(true);
    expect(searchPages("聊天")[0]?.href).toContain("/components/chat");
    expect(searchPages("WebSocket token").some(page => page.href.startsWith("/docs/authentication"))).toBe(true);
    expect(searchPages("zzz-no-document")).toEqual([]);
    expect(searchPages("").every(page => !page.href.includes("#"))).toBe(true);
  });
});
