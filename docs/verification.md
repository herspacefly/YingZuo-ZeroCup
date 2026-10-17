# 验证记录

本文件记录真实执行的检查。方案中的目标、预计结果与待执行验收不构成通过证据。

## 2026-10-15：1.0 文档阶段（历史记录）

- 应用源码、`package.json`、运行服务和测试尚未建立。
- 不能运行或宣称通过应用类型检查、构建、单元测试、端到端测试、手机测试和 IE11 验收。
- 当前机器 Node.js 实际检测为 `v24.18.1`。
- 已完成文档静态一致性检查：15 个任务 ID 唯一、依赖图无环、任务定义与引用存在、9 个本地链接有效、代码围栏配对、JSON 可解析。
- 已核对：所有应用任务仍为 todo，验证列表为空，提交 SHA 为 null；T03 不再提前依赖后续完整 SAVE 验收；灯影与首屏试杆均有明确任务所有权。
- 已核对：录制 partial 带冻结快照、上一作品独立备份、坐标正逆变换、采样端点与中断任务转交均有明确契约。
- 独立审查发现的上述问题已修订并通过静态一致性检查。这些检查只证明交接资料自洽，不证明应用功能、性能或兼容性。

## 2026-10-15：2.0 叙事改版文档

- 新增叙事、美术与展陈执行稿；主方案、入口、AGENTS、STATE、任务账本已同步到《影作·一幕团圆》。
- 已查询河北省文旅厅剧目记录、中国文联演出报道、文旅部《宝莲灯》梗概及中国非遗网资料，区分传统故事、皮影剧目依据、原创交互改编与简化示意。
- 内容独立审查后补清了序幕人物目标、第一幕记忆/时序压缩；工程审查后补清双角色类型、节点灯位初值、暂停切模式重挂载、过期保存和事务版本检查、备份提升后的保存基线。
- 实际静态检查：19 个任务 ID 唯一；普通及所有启用 P1 的条件依赖图无环；任务标题/验收引用存在；15 个本地 Markdown 链接有效；18 个剧情节点在两份方案中对应；代码围栏配对；任务 JSON 可解析。
- 全部应用任务仍 todo，owner/branch/checkpointCommit 为 null，verification 为空；T08/T12 是依赖 T13 的 P1，T09 不再依赖可选录制。
- 已再次检查目录：当前仍无 src、package.json、.git，Git 明确返回非仓库。没有创建应用或运行服务。
- 未执行应用类型检查、构建、单元/端到端、浏览器、性能、时长、情绪或 IE 测试；文档一致性通过不能替代这些结果。

## 2026-10-16：T00 工程、Canvas 与事务探针

- 执行者：codex-root；分支 main。此前实际无 Git/工程，已初始化并保留原资料；源码提交与最后已验证提交 SHA 见 docs/tasks.json。本节验收范围为 T00，尚未达到 G1。
- 环境：Windows；Node v24.18.1 / npm 12.0.2；TypeScript 7.0.2、Vite 7.3.7、legacy 7.2.1、Vitest 5.0.4、Playwright 1.64.1；Chromium 156.0.8078.4（Playwright build 1248）。依赖精确安装结果由 package-lock.json 固定。
- 实现：可读作品入口、事件驱动 Canvas 灯影、独立 probe.html、yingzuo-compat-probe-v1 的原子提交/回滚与版本冲突检查、真实测试 JSON 下载、页面清理。探针不等同正式作品存档，未访问未来的 yingzuo-v1。

