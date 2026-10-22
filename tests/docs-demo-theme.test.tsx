import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {ReactNode} from "react";
vi.mock("../packages/registry/src/openapi/provider", () => ({AgentProvider: ({children}: {children: ReactNode}) => children}));
vi.mock("../packages/registry/src/blocks/agent-chat", () => ({AgentChat: () => <div>chat preview</div>}));
vi.mock("../packages/registry/src/blocks/agent-chat-workbench", () => ({AgentChatWorkbench: () => <div>workspace preview</div>}));
vi.mock("../packages/registry/src/integration/rich-results", () => ({AgentRichResultsProvider: ({children}: {children: ReactNode}) => children}));
vi.mock("../packages/registry/src/examples/goal-demo", () => ({AgentGoalDemo: () => <div>goal preview</div>}));
vi.mock("sonner", () => ({Toaster: () => null}));
import {AgentDemo} from "../packages/registry/src/examples/demo";
afterEach(() => {cleanup(); document.documentElement.classList.remove("dark");});
describe("嵌入演示的主题边界", () => {
  it("演示仅提供本地模拟，中英文均无真实渠道配置入口", () => {
    render(<AgentDemo/>);
    expect(screen.getByText("本地模拟")).toBeDefined();
    expect(screen.queryByText("配置真实渠道")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name:"English"}));
    expect(screen.getByText("Local simulation")).toBeDefined();
    expect(screen.queryByText("Connect a real channel")).toBeNull();
  });
  it("受控主题不修改宿主 html，切换通过回调交给宿主", () => {
    document.documentElement.classList.add("dark");
    const onThemeChange = vi.fn();
    const view = render(<AgentDemo theme="light" onThemeChange={onThemeChange}/>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("region", {name:"交互演示"}).classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", {name:"切换主题"}));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
    view.rerender(<AgentDemo theme="dark" onThemeChange={onThemeChange}/>);
    expect(screen.getByRole("region", {name:"交互演示"}).classList.contains("dark")).toBe(true);
    view.unmount();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
  it("独立演示保留原有主题切换行为", () => {
    render(<AgentDemo/>);
    fireEvent.click(screen.getByRole("button", {name:"切换主题"}));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
