import {codeToHtml} from "shiki";
import {CodeFrame} from "./code-block";
export async function CodeBlock({code, language = "tsx"}: {code: string; language?: string}) {
  const lang = ["tsx", "ts", "css", "sh", "json", "text"].includes(language) ? language : "text";
  const html = await codeToHtml(code, {lang, themes: {light: "github-light", dark: "github-dark"}});
  return <CodeFrame code={code} language={language}><div dangerouslySetInnerHTML={{__html: html}}/></CodeFrame>;
}