| 实际命令／操作 | 结果与边界 |
| --- | --- |
| npm install（最终 Vite7/legacy7 组合） | 安装成功；npm audit 报告 0 漏洞；锁文件已生成。不据此声明应用安全审计通过 |
| npm run typecheck / npm run build | 通过；同时检查浏览器与工具/测试类型；产出两个 HTML 的现代/legacy 入口 |
| npm run verify:legacy | 4 个 legacy JS 文件通过 ES5 解析，两个 HTML 含现代/legacy 引导；不表示 IE 实测 |
| npm test | 7/7，通过提交重开、两条记录回滚、首次写入中止、并发旧版本拒绝、未知数据保留、非法数值拒绝、无存储／禁止存储 |
| npm run test:e2e -- --workers=2 | 14/14，生产包，1440×900 与模拟手机 390×844 两个 Chromium 项目 |
| 浏览器检查内容 | Canvas 实际像素随键盘灯位改变、重置、无横向溢出；真实 IndexedDB 保存/刷新/回滚；双标签拒绝旧版本并保留未保存灯位；禁止存储下实际下载并解析 JSON；强制执行 legacy 产物；关闭 JavaScript／Canvas 的可读回退 |
| npm run verify:state | 19 个任务，状态/依赖/负责人/验证字段与交接文件一致；只属文档账本检查 |
| npm run verify:assets | NOT_READY，退出码 2：正式资产清单尚未建立；未执行素材许可和文化审定 |
| npm run dev -- --port 5173 --strictPort | 服务启动成功；首页 HTTP 200；生产 preview 已由端到端测试实际启动于 4173 |
| 查看页面截图 | 已查看桌面与窄屏实际截图，无内容重叠或水平溢出；保留证据见下方。这是 T00 占位页，尚未验收正式视觉 |

持久化诊断证据：[桌面截图](evidence/t00-desktop.png)、[窄屏截图](evidence/t00-mobile.png)。自动化测试过程中的其他临时输出收尾清理；可由上述命令重新生成。

实际发现并修复：

1. Vite 8.3.4 / legacy 8.2.3 的初次产物含反引号、箭头函数；即使改用 Terser，polyfill 辅助代码仍未满足 ES5。固定为 Vite 7.3.7 / legacy 7.2.1 并保留显式 IE11 目标、ECMA5 压缩和逐文件语法检查后通过。未修改 node_modules 规避问题。
2. 独立审查复现保存后额外回读可能接纳其他标签的新 revision。面板改为使用本次事务返回值；回滚检查期间若发现外部写入，报告无法确认，避免误判。
3. 第一轮无脚本测试因换行后的无障碍标题名称含空格而定位失败；核对实际 DOM 后使用稳定标题元素校验。最终 14 项全部通过。

未执行：真实 IE11／实际 IE 模式、实体手机与 Safari、完整短戏/双路径、正式 Project 的 DATA-01—05 与 SAVE-01—07、情绪与时长测试、正式性能预算、正式素材和八展品审定。机器存在 IE 启动器仅是文件检查，不能证明 IE 实测完成。T11 需安排真实环境生产包补测；T03/T01/T02 现可按依赖领取，优先正式数据与存档基线。

## 2026-10-16：T03 正式数据、事务恢复与串行保存

- 执行者 codex-root，分支 main；以 T00 检查点为基线接续。未读取 DOCX/PPTX，保留用户已暂存的两个原始赛事文件，不混入本任务提交。具体源码检查点见任务账本 T03.checkpointCommit。
- 环境沿用 Node v24.18.1 / npm 12.0.2、TypeScript 7.0.2、Vite 7.3.7 / legacy 7.2.1、Vitest 5.0.4、Playwright 1.64.1 / Chromium 156.0.8078.4；未修改依赖或锁文件。
- 新增 ProjectV1 类型、默认值、严格验证、首版迁移入口、合法/损坏/未来版本 fixture；正式 yingzuo-v1 事务适配、ProjectStore、编辑命令、文件导入导出与 project.html 工作台。数据/消费者合同见 docs/contracts/project-v1.md。

