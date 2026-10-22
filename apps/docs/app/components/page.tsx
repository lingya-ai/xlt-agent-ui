import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {componentDocs} from "../../lib/content";
export const metadata = {title: "组件目录"};
export default function Page() {return <div className="component-index"><div className="breadcrumb">组件 / 源码目录</div><header className="article-header"><h1>按需组合，自由构建。</h1><p>从独立能力到完整聊天工作台，安装你需要的组件源码。</p></header><div className="component-grid">{componentDocs.map(page => <Link className="component-card" href={page.href} key={page.slug}><span className="component-symbol">{page.symbol}</span><ArrowUpRight size={16}/><h2>{page.title}</h2><p>{page.description}</p><span className="component-entry">{page.item} →</span></Link>)}</div><section className="doc-section"><h2>更多可安装能力</h2><p>文件预览、引用、SQL 图表、审批交互、异步任务与子代理均提供独立条目。</p><div className="related-links"><Link href="/docs/installation">源码安装与条目 →</Link><Link href="/docs/components">组件与契约 →</Link></div></section></div>;}
