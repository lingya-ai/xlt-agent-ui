import {Demo} from "../../components/demo";
export const metadata = {title: "交互演示"};
export default function Page() {return <div className="examples-page"><div className="breadcrumb">示例 / 交互演示</div><header className="article-header"><h1>亲手试试，完整体验。</h1><p>切换聊天、工作台、只读历史与目标模式。使用本地模拟，无需凭据。</p></header><Demo/><p className="demo-caption">所有演示均使用本地模拟数据，不连接真实渠道。</p></div>;}
