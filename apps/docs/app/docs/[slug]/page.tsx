import {notFound} from "next/navigation";
import {endpoints} from "@xlt/registry/openapi/endpoints";
import {guides} from "../../../lib/content";
import {Article} from "../../../components/article";
import {Demo} from "../../../components/demo";
import {CodeBlock} from "../../../components/highlight";
export function generateStaticParams() {return guides.map(page => ({slug: page.href.split("/").at(-1)!}));}
export const dynamicParams = false;
export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params; const page = guides.find(page => page.href === `/docs/${slug}`); return {title: page?.title, description: page?.description};
}
export default async function Page({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const page = guides.find(page => page.href === `/docs/${slug}`);
  if (!page) notFound();
  return <Article page={page}>{slug === "quick-start" && <ol className="onboarding-steps" aria-label="接入步骤"><li>准备 React 与 Tailwind</li><li>安装组件与配置客户端</li><li>接入服务端令牌接口</li></ol>}{page.chapters.map((chapter, index) => <section className="doc-section" key={chapter.id}><h2 id={chapter.id}><a href={`#${chapter.id}`}>{chapter.title}<span className="heading-anchor">#</span></a></h2>{chapter.blocks.map((block, i) => block.kind === "code" ? <CodeBlock key={i} code={block.value} language={block.language}/> : <p key={i}>{block.value}</p>)}{index === page.chapters.length - 1 && slug === "goal" && <Demo mode="goal"/>}{index === page.chapters.length - 1 && slug === "components" && <div className="table-scroll"><table><thead><tr><th>操作</th><th>后端路由（相对 /chat）</th><th>传输</th><th>组件条目</th></tr></thead><tbody>{Object.entries(endpoints).map(([name, endpoint]) => <tr key={name}><td><code>{name}</code></td><td><code>{endpoint.method} {endpoint.path || "/"}</code></td><td>{endpoint.transport}</td><td>{endpoint.feature}</td></tr>)}</tbody></table></div>}</section>)}</Article>;
}

