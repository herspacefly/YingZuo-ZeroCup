# 当前开发状态与交接

更新日期：2026-10-16。当前执行者 codex-root；实际分支 main。

## 当前阶段与运行入口

**T00、T03、T01及T15已完成；G1仍待T02正式页面与导航。**

- Node v24.18.1 / npm 12.0.2；TypeScript 7.0.2、Vite 7.3.7 / legacy 7.2.1，依赖和 package-lock.json 本轮未变。
- `npm ci` 恢复依赖，`npm run dev` 启动。当前会话 http://127.0.0.1:5173/ 仍运行，story.html实际可加载；换会话需先核对实际端口。
- index.html 为原 T00 灯影试作，probe.html 使用独立探针库。project.html 是 T03 正式存档工作台，使用 yingzuo-v1/snapshots；完整演出与产品 hash 页面尚未接入。
- 正式数据包含编辑外观、冻结角色、稳定剧情节点与决定、展品访问、P1可空字段，严格拒绝坏数据与未知版本。T15已实现纯命令与文字推进；录制、Three.js及图形整场尚未实现。
- 实际源文件与接口见 src/domain、src/persistence、src/app/store.ts、commands.ts、identity.ts；消费者先读 docs/contracts/project-v1.md。
- assets.html 为 T01 工程检查页；src/content 与 public/assets 提供三角色十/六/四部件、九关节字段、纹样、色板和场景层，共80张原创几何占位 PNG。消费者先读 docs/contracts/assets-v1.md；此页不是 T04 的生产渲染器。
- story.html为文字排演检查页；18节点、两路径、暂停切模式、明确协助、一次完成时间与派生成果摘要均经ProjectStore提交。消费者读docs/contracts/story-v1.md；它不是T16/T17图形导演或手动操偶。

## 本轮实际检查

- 7个单元测试文件，141/141通过；T15新增41项，覆盖两模式/两路径/手动证据与明确协助、身份幂等、冻结/预设、暂停模式、静候、内容反例，以及真实Store与fake-indexeddb的失败/候选/重试边界。
- 类型检查与生产构建通过；五个HTML有modern/legacy入口，10份legacy JS通过ES5解析。
- 最终生产包浏览器检查56/56（约1.1分钟），Chromium156.0.8078.4，桌面1440×900、模拟手机390×844，各28项。T15新增14项：四种模式/路线组合、选择前后刷新、暂停切模式、团圆保存故障/真实下载/重试和legacy入口；原42项回归也通过。节点等待由Playwright虚拟时钟加速，不构成实际演出时长或情绪验收。
- verify:content通过18节点图、两条15节点路径、演员/关节/附件/场景、字幕时间基准、来源/资源引用。verify:assets通过80张PNG的解码/透明覆盖/编码/CSV/哈希。release仍明确NOT_READY，结构成功不表示正式审定。
- t15-desktop.png、t15-mobile.png已查看并保留于docs/evidence，显示选择节点的宽窄屏文字布局；不属于正式产品视觉验收。
- 实际命令、修复原因与未测边界见 docs/verification.md。源码检查点以 tasks.json 中各任务 checkpointCommit / lastVerifiedCommit 为准，交接提交不改变已验证应用实现。
- 真实 IE11/IE 模式、实体手机/Safari、全剧情、整场 SAVE-01—07、性能、时长、情绪与正式资产/文化内容：未验收。
- 资源全部draft、许可unknown。sources.json登记7条文化资料及可读/索引/受阻状态，未复用外部媒体；没有正式素材/文化审定结论。

## 正式保存与恢复边界

- draft/backup/previous-project 存整份 Project JSON 字符串；raw-invalid 保留损坏原稿。T00 数据库保持独立。
- 普通编辑 500 ms 防抖、连续最长 2 秒，定时器只请求保存。编辑和立即命令共用串行队列，事务完成后才应用剧情候选。
- 保存比较 projectId、saveRevision 和完整已读内容 token；冲突暂停自动覆盖。新建、导入和恢复上一项目走同事务归档入口；新项目 backup 使用本项目有效基线，上一项目独立保留。
- 备份提升重读并核对原 draft/backup/隔离记录，原子隔离与提升；之后保存可继续。格式有效但未知的版本，以及超限原稿，均不自动降级覆盖。
- 失败候选与排队编辑可通过 getExportProject 导出；可原样重试、明确内存继续或取消。工作台编辑控件显示待提交稿，摘要仍显示实际应用的项目/节点。
- 导入作为新编辑项目生成新 projectId，但保留原 runId、决定与冻结角色；重新排演的新 projectId/runId 由后续 T15/T17 明确生成。原始记录诊断包不是作品 JSON。
- Project 默认 P0 录制字段 null；可选短片仅验证数据字段，不提供录制按钮或功能。姿态和录制动作实现留给相应任务。

## 下一位首先执行

1. 核对 Git、暂存区与端口，保留现有工程。用户的两个赛事 DOCX/PPTX 已暂存，未读取，也不混入本轮提交。
2. 优先领取 **T02**：建立正式产品hash路由与宽窄屏页面骨架，统一消费ProjectStore和已实现的剧情入口；不能另写localStorage或由路由组件任意推进节点。G1还差此项。
3. T15已可供消费：startStory/submitStoryCommand、storyEntry、reunionSummary与subtitlesForMode见剧情合同。默认/编辑稿开演的来源必须与实际行为一致；guard之外，T16还须实现挂载token和真实场面清理。若并行代码需独立工作树，先协调共享接口与边界。
4. **T04** 也已满足依赖：消费资产合同，在现有领域层接姿态/两骨手臂/正逆投影和双角色Canvas。不能把 T01 单角色中性检查页算作成影完成。
5. 随后按 T04/T07 → T05/T16 → T17 占位整场推进；P1 录制/分享仍在 G3 后，不能提前成为团圆必经步骤。
6. T11 在真实 IE 环境验生产包、完整二维路径与文件下载。ES5 检查及 Chromium 强制 legacy 加载不能替代该项。

## 交接与未完成

本轮T15已完成，当前没有占用中的应用任务。独立只读审查发现的导览字幕、默认造型来源与附件引用问题已修复并复核。T02、T04—T14、T16—T18仍待实施（T08/T12为G3后可选）。图形双路径、手动伸手、谢幕镜头、五区八展品、成果PNG与正式页面接入尚未完成。团队真实姓名/工时、实体设备、IE环境和官方提交时刻仍待落实。保留两张T15文字布局截图；本轮已逐文件、无Force/无递归清理5个临时诊断文件与空目录，test-results实际不存在。

T03 已验证源码检查点：bef273f2a5d13621c185a8289dee154514676102。后续交接提交只登记该 SHA，不改变应用实现。

T01 已验证源码检查点：15f9650119d97fffd2accea82f64c5a4e07be9fc；最后已验证实现以此为准。后续交接提交只登记证据，不改变应用实现。
