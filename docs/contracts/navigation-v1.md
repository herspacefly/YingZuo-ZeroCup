# 产品页面与导航接口（T02）

日期：2026-10-17。依据主方案第4/5节与T02；消费ProjectV1、资产和剧情合同，不改变存档版本或故事范围。

## 入口与持久化

index.html为产品外壳，八个根入口是`#/`、`#/craft`、`#/light`、`#/story`、`#/museum`、`#/practice`、`#/result`、`#/about`。展品子入口仅接受`#/museum/E01`至`E08`。路由写入Project.lastRoute时只存根路径，展品目录不触发VISIT，也不写任何剧情字段。

`parseHash`只解析白名单，空hash规范到首页，`#/stage`单次replace到practice。原首页的light-study/story-preview/museum-preview分别规范到灯影/关于/展馆。任意节点、查询参数或未知展品不成为剧情命令，回首页并显示提示。链接、直接地址、浏览器前进/返回和刷新共用同一解析器。

createHashRouter通过HashLocationPort读、push、replace与监听；接受回调返回false时恢复已挂载地址。相同地址的后续hashchange不重复挂载，dispose撤销监听。页面内skip-link由应用拦截，只聚焦main，不写导航或进度。

## 页面接线与清理

每个PageFactory接收host与PageContext，返回`update(StoreState)`和`dispose()`。根应用只打开一个ProjectStore，持有唯一订阅；页面不能另开存储、直写IDB或自己建立全局订阅。切页先dispose再清空host，之后挂载并更新新页。页面事件通过scope登记并释放。

PageContext的route是本次挂载的稳定副本；普通编辑走edit，立即保存走run/flush，剧情和项目替换走durable。durable覆盖文件读取与事务等待，期间禁止切页；失败候选未处理也禁止切页。文件读取晚到或页面已离开时，不再调用替换入口。成功持久化后才切到目标页面。

pagehide/HMR统一清理路由、页面监听、Store订阅、Store计时器与连接、下载URL。BFCache恢复时重载并读取本机存档。当前产品尚无动画/声音/输入循环，T04/T07/T16接入后须把相应清理放入PageView.dispose；T02十次进出只证明现有接线不重复，不代表未来渲染循环验收。

## 已实现的真实操作

- 首页和无run的story页仅在用户明确开演时生成一次runId，交给startStory；已有run只继续，不重建。序幕可通过已有guarded用户跳过命令进入craft，不提供其他越级推进。
- craft的纹样、配色调用字段命令，控件从getExportProject显示最新稿。冻结角色与已确认决定保持不变；这里尚无刻纹完成、开演冻结或图形预览。
- 结果页仅由reunionSummary派生已保存curtain/completed节目单，未团圆只显示进度。没有PNG、重演、录制或分享空按钮。
- “我的作品”可导出当前稿/候选、导出原始记录、导入、新建归档、重试、取消候选或明确内存继续；复用现有串行Store。下载只报告已请求浏览器，不声称文件已写盘。
- 未知版本、损坏恢复、多标签冲突持续显示并保护原稿。恢复/接管在独立project.html工作台明确处理；返回后先导出需要保留的页面稿，再点“重新读取本机作品”。没有后台自动接管或静默覆盖。

## 页面边界与后续消费者

灯影、练习、剧情场面共享静态幕面占位，明确说明排演状态。study.html保留原T00独立灯影试作，其百分比坐标和探针数据不是正式舞台配置；probe.html仍使用独立探针库。project/assets/story.html继续作为数据、资产、文字工程入口，在新窗口打开。

展馆只有五区八件的可读目录，正文/来源/互动由T18补齐；文化资料沿用sources.json访问边界，不复用外部媒体。当前CSS幕面不是正式皮影原画，不取代T10。

宽屏场面和控制区并排，手机上下布局；菜单与作品工具有明确展开状态、44px主要目标和可见焦点，切页聚焦标题。禁用JavaScript时保留静态故事/展馆介绍。无远程字体或运行时CDN。CSS有字面值与基础IE回退，legacy包和Chromium冒烟不等于真实IE运行验收。

T04用真实成影替换stageFrame的占位内容；T05接完整制偶；T07接操偶；T16/T17接节点导演和故事交互；T18接展签及演示；T09接成果输出。新增消费者须保持此导航、保存与清理边界。
