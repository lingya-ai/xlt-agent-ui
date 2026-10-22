"use client";
import {useState, type ReactNode} from "react";
import {Check, Copy} from "lucide-react";
import {Button} from "@xlt/registry/ui/components/button";
export function CodeFrame({code, language, children}: {code: string; language: string; children?: ReactNode}) {
  const [status, setStatus] = useState("");
  return <div className="code-frame"><div className="code-toolbar"><span>{language}</span><Button size="sm" variant="ghost" aria-label="复制代码" onClick={async () => {try {await navigator.clipboard.writeText(code); setStatus("已复制");} catch {setStatus("复制失败，请手动选择代码");} setTimeout(() => setStatus(""), 2500);}}>{status === "已复制" ? <Check data-icon="inline-start"/> : <Copy data-icon="inline-start"/>}{status || "复制"}</Button><span className="sr-only" role="status">{status}</span></div>{children ?? <pre><code>{code}</code></pre>}</div>;
}