| 检查与验收引用 | 真实结果 |
| --- | --- |
| npm test | 4 个文件、80/80 通过，其中原 T00 7 项，其余为正式数据/事务/调度检查 |
| DATA-01 | 合法 fixture round-trip；输入、编辑稿、冻结角色及可选短片互不引用；恢复保留 runId 与决定，Pose 存档六位小数 |
| DATA-02 | 未知资源/节点/字段/版本、坏 JSON、非有限数、Unicode 码点/UTF-8 长度、剧情路径/完成时间/协助一致性拒绝；未来版本及超限存档不被备份降级覆盖 |
| DATA-03 | 单次 put 成功后 abort 仍整体回滚；quota 无假成功；备份提升核对原稿/备份/隔离内容，保留 raw-invalid，之后可编辑/保存/重开；失败恢复保留全部旧记录 |
| DATA-04 | 新项目归档原子完成，多次普通保存不改 previous-project；两写入者只有一笔成功；项目身份、版本与完整已读内容共同拒绝陈旧写入 |
| DATA-05 | P0 performance/partialRecording 维持 null；只验证 P1 数据结构：完整/部分的 30 Hz、帧数边界、冻结配置、暂停态与时长往返。没有实现或启用录制器 |
| 串行入口 | 500 ms 防抖/2 s 上限读取最新状态；旧保存、即时命令、期间编辑依序合并；失败候选可导出/重试/明确内存继续/取消；重试不重建候选身份，销毁清计时器 |
| npm run build | 类型检查与三页面 modern/legacy 生产构建通过 |
| npm run verify:legacy | 6 份 legacy JS 通过 ES5 解析；index/probe/project 均有 modern/legacy 引导 |
| npm run test:e2e -- --workers=2 | 最终 34/34 通过，1440×900 桌面与 390×844 模拟手机各 17 项；含原 T00 检查与新增正式数据工作台流程 |
| 真实浏览器数据操作 | 自动保存/刷新身份与外观；真实文件导入导出、冻结配置不漂移；错误文件不覆盖；新建/上一项目恢复；损坏稿隔离后继续保存；未知版本保护；两标签双方导出与明确接管；禁止存储时内存稿下载；legacy 产物运行 |
| 待提交输入回归 | archive-exists 后连续输入 ABC 仍完整导出；取消替换保留原项目身份和排队编辑，保存/刷新继续一致 |
| 视觉与服务 | 已查看两尺寸工作台截图，无水平溢出；dev 5173 实际启动，project.html HTTP 200。保存截图用于接线与布局诊断，不代表正式产品视觉验收 |

检查截图保留为 [桌面工作台](evidence/t03-desktop.png) / [窄屏工作台](evidence/t03-mobile.png)；其他自动化输出收尾清理。

实际发现并修复：

1. 非 JSON 隐式值可能被 stringify 丢弃、数组 toJSON 可能绕过结构验证；改为先拒绝钩子、访问器、隐藏字段和运行时对象，再复制序列化。
2. 版本字段损坏与格式有效的新版本混为一类；现在前者可检查备份，后者及超限记录受保护。
3. 损坏原稿的普通 stringify token 会混淆 NaN/null、undefined/缺失；改用保留类型的原稿 token。正常保存额外比较完整已读内容，防止恢复备份后同身份/同版本的旧页面覆盖。
4. 失败候选最初不能独立导出、替换没有取消出口；已补只读候选导出、排队编辑及取消 API。工作台改为显示待提交稿，避免连续输入被旧稿回填覆盖。
5. 文件 fixture 在 Node ESM 下需要 JSON import attribute；表单 label 包含 select 选项导致精确标签定位失败。分别补属性并分离 label，最终全套通过。

未执行或未完成：T02 正式 hash 页面、T01 正式资源、T15 真实剧情 reducer/全剧、整场 SAVE-01—07、真实 IE11/IE 模式、实体手机/Safari、正式性能/内容/情绪验收。当前 T03 数据分层验收完成，G1 仍待 T02；不把 fixture 的故事节点当成可玩的演出。

## 后续记录模板

```text
日期时间与执行者：
任务 ID 与验收条目：
Git 提交 / 分支 / 未提交文件摘要：
环境：操作系统、浏览器版本、尺寸、设备、网络条件
实际命令或操作：
实际结果：通过 / 失败 / 未执行
证据文件或日志位置：
失败与未检查项目：
下一步：
```

