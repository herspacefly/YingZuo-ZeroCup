# ProjectV1 数据与保存接口（T03）

日期：2026-10-16。依据主方案 7/11 节；首个实际数据版本为 schemaVersion 1。这里固定消费者接线方式，不改变四幕、双路径、P0/P1 的范围。

## 数据边界

- `src/domain/types.ts` 为完整 ProjectV1 结构；稳定 ID 和数值边界在 limits.ts。领域文件不导入 DOM、存储、渲染或 Three.js。
- 只接受普通 JSON 数据、完整白名单字段及资源 ID。拒绝函数、运行时实例、访问器、隐藏字段、数组附带属性、序列化钩子、循环与非有限数。标题最多 24 个 Unicode 码点；JSON 最多 512 KiB（UTF-8）。存档中的任意用户文字按普通文本显示。
- `validateProject` 返回独立副本，编辑稿、冻结角色、短片快照与调用者互不引用。已知展品与协助节点列表去重；未知 ID 拒绝。`serializeProject` 在验证后将 Pose 坐标/角度保留六位小数，不改变输入。
- T03 的关节外层边界为六位小数的 ±π；T01/T04 必须叠加具体模板限制。位置 `[0,1]`、scale `[.6,1]`、灯位 `[-.8,.8]`、偶幕距离 `[.05,.4]` 遵守主方案。
- 仅格式正确的未知正整数 schema/asset/definition 版本分类为 `unsupported-version`；损坏版本字段为 `invalid`。存储中超限数据也受保护，不能按普通损坏稿自动降级恢复。
- 首个实际存档不提供虚构的 v0/localStorage 迁移；以后改变字段含义必须升级并迁移。
- `intro/craft` 可无 castSnapshot，其后必须冻结；分支必须与决定匹配，决定来自 user；只有 curtain/completed 保留 completedAt。协助只能记录本路径已完成的互动节点及已看完的协助谢幕，不能把 training 分镜冒称操偶。T15 需复用这些 ID/路径约束。
- P1 只验证冻结快照的数据结构，不启用录制。完整片段 60—450 帧、partial 0—450 帧，固定 30 Hz、暂停态与时长一致；属于谢幕后的独立练习台。P0 默认两个字段均为 null。
- T07 基础动作预留 ID：wave-v1 / walk-v1 / bow-v1 / raise-axe-v1 / reach-v1，未知非空 presetId 拒绝。此处没有制作动作或录制器。

## 正式存储

`ProjectStorage` 使用 `yingzuo-v1`，`snapshots` 对象仓库。draft、backup、previous-project 存放完整 Project JSON 字符串；raw-invalid 存原始损坏记录及隔离时间。T00 探针库保持独立。

- `load()` 返回 empty / ready / recoverable / corrupt / unsupported，不自动覆盖任何记录。ready 含已验证 Project；恢复统一由上层以暂停状态接续。
- `save(candidate, baseline)` 在一个 readwrite 事务内检查 draft，旧有效 draft 写 backup，新稿写 draft；只在 oncomplete 返回本次实际提交结果。首次写入 revision 为 1，后续加 1。
- `baselineOf(project)` 包含 projectId、saveRevision 和完整已读内容 token。额外内容比较防止恢复旧备份后版本号碰巧重合，让旧页面覆盖恢复稿。token 只是运行时比较依据，不是 Project 字段。
- `replace(candidate, baseline, acknowledgePrevious)` 同事务归档当前有效项目、写新稿和备份。新项目的 backup 初始化为该新项目，避免损坏时误恢复另一项目；previous-project 独立保留上一项目。普通保存永不写 previous-project。
- 导入为新项目产生新 projectId/saveRevision=0，保留原 runId、决定和冻结配置。恢复上一项目使用其原 projectId 和递增版本；重新排演生成新 projectId/runId 属 T15/T17 的明确操作。
- `promoteBackup(observation, acknowledgeQuarantine)` 重读原 draft/backup/raw-invalid 并按原始内容比较；保存原损坏 draft 到 raw-invalid、提升有效备份，backup 不被损坏稿覆盖。成功结果建立新的保存基线，之后可继续编辑、保存和重开。
- `startAfterCorruption` 仅允许双损坏状态下明确新建；同事务隔离两个损坏原稿，写新稿和新备份，保留 previous-project。
- 已有 previous-project 或 raw-invalid 再被替换前，接口默认拒绝，供上层提供导出与明确选择。未知版本始终不自动降级覆盖。
- 恢复 observation 使用区分类型的 token，不将 NaN 折成 null、undefined 字段丢掉或循环对象展开错误。无法安全比较的原始类型会停止覆盖。`serializeRawRecords` 生成带类型的原始记录诊断包，保留字符串原稿及非 JSON 的损坏值；诊断包不是 Project 文件，不可当作品导入。
- 同一实例读写串行；不同实例/页面靠事务内比较仲裁。conflict/quota/abort/unavailable 均不返回假成功，调用方保留内存稿。

## 应用的唯一保存入口

页面通过 `ProjectStore` 修改数据，不能各自直写 IndexedDB。

| 接口 | 含义 |
| --- | --- |
| `ProjectStore.open(storage, environment)` | 读取并分类原稿；无稿时建立新 Project。无存储时保留可导出的内存稿，显示未保存 |
| `edit(command)` | 编辑命令串行应用；500 ms 防抖、连续最长 2 秒；定时器只请求保存，执行时读取最新整体状态 |
| `flush()` | 明确立即保存当前编辑稿；冲突后不自动重试覆盖 |
| `commit(reducer)` | T15 提供验证 run/revision/node 的纯 reducer；返回 null 的旧命令不写入。保存成功才应用候选、允许后续页面卸载 |
| `retryPending()` | 重试已生成候选，避免重新创建 runId/completedAt；之后按顺序应用期间排队的编辑 |
| `getExportProject()` | 取待保存候选与排队编辑的独立副本；不会推进当前节点或修改保存状态 |
| `continuePendingUnsaved()` | 用户明确选择仅在页面内继续；持续标为未保存，需明确保存或导出 |
| `cancelPending()` | 明确取消待提交操作，保留原项目与排队编辑；不会改动磁盘归档 |
| `newProject / restorePrevious` | 保存当前有效编辑后，通过原子归档入口替换；失败候选保留，可重试或取消 |
| `restoreBackup / startAfterCorruption` | 使用读取时的 observation 明确恢复；确认期间数据变化则拒绝 |
| `takeOver()` | 仅用户明确接管时重读当前稿，再用新基线进行事务比较；不同 projectId 或不支持格式仍拒绝 |
| `dispose()` | 清掉防抖、最长等待、订阅和连接；旧定时器不写入 |

更改单个外观字段应使用 PALETTE/PATTERN 命令，让字段在队列执行时应用到最新外观；APPEARANCE 仅用于明确整体替换，避免页面捕获旧外观覆盖其他排队修改。

待提交时，标题/外观编辑控件从 getExportProject 读取候选及排队编辑，项目身份/剧情摘要仍显示 getState 的实际应用状态；不能每次订阅回调用旧稿回填编辑框，否则会丢掉连续输入。

`project.html` 是数据工程检查工作台，使用上述正式接口。T15已在独立story.html中通过guarded reducer接入文字排演与剧情提交，见story-v1.md；T02/T05/T16/T17再接正式页面和图形交互。文字排演不代表完整SAVE/UI/IE验收。
