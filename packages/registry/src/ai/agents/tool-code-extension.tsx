"use client"

import {Braces, Calculator, Sigma, Terminal} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "../components/code-block"

import type {MathVariableBinding} from "../hooks/use-chat/schema"

export type ToolCodeExtensionKind = "math-formula" | "math-result" | "js-script" | "js-stdout" | "js-result"

export interface ToolCodeExtensionProps {
  /** 展示类型，决定标题、图标和语法高亮语言 */
  kind: ToolCodeExtensionKind
  /** 公式、脚本、标准输出或执行结果；JavaScript 无返回值时为 null */
  code: string | null | undefined
  /** 数学公式使用的变量赋值 */
  variables?: MathVariableBinding[] | null
}

/**
 * 使用 CodeBlock 统一展示数学公式、数学结果、JavaScript 脚本和执行结果
 */
export function ToolCodeExtension({kind, code, variables}: ToolCodeExtensionProps) {
  const t = useAgentMessages("tool-code-extension")

  const config = {
    "math-formula": {
      language: "wolfram",
      title: t.mathFormulaTitle,
      copyLabel: t.copyMathFormula.value,
      icon: <Sigma className="size-3.5"/>,
      showLineNumbers: false,
    },
    "math-result": {
      language: "wolfram",
      title: t.mathResultTitle,
      copyLabel: t.copyMathResult.value,
      icon: <Calculator className="size-3.5"/>,
      showLineNumbers: false,
    },
    "js-script": {
      language: "javascript",
      title: t.jsScriptTitle,
      copyLabel: t.copyJsScript.value,
      icon: <Braces className="size-3.5"/>,
      showLineNumbers: true,
    },
    "js-stdout": {
      language: "bash",
      title: t.jsStdoutTitle,
      copyLabel: t.copyJsStdout.value,
      icon: <Terminal className="size-3.5"/>,
      showLineNumbers: false,
    },
    "js-result": {
      language: "javascript",
      title: t.jsResultTitle,
      copyLabel: t.copyJsResult.value,
      icon: <Terminal className="size-3.5"/>,
      showLineNumbers: false,
    },
  } as const
  const {language, title, copyLabel, icon, showLineNumbers} = config[kind]
  const displayCode = code ?? t.noReturnValue.value

  return (
    <div className="flex flex-col gap-2">
      <CodeBlock code={displayCode} language={language} showLineNumbers={showLineNumbers} className="not-prose">
        <CodeBlockHeader>
          <CodeBlockTitle>
            {icon}
            <CodeBlockFilename>{title}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton aria-label={copyLabel} title={copyLabel}/>
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>

      {kind === "math-formula" && variables && variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-2 text-xs">
          <span className="mr-1 text-muted-foreground">{t.variables}</span>
          {variables.map((variable, index) => (
            <code
              key={`${variable.name}-${variable.value}-${index}`}
              className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground"
            >
              {variable.name} = {variable.value}
            </code>
          ))}
        </div>
      )}
    </div>
  )
}