真实 IE11／实际 IE 模式结果必须单列。现代 Chromium 的自动化或强制二维模式不能替代 IE 实测。对用户存档恢复与开发接手分别记录演练结果。

T00 源码检查点：25e694d6cfcc0519224c480902eff26cb6e24776。上述检查对应这份源码；后续交接提交只登记提交号，不改变应用实现。

T03 源码检查点：bef273f2a5d13621c185a8289dee154514676102；80/80 单元检查、34/34 浏览器检查及 6 份 legacy ES5 检查对应这份应用实现。

## 2026-10-16：T01 三角色、场景与资产契约

- 执行者codex-root，分支main；环境与锁文件未变。用户暂存的赛事DOCX/PPTX未读取、未改动、不包含在开发提交中。
- 建立三角色十/六/四部件，统一九关节字段与模板限制、pivot/骨长/杆连接、附件、中性框/动作范围、三种三段镂空、三套编辑色和两套固定色、三组场景与素幕回退；RenderActor区分编辑角色和固定角色。接口见 contracts/assets-v1.md。
- 原创程序生成80张PNG（60部件图、2附件、9镂空、9场景层），登记CSV/manifest的作者、AI辅助生成过程、用途与SHA-256。均保持draft/unknown；没有代团队授予版权许可，也没有复用远程媒体。
- sources.json登记C1—C7：C2/C5/C6/C7正文可读，C3/C4原页超时而核对官方搜索索引，C1被人机验证阻拦；原始/可读路径、日期与事实边界分别记录。C2叙事稿链接已修正。引用资料不等于素材授权。

实际检查：

- `npm test`：5文件100/100通过，新增20项契约检查（含路径表驱动反例、关节环、简化字段、几何骨长/手杆、图层遮挡、纹样与pivot变换）。
- `npm run build`（含typecheck）通过；`npm run verify:legacy`确认8份legacy JS为ES5，四个HTML都有modern/legacy入口。
- `npm run verify:assets`通过：80张RGBA8 PNG逐张解码，非空及透明像素、遮罩白色/精确颜色区代码、三图逐像素alpha、尺寸/引用/白名单/路径/CSV/哈希一致。占位生成器连续重跑清单与所有PNG哈希一致。
- 实际子进程检查 `node scripts/verify-assets.mjs --release`退出2，输出NOT_READY。当前草稿资源不被记为已发布/已审定。
- 最终 `npm run test:e2e -- --workers=2`：42/42通过，36.2秒；Chromium156.0.8078.4，桌面1440×900、模拟手机390×844，各21项。新增8项包括角色/纹样/场景像素变化、缺必要遮罩后空画布及重试、Canvas失败可读状态、legacy包冒烟；原T00/T03的34项回归通过。
- assets.html 实际可从5173打开。已查看并保留 evidence/t01-desktop.png（1440×1000）与t01-mobile.png（390×844，滚动至组装区域），用于工程布局与分件检查。
- 独立只读审查发现 Element.append 的IE DOM缺口，改用appendChild；补上必要手臂链、骨长与手杆连接、山片遮挡/开合范围的反例校验。图像校验早期发现颜色区抗锯齿混色与头图alpha不一致，生成器已使用离散标签和共同轮廓修复。视觉检查发现纸色脸部与幕布重合，已调整固定源色并复查。

本轮没有实现双角色运行时成影、IK、灯影投影、剧情状态机或正式产品路由。完整两路径/恢复、正式美术/文化/许可、真实IE/实体手机/Safari、性能与情绪验收未执行，分别留给T02/T04/T10/T11/T15—T18。T01通过不代表G1或整场完成。上述两张布局诊断图保留在docs/evidence。清理临时test-results的操作两次被自动审批以“blocked by policy”拒绝（含改用已核对的显式文件路径），工具未给更具体原因；四张回归截图和.last-run.json仍留在忽略目录，未提交。

