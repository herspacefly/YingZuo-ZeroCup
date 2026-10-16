# 当前开发状态与交接

更新日期：2026-10-16。当前执行者 codex-root；实际分支 main。

## 当前阶段与运行入口

**T00、T03 已完成；G1 仍待 T02 正式页面与导航。**

- Node v24.18.1 / npm 12.0.2；TypeScript 7.0.2、Vite 7.3.7 / legacy 7.2.1，依赖和 package-lock.json 本轮未变。
- `npm ci` 恢复依赖，`npm run dev` 启动。当前会话已启动 http://127.0.0.1:5173/，project.html HTTP 200；换会话需先核对实际端口。
- index.html 为原 T00 灯影试作，probe.html 使用独立探针库。project.html 是 T03 正式存档工作台，使用 yingzuo-v1/snapshots；完整演出与产品 hash 页面尚未接入。
- 正式数据包含编辑外观、冻结角色、稳定剧情节点与决定、展品访问、P1 可空字段；严格拒绝坏数据与未知版本。T03 未实现录制、Three.js 或真实剧情推进。
- 实际源文件与接口见 src/domain、src/persistence、src/app/store.ts、commands.ts、identity.ts；消费者先读 docs/contracts/project-v1.md。

## 本轮实际检查

- 4 个单元测试文件，80/80 通过，覆盖 DATA-01—05、事务回滚/配额/两写入者、备份提升后继续保存、原始内容比较、串行队列/防抖/立即提交与失败候选。
- 类型检查与生产构建通过；三个 HTML 有 modern/legacy 入口，6 份 legacy JS 通过 ES5 解析。
- 生产包浏览器检查最终 34/34，Chromium 156.0.8078.4：桌面 1440×900、模拟手机 390×844，各 17 项。包括 T00 检查，以及真实自动保存/刷新、文件往返、冻结配置、上一项目、损坏/未来版本、双标签冲突、禁止存储、legacy 运行与待提交连续输入。
- 工作台截图已查看并保留 docs/evidence/t03-desktop.png、t03-mobile.png；只是工程检查界面，不是正式产品视觉验收。
- 实际命令、修复原因与未测边界见 docs/verification.md。源码检查点以 tasks.json 中各任务 checkpointCommit / lastVerifiedCommit 为准，交接提交不改变已验证应用实现。
- 真实 IE11/IE 模式、实体手机/Safari、全剧情、整场 SAVE-01—07、性能、时长、情绪与正式资产/文化内容：未验收。
- verify:assets 未改，正式清单尚缺，仍按契约报告 NOT_READY/退出码 2；没有素材审定结论。verify:content 尚未由 T15 建立。

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
2. 优先领取 **T01**：按既定稳定 ID、坐标、pivot/关节契约交三角色占位分件、遮罩/山片和资产清单。实际姿态模板需在 T03 外层数值边界内提供更严格限制。
3. **T02** 已满足依赖，可独立建立产品 hash 路由、页面与宽窄屏骨架，并消费 ProjectStore，不能再另写一套 localStorage。若并行代码需独立工作树，先协调共享接口与文件边界。
4. T01 完成后可做 T15 文字全剧和 guarded reducer，经 ProjectStore.commit 持久化；null 旧命令不写入，实际 run/revision/node 验证仍由 T15 实现。
5. 随后按 T04/T07 → T05/T16 → T17 占位整场推进；P1 录制/分享仍在 G3 后，不能提前成为团圆必经步骤。
6. T11 在真实 IE 环境验生产包、完整二维路径与文件下载。ES5 检查及 Chromium 强制 legacy 加载不能替代该项。

## 交接与未完成

当前没有在修改的应用代码；T03 已完成并可交接，下一任务尚未领取。T01/T02/T04—T18（含 G3 后可选 T08/T12）仍待实施。角色、全剧双路径、最后伸手、谢幕、五区八展品、成果与正式页面接入尚未完成。团队真实姓名/工时、实体设备、IE 环境和官方提交时刻仍待落实。保留两张 T03 截图作为布局诊断，其余本轮临时测试输出收尾删除。
