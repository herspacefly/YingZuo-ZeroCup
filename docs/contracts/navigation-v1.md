# 产品页面与导航接口（T02）

日期：2026-10-17。依据主方案第4/5节与T02；消费ProjectV1、资产和剧情合同，不改变存档版本或故事范围。

## 入口与持久化

index.html为产品外壳，八个根入口是`#/`、`#/craft`、`#/light`、`#/story`、`#/museum`、`#/practice`、`#/result`、`#/about`。展品子入口仅接受`#/museum/E01`至`E08`。路由写入Project.lastRoute时只存根路径；展品目录不触发VISIT，T18只为实际打开的展签提交VISIT，不写任何剧情字段。

`parseHash`只解析白名单，空hash规范到首页，`#/stage`单次replace到practice。原首页的light-study/story-preview/museum-preview分别规范到灯影/关于/展馆。任意节点、查询参数或未知展品不成为剧情命令，回首页并显示提示。链接、直接地址、浏览器前进/返回和刷新共用同一解析器。

createHashRouter通过HashLocationPort读、push、replace与监听；接受回调返回false时恢复已挂载地址。相同地址的后续hashchange不重复挂载，dispose撤销监听。页面内skip-link由应用拦截，只聚焦main，不写导航或进度。

## 页面接线与清理

每个PageFactory接收host与PageContext，返回`update(StoreState)`和`dispose()`。根应用只打开一个ProjectStore，持有唯一订阅；页面不能另开存储、直写IDB或自己建立全局订阅。切页先dispose再清空host，之后挂载并更新新页。页面事件通过scope登记并释放。

PageContext的route是本次挂载的稳定副本；普通编辑走edit，立即保存走run/flush，剧情和项目替换走durable。durable覆盖文件读取与事务等待，期间禁止切页；失败候选未处理也禁止切页。文件读取晚到或页面已离开时，不再调用替换入口。成功持久化后才切到目标页面。

pagehide/HMR统一清理路由、页面监听、Store订阅、Store计时器与连接、下载URL。BFCache恢复时重载并读取本机存档。T04舞台、T07输入/单时钟及T05试杆均在PageView.dispose清理；T16新增NodeScope、导演时钟、字幕和待显示stage也遵守同一边界。T16十次播放/重开/离页验证只覆盖当前自动短场面，不代表未来全剧循环验收；音频清理钩子目前仅替身验证。

## 已实现的真实操作

- 首页和无run的story页仅在用户明确开演时生成一次runId，交给startStory；已有run只继续，不重建。序幕可通过已有guarded用户跳过命令进入craft，不提供其他越级推进。
- craft的纹样、配色、三段镂空/色槽调用字段命令，控件从getExportProject显示最新稿。T05接显式开演/默认影偶冻结与归档重开，现有冻结角色与决定不变。light接灯位/偶幕距离；两页普通输入不自动重试memory/error。细节见craft-v1.md。
- 结果页由reunionSummary派生真实curtain/completed节目单、1600×1200双偶留影与只读编排重演；未团圆只显示进度。下载如实反馈，编码/导入/新建/离页受锁与generation保护，接口见result-v1.md。没有P1录制或分享空按钮。
- “我的作品”可导出当前稿/候选、导出原始记录、导入、新建归档、重试、取消候选或明确内存继续；复用现有串行Store。下载只报告已请求浏览器，不声称文件已写盘。
- 未知版本、损坏恢复、多标签冲突持续显示并保护原稿。恢复/接管在独立project.html工作台明确处理；返回后先导出需要保留的页面稿，再点“重新读取本机作品”。没有后台自动接管或静默覆盖。

## 页面边界与后续消费者

T04已将制偶、灯影、练习和剧情场面接到同一Canvas渲染器；显示静止的真实分件、几何投影与节点初始层，仍明确标记排演资源。study.html保留原T00独立灯影试作，其百分比坐标和探针数据不是正式舞台配置；probe.html仍使用独立探针库。project/assets/story.html继续作为数据、资产、文字工程入口，在新窗口打开。

T18已接五区八件两层说明、来源、局部演示和真实参与记录；文化资料沿用sources.json访问边界，不复用外部媒体。演示只取冻结外观或明确示例，不修改用户编辑稿；进入展馆不要求通关，返回剧场从原稳定节点暂停重开。详见museum-v1.md。首页CSS幕面与Canvas几何影偶都不取代T10正式原画。

宽屏场面和控制区并排，手机上下布局；菜单与作品工具有明确展开状态、44px主要目标和可见焦点，切页聚焦标题。禁用JavaScript时保留静态故事/展馆介绍。无远程字体或运行时CDN。CSS有字面值与基础IE回退，legacy包和Chromium冒烟不等于真实IE运行验收。

T04接口见canvas-v1.md；T05制偶/灯影见craft-v1.md，T07操偶见practice-v1.md，T16场面见director-v1.md；T17图形交互见story-play-v1.md，T18展签及演示见museum-v1.md，T09成果输出见result-v1.md。T17/T18/T09十次操作/离页检查输入、时钟与资源释放，恢复稳定节点而不恢复瞬时拖动；完整SAVE矩阵及实体设备仍留T11。新增消费者须保持导航、保存与清理边界，按PageContext.isBusy读取根操作锁。