T01已验证源码检查点：15f9650119d97fffd2accea82f64c5a4e07be9fc；以上100项单元、42项生产浏览器与8份legacy ES5检查对应这份实现。

## 2026-10-16：T15 版本化文字剧本、守卫命令与保存

- 执行者codex-root，main；独立审查者t15_contract_audit只读需求/代码，无共享写入。依赖与锁文件未变；新增verify:content脚本，不读取或提交用户暂存的赛事DOCX/PPTX。
- reunion-v1.json共18节点，每路径15节点；full/guided共享事件顺序与完成条件，唯一选择汇合到团圆。明确角色入口姿态/灯位/场景/附件，字幕以full目标时间轴记录，并通过subtitlesForMode映射到guided。
- beginStory与四类剧情命令均经Store.commit；run/revision/nodeId旧身份no-op，当前非法动作/payload拒绝。确认编辑稿时从队列执行时最新appearance冻结；明确默认影偶时冻结defaultAppearance，编辑稿保留。
- reunion-hold至少4秒后需用户点击；进入curtain一次写completedAt，成果ID只派生runId:reunion。保存候选未成功不应用下一节点；失败可导出、重试同一候选、取消或明确内存继续，完成时间不重建。
- storyEntry返回独立入口副本和新generation token，恢复/模式变化都暂停并重开当前短节点。文本页的过场时钟可暂停，失焦/隐藏/长卡顿暂停；实际动画、NodeScope与输入/几何判定留T16/T17。

实际执行：

- `npm test`：7文件141/141通过，新增41项，包括full/guided×两路线×手动证据/明确协助，重复身份、错动作/跳过、冻结/预设、完成时间、静候/模式、配置图/资源/字幕反例，以及ProjectStore+fake-indexeddb事务失败/导出/取消/明确内存继续/同候选重试。
- `npm run build`（含typecheck）通过；`npm run verify:legacy`确认10份legacy JS为ES5，五个HTML具备modern/legacy入口。
- `npm run verify:content`通过节点、路径、角色/关节限位/附件、场景初值、字幕基准、来源与资源引用；`verify:assets`仍通过80张PNG的实际检查；`verify:state`通过19任务依赖与证据记录。
- 子进程实际确认verify-content与verify-assets的`--release`均退出2/NOT_READY；没有把开发结构通过冒称正式内容、文化或素材许可审定。
- 最终`npm run test:e2e -- --workers=2`：56/56通过，约1.1分钟。Chromium156.0.8078.4，桌面1440×900、模拟手机390×844，各28项。新增14项验证四种文字路径/模式组合、选择前后真实刷新、暂停切模式重挂载、团圆写入故障/候选真实下载/重试/谢幕同完成时间和legacy运行；原42项回归通过。
- 最短停留与过场等待由Playwright虚拟时钟加速；它检查门槛与暂停接续，不是6—8分钟或三分钟实际体验时长验收。合成手动evidence也不是实际鼠标/触屏/键盘操偶验收。
- http://127.0.0.1:5173/story.html实际可用，已查看并保留evidence/t15-desktop.png（1440×1000）与t15-mobile.png（390×844，滚动至选择节点），仅作文字工程布局证据。
- 只读审查发现三项接口问题并已修复复核：导览字幕未定时间映射、修改稿被恒标预设、必要兵器未列入强制资源检查。修复均有对应反例检查，未发现新的T15阻塞。
- 本轮逐文件使用显式路径、无Force/无递归，成功删除test-results中的5个临时文件及空目录，实际Test-Path=false；未再遗留临时诊断材料。docs/evidence中证据截图保留。

尚未完成：正式产品hash路由（T02）、双角色运行时成影/投影/IK（T04）、真实手动与键盘动作/协助短片/场面清理（T07/T16/T17）、八展品及成果PNG（T18/T09）、正式美术与内容审定（T10）、真实IE/实体手机/Safari、完整图形SAVE流程、性能与情绪验收。T15的STORY-01/02/07通过仅覆盖文字/领域和持久化边界，G1仍待T02。

