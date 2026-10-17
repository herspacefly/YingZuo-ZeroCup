# 当前开发状态与交接

更新日期：2026-10-17。codex-root，main。两份用户暂存赛事DOCX/PPTX未读取、未修改、未纳入开发提交，暂存blob保持原值。

## 当前阶段与入口

**T00/T03/T01/T15/T02/T04/T07/T05/T16已完成；下一项优先T17占位图形整场。** 当前源码检查点f0e1ec7d68746ba8152e583de7e96dba751c0be6。

- Node v24.18.1 / npm12.0.2，TypeScript7.0.2，Vite7.3.7/legacy7.2.1；锁与依赖不变。npm ci恢复，npm run dev启动。5173会话17320仍可用，本轮HTTP实际200。
- 剧场已接18秒完整/10秒导览序幕、绝对时间短场面、当前字幕/完整台词、暂停/继续/重开、暂停切模式与明确跳序。刷新、回到页面或切模式成功后，从当前短节点0毫秒暂停重建。
- 每个节点有新generation/NodeScope，单个animation-clock；失焦、隐藏、异常及超过250ms断档暂停，不补墙钟。Renderer仍无RAF。下一幕独立加载，旧scope已停但旧Canvas/台词保留到新幕ready；失败可重试，离页释放两套舞台并拒绝晚到图片。
- 自动场须播满当前模式targetMs，经队列内scope与run/revision/node校验才提交。失败保留旧节点与同一候选；取消后可在末帧再确认。memory/error播放不自动写盘，末尾需明确确认进入下一段。普通路由自动保存不打断播放。
- interaction/choice仍在暂停构图，craft已有明确冻结确认；reunion-hold播满4秒也不自动完成。图形操偶、唯一分支、最后伸手和用户谢幕待T17，不存在全剧跳过后门。
- craft已有刻纹/着色/共纹、可重置临时身杆、使用编辑稿或默认影偶明确冻结及归档重开；light已有灯位/距离与真实保存；practice已有三杆/五动作/唯一时钟/Pose保存。这些与冻结剧情、节点初值彼此独立。
- story.html仍为可走完整/导览两路径的文字排演；project/assets/study/probe.html保留独立检查入口。五区八件目前只有目录，80张PNG仍draft/unknown。当前二维静音几何排演，不是正式艺术、声音或Three镜头交付。

## 本轮实际检查（T16）

- 最终npm test：20文件268/268通过，新增39项（导演15、NodeScope13、串行场面命令11）。覆盖18节点/两模式、绝对时间/合法bbox/冻结隔离、独立静态分镜、节点退出/事件/timer/audio替身、真实Store/IDB排队与候选。
- 最终npm run build含typecheck通过，29.69秒；之后源码未再改变。modern/legacy六HTML仍生成，verify:legacy确认13份JS为ES5。verify:assets通过80张PNG/alpha/区域/CSV/哈希，verify:content通过18节点/两路径；verify:state通过19任务。未改正式release门禁，未重复其NOT_READY检查。
- 最终npm run test:e2e -- --workers=2：172/172通过，5.6分钟。Chromium156.0.8078.4，1440×900桌面/390×844模拟手机各86项；新增28项，原144项回归通过。虚拟时钟加速门槛检查，不是实际6—8分钟体验验收。
- 定向首轮17/20：字幕断言误写为剧本没有的“救母”，按既有台词修正；一个十次播放实例被普通路由自动保存打断，已区分保存原因。新增28项在第一次全量中均通过。
- 全量首轮168/172（5.5分钟）：两处旧回归在桌面/手机都依赖“暂停接续”提示。恢复该真实提示，保留原断言；没有放松剧情/事务检查。最终全量172/172通过。
- 只读审查五项已修复并复核：回应不提前开山、单台词也有减少动态分镜、取消候选解锁末帧、路由保存不打断、采样异常不泄漏未挂载Canvas。另按截图把序幕后半段山片变为半透明幕后示意，使操偶杆实际可见。
- 已查看并保留docs/evidence/2026-10-17-t16-director-desktop.png与mobile.png，生产浏览器验证无横向溢出，字幕/角色/显杆与宽窄屏控件可读；这些是排演与布局证据。
- 实际IE/IE模式、实体手机/Safari、图形全剧手动可达性/完整SAVE-01—07、全剧性能/时长/情绪、正式美术/文化/许可：未验收。音频仅清理替身，没有实际声音素材。

## 消费者与数据边界

先读docs/contracts下project-v1、assets-v1、story-v1、navigation-v1、canvas-v1、practice-v1、craft-v1及新增director-v1。Project/资产/18节点版本不变。

- createSceneDirector捕获entry字段、模式与冻结外观；尚未冻结时只捕获一次编辑Appearance。只有沉香Pose和灯位/距离可作为临时输入，固定演员保持自身色板。sample输出纯帧/字幕/亮度/标签，无Store/DOM/时钟/命令。
- NodeScope先失活、逆序清理，退出后登记立即清理；onError失败也完成其余清理再报告。scope持时钟与节点事件，页面单独拥有正在显示/等待资源的两套stage；保留旧帧不等于保留旧导演。
- submitScopedSceneCommand在Store队列执行时重验scope和guard；自动完成只允许cinematic/curtain且activation=automatic。必须在停钟前捕获未暂停观察；不要在每帧闭包里直接写进度。
- craft冻结、普通编辑与归档入口沿用craft-v1；未知版本/冲突禁止覆盖。身杆临时Pose、practice持久Pose、节点entryPose是独立边界。T17不得将末帧或时长当互动成功。
- 世界宽2/高1.5、灯深1.2、根归一化x右/y下、世界y上、scale下限.6与附件实际bbox继续有效。T17需复用受限后的实际手点/区域、连续hold与明确协助，不保存整场位姿。

## 并行、检查点与清理

两独立工作树派发前已建codex分支。导演贡献ec4dc9925298462421f3d93c3a94b59feea543a4；NodeScope贡献ec27b0c8c2f895399c6f86f5809ab99a3fae80d4；场面命令测试22a96489e821f257fa1df5620b6b82f7400b473d。主目录按文件集成并修复、接线、统一验证。只读审查t02_route_audit最终未发现实际阻塞。

T16已验证源码f0e1ec7d68746ba8152e583de7e96dba751c0be6；后续交接元数据不改变实现。T05为3e8880cdc856744a03be66d1fc18481d9c4a4c0e，旧阶段证据见verification与账本。本轮两工作树归档请求返回queued，目录仍在，旧T04/T07/T05同类目录也不手动递归删除。test-results的5文件/4子目录已在核对绝对路径后逐项无Force/无递归删除，Test-Path=false；证据图保留。

## 下一位首先执行

1. 先核对Git/暂存/端口，保留用户两份赛事文档；当前可从5173访问剧场、制偶、灯影与练习。
2. 领取T17，复用director-v1、practice-v1、story-v1与唯一时钟；先走一条占位图形整场与真实刷新。山前前景目前会遮住人物，必须结合寻光/举斧实现真实显影与开合，逐场查看实际画面及手点，不能只凭合法帧数据宣称可达；再补两路差异、共纹回收、最后用户伸手、至少4秒静候及幂等谢幕。
3. T18接五区八展品，T09接成果PNG；正式艺术/声音与文化留T10，真实IE与完整图形恢复留T11。P1录制/分享仍在T13/G3之后。
