import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {AgentDemo} from "@xlt/registry/examples/demo";
import "../../docs/app/globals.css";
const root = document.getElementById("root");
if (!root) throw new Error("缺少应用根节点");
createRoot(root).render(<StrictMode><main><div className="eyebrow">VITE / REACT 19</div><h1>OpenAPI Agent 接入示例</h1><AgentDemo/></main></StrictMode>);