T15已验证源码检查点：a619ab40e44e8ea91ef3d63deeaa7f12aa1a23cd；以上141项单元、56项生产浏览器、10份legacy ES5及内容/资产检查对应这份实现。

## 2026-10-17：T02 产品页面、hash导航与宽窄屏基线

- codex-root在main实施，t02_route_audit只读审查；依赖、锁文件和存档版本未变。用户暂存的赛事DOCX/PPTX未读取或纳入提交。
- index.html改为单一产品外壳；八根hash页、五区八件目录、配色/纹样、检查点、真实节目单接同一个ProjectStore。原T00首页移至study.html，probe保留独立库；工程工作台、资产、文字排演均保留独立入口。
- 纯解析器白名单与单次replace规范化；浏览器返回/刷新不重建作品或剧情。展品子入口只存museum根路由，不记VISIT；结果未团圆不伪造完成。开演、跳序、归档/导入均通过已有串行入口，失败候选未应用时守住原页面。
- mount/update/dispose与中央订阅统一清理；导入读文件期间也锁定导航，迟到回调不再替换。文件下载如实报告浏览器请求；无JS保留静态可读故事和展馆介绍。

实际检查：

- `npm test`：8文件147/147通过；T02新增6项解析/规范化/守卫/销毁检查。
- 最终`npm run build`含typecheck通过；六个HTML有modern/legacy入口，`verify:legacy`确认13份legacy JS为ES5。
- 最终`npm run test:e2e -- --workers=2`：84/84通过，约1.8分钟。Chromium156.0.8078.4，桌面1440×900、模拟手机390×844各42项。新增28项检查产品接线，原56项回归通过；具体范围见STATE与navigation.spec.ts。
- 首轮83/84，旧story-state.spec.ts在3.9秒边界断言时仍累计测试执行的真实墙钟时间，负载下已超过4秒，导致导览/先开山的一项“尚未谢幕”断言失败。现安装固定测试时间，在显式runFor之间pauseAt冻结；最终全84项通过。未改变生产门槛或放松边界断言，仍检查3.9秒禁用/4.1秒允许。
- `verify:assets`通过80张PNG实际解码/引用/区域/CSV/哈希，`verify:content`通过18节点/两路径及角色/时间/来源/资源契约，`verify:state`通过19任务依赖/归属/证据检查。release正式审定仍NOT_READY，未重复执行未改动的release门禁。
- 5173开发服务本轮重新启动，首页实际可加载。已查看并保留evidence/t02-desktop.png、t02-mobile.png、t02-craft.png、t02-museum-mobile.png。宽屏首页/制偶1440×900、手机首页/展馆390×844以fullPage截图；另查1920/1024/360宽制偶页，均无横向溢出。
- 只读审查发现IE11不支持classList.toggle的force参数，以及独立工作台恢复后主应用没有重读动作。分别改显式add/remove与明确重读按钮；后者有先导出未保存稿的提示，并有实际恢复/重读e2e。工具面板以open属性和CSS控制，不依赖原生details折叠。最终只读复核无新增遗漏。
- 逐文件、显式路径、无Force/无递归清理临时截图脚本、test-results中5个文件与空目录；两个Test-Path均为false。四张docs/evidence证据图保留。

T02验收范围为页面、导航与既有数据能力接线，G1基线齐备。静态幕面、目录和文字检查点尚不构成图形全剧/展品演示/成果PNG；实际IE、实体手机/Safari、完整图形SAVE、性能/时长/情绪与正式美术/文化/许可仍待T04—T14/T16—T18。下一项优先T04。

T02已验证源码检查点：d9c26e635c606e39d911c21222fe2e59a7fe47af；以上147项单元、84项生产浏览器、13份legacy ES5及内容/资产检查对应这份实现。

