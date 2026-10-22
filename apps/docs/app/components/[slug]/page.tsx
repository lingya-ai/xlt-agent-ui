import Link from "next/link";
import {notFound} from "next/navigation";
import {Alert, AlertDescription, AlertTitle} from "@xlt/registry/ui/components/alert";
import {componentDocs, registryCommand} from "../../../lib/content";
import {Article} from "../../../components/article";
import {CodeBlock} from "../../../components/highlight";
import {PreviewTabs} from "../../../components/demo";
export const dynamicParams = false;
export function generateStaticParams() {return componentDocs.map(({slug}) => ({slug}));}
export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {const {slug} = await params; const page = componentDocs.find(page => page.slug === slug); return {title: page?.title, description: page?.description};}
export default async function Page({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params; const page = componentDocs.find(page => page.slug === slug); if (!page) notFound();
  return <Article page={page}><section className="doc-section"><h2 id="section-1">交互预览</h2><PreviewTabs mode={slug}><CodeBlock code={page.code}/></PreviewTabs></section><section className="doc-section"><h2 id="section-2">安装</h2><CodeBlock code={registryCommand(page.item)} language="sh"/><p>命令中的 Registry 地址默认指向本地服务。部署时配置 REGISTRY_ORIGIN，安装路径由宿主 components.json 的 aliases 决定。</p></section><section className="doc-section"><h2 id="section-3">使用</h2><Alert><AlertTitle>接入说明</AlertTitle><AlertDescription>{page.note}</AlertDescription></Alert><CodeBlock code={page.code}/><p>示例放在 AgentProvider 内；客户端与身份配置见<Link href="/docs/quick-start">快速开始</Link>。示例中的消息列表和提交回调由宿主聊天状态层提供。</p></section><section className="doc-section"><h2 id="section-4">主要参数</h2><div className="table-scroll"><table><thead><tr><th>参数</th><th>类型</th><th>说明</th></tr></thead><tbody>{page.props.map(([name, type, description]) => <tr key={name}><td><code>{name}</code></td><td><code>{type}</code></td><td>{description}</td></tr>)}</tbody></table></div><p className="muted">参数摘自 {page.symbol} 的实际导出类型；安装后的源码包含完整类型与注释。</p></section><section className="doc-section"><h2 id="section-5">相关文档</h2><div className="related-links"><Link href="/docs/quick-start">快速开始 →</Link><Link href="/docs/authentication">令牌与服务端接入 →</Link><Link href="/docs/installation">源码安装与条目 →</Link>{slug === "goal" && <Link href="/docs/goal">目标模式与控制 →</Link>}</div></section></Article>;
}