## 2026-10-17：T04 双角色Canvas、姿态与投影

- codex-root在main集成生产渲染与产品四页。t04_math在独立codex/t04-pose-projection工作树完成数学4文件并提交7ff5c01cae75868e29aa8e50dbd2dde91fc7040d，主目录集成后统一检查；t02_route_audit只读审查。依赖、锁文件、资产数据和Project版本未变；赛事DOCX/PPTX未读取或纳入提交。
- 实现根坐标/缩放/镜像、关节/部件/附件pivot变换、两骨IK、真实姿态/可见附件角点bbox、边界适配、正逆投影与letterbox换算。不可全纳时显式fits=false，不突破存档scale下限。
- Canvas数据帧最多两角色，固定角色独立配置；精确色区重着色/原alpha/局部镂空之后按部件排序绘制，场景背景→演员→山片/尘幕。按需加载当前资源，帧代号拒绝晚到结果，update/resize仅绘一次，无独立RAF。
- craft接编辑双角色预览，light/practice接编辑姿态投影，story只接已保存节点入口构图/冻结外观/附件并保持暂停。不开放刻纹/灯控/拖杆，不推进节点，不回写预览适配Pose。

实际验证：

- `npm test`：11文件177/177通过，新增25项姿态/投影与5项绘制数据边界。包含重合/伸展/不可达/限位、两种facing/scale、灯位极值、任意pivot/bind/rest、附件/实际bbox、三模板禁用关节、黑边输入，以及场景覆盖不能改order/assetId。
- 最终`npm run build`（含typecheck）通过；六个HTML仍有modern/legacy入口，最终`verify:legacy`确认13份legacy JS为ES5。
- 最终`npm run test:e2e -- --workers=2`：100/100通过，2.2分钟。Chromium156.0.8078.4，桌面1440×900与模拟手机390×844各50项，新增16项Canvas流程，原84项回归通过。
- 新增图像/生命周期检查覆盖编辑角色变色而冻结母亲不变、冻结剧情构图不随编辑变化、镂空改变影偶而不擦空背景、缺遮罩时清空与重试、Canvas不可用仍能编辑读文、像素读取失败清缓存并实际重发图片请求、迟到加载/十次进出/旧Canvas清零与resize监听释放、legacy双角色实际绘制。
- 早期图像检查用红色计数识别靛色角色，在窄屏收到1像素；改按实际深色像素及图像差异判断，没有修改配色或降低角色验证。只读审查发现绘制失败仍保留资源缓存、覆盖参数可带额外order/assetId、工厂异常后旧签名阻断同帧恢复，已修复并复核。
- 增加绘制错误反例后曾98/100：文档已解码图片缓存仍复用同URL，单清JS缓存未产生新请求。清理后加载追加本页数字retry代次；原样保留“重试必须新请求”的断言，定位复核2/2和最终100/100通过。
- `verify:assets`与`verify:content`通过，80张PNG/18节点/两路径的原有契约不变；`verify:state`通过19任务。开发结构通过不代表正式release审定，未重复未改动的release门禁。
- 5173实际返回200，已查看并保留evidence/t04-craft-desktop.png、t04-craft-mobile.png、t04-story-desktop.png。实际幕面采用4:3等比letterbox，宽窄屏未见拉伸和横向溢出；没有把几何轮廓当正式皮影美术。
- 截图临时脚本、test-results五个文件及空目录已显式路径、无Force/无递归清理，两个Test-Path为false。数学工作树归档工具返回queued，本轮仍保留已提交贡献目录，未宣称已移除。

T04已达到自身基础验收；下一项优先T07。当前没有半影模糊或精确光学仿真，也不是导演/手动可达性/完整图形SAVE、真实IE/实体手机/Safari、全剧性能/时长/情绪、正式美术/文化/许可验收。详见canvas-v1合同及STATE。

T04已验证源码检查点：4297769f29dc02892c58abfcd3e218a0b0d804db；以上177项单元、100项生产浏览器、13份legacy ES5及资源/内容检查对应这份实现。

## 2026-10-17：T07 三杆练习、五动作与有限几何观察

- codex-root在main实现独立练习与输入/保存/Canvas快速帧；t07_actions在独立codex/t07-actions完成5文件，提交4e8670d5e2a79f5216019a923f50dfa0c52253a5后按文件集成。只读审查由t02_route_audit完成，最终无新增阻塞。依赖、ProjectV1及资产版本不变，两份用户暂存赛事文档未读/未改/未纳入开发提交。
- 三48px握柄从实际连接展开并保留抓取偏移，鼠标/Pointer触屏与Touch回退、标识匹配/取消、方向键持续/松开、方向按钮/原生range、镜像大小均经逆投影/IK/附件bbox。固定角色不受手动输入。
- 五动作采用稳定ID与绝对毫秒关键帧，公开pose/elapsed/finished/attachments/bounds/fits；唯一时钟在失焦/隐藏/超过250ms断档暂停，不补墙钟。Renderer已有资源时同步绘制，无独立RAF。减少动态可250ms步进。
- 有限观察提供归一目标转世界、目标覆盖比、手距/幕宽、角度与连续hold；无Store或StoryCommand依赖。练习不启动/推进剧情，不改变冻结配置和P1字段。Pose经串行队列每200ms限频并尾随，恢复默认暂停；memory/error需明确保存才重试写盘。导入前锁定并提交旧姿态，旧时钟不能覆盖新项目。

实际检查：

- npm test：15文件209/209通过，新增32项（动作/观察20、杆4、时钟8），覆盖两帧率等时、取消/迟到/长断档、镜像缩放/灯位/两手IK/真实附件bbox与几何坏值。
- 最终npm run build含typecheck通过；verify:legacy的13份legacy JS通过ES5语法检查，六HTML有modern/legacy入口。
- 最终npm run test:e2e -- --workers=2：122/122通过，2.6分钟；Chromium156.0.8078.4，桌面1440×900/模拟手机390×844各61项，新增22项，原100项回归。
- 新增流程验证实际鼠标与CDP触屏、Touch回退/取消/多结束标识、按键/失焦/原生range、快速末次输入保存刷新、五动作/边界/暂停继续/隐藏/长卡顿/减少动态、导入保留旧末姿态且新稿不被旧帧覆盖、失败导出不自动重试、内存继续需明确保存、Canvas故障与十次播放进出后应用事件/RAF/旧Canvas清理。
- 审查发现并修复下拉刷新重置值、节流末次遗漏、换斧未重新适配、自动flush越过memory/error保护；保护读真实Store状态，避免根busy将页面状态覆写saving造成误判。
- 首轮测试错误包括归档键误用previousProject（实际previous-project），把Playwright晚装的8个hit-target hook计入应用泄漏，以及hash切换未重跑Canvas故障init script。按真实合同键、生产bundle调用来源与真实reload修正；计数同时检查入页增加、离页回基线，未降低应用断言。
- verify:assets通过80张PNG/alpha/区域/CSV/哈希，verify:content通过18节点/两路径，verify:state通过19任务；未重复未改动的release门禁。
- 5173响应200，已查看evidence/t07-practice-desktop.png和t07-practice-mobile.png；宽窄屏无横向溢出。截图临时脚本与test-results的5文件/4目录逐项显式路径、无Force/无递归清理，Test-Path均false。两托管工作树归档仍queued/目录仍在。

T07达到自身验收；下一项优先T05，再T16/T17占位整场。真实IE/实体手机/Safari、完整图形SAVE/手动可达性、全剧性能/时长/情绪、正式美术/文化/许可仍未验收。接口以practice-v1与canvas-v1为准。

T07已验证源码检查点：b7bbff6bb123d582195e029f6db3f106a092dac1；以上209项单元、122项生产浏览器、13份legacy ES5及资产/内容检查对应此实现。
