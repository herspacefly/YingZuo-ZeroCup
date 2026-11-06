# 正式演出：四次选择与累计终章契约

2026-11-04，T46。应用只提供一份正式剧本 `src/content/stories/reunion.json`，完整/导览是同一故事的两种节奏。旧四份剧本及兼容播放分支已移除，旧演出存档不再加载；读取时保护原始记录，提供导出原始数据和明确重新开始入口，不自动迁移或清空。现有当前场次保持原进度；内部 `definitionVersion=5` 仅是已发行数据的识别值，不作为产品名称。ProjectV1/schemaVersion=1、assetVersion=1 与原始MP3保持。

## 剧本与四次选择

正式故事共 38 节点，每条完整路径 23 节点。沿用原角色、美术、资产引用、场面、灯火相认与完整二维；只有沉香可控，同屏最多两角色。所有非 craft/completed 节点的完整/导览对白从 0 连续至目标时间，minDurationMs=targetMs；独立导览字幕仍使用 full-target-ms 时间基准，由 subtitlesForMode 映射。

当前静态编排的每路径节点目标合计为完整 1125 秒、导览 418 秒；包含可提前确认的制偶阅读，操偶、思考、定场和暂停另计。新增及改写对白按各段字数分配连续字幕时间，较长的山前选择延至完整 50 秒/导览 22 秒。以上是编排目标，不是实测体验或配音时长。

四次选择在对应片段就绪后可随时由用户明确确认，包括对白播放中和主动暂停时；无需等对白结束。确认即停止当前片段的声音与时钟，经保存后进入下一段；不能由跳段、协助、默认选项、动画结束或自动开演代选。两新增节点复用相邻场面，选择本身不改变编辑稿或冻结造型。

| 次序 | 节点及顺序 | 用户决定 | 命令 |
|---|---|---|---|
| 1 | road-rest → journey-choice → training | home：接母亲回家；open-road：为后来人留路 | CHOOSE_JOURNEY |
| 2 | guardian-parley → mountain-pact-choice → approach-choice | shared：请二郎神共同承山；self：由沉香独自承山 | CHOOSE_PACT |
| 3 | 原 approach-choice，两路线不变 | call-first：先呼唤；split-first：先开山 | 原 CHOOSE |
| 4 | 原 ending-choice，改题“最后一斧，如何落下” | wait：暂缓最后一斧；fulfill：继续承担说清的后果 | CHOOSE_FINAL_ACTION |

两新增节点 kind=choice、completion.kind=choice、next.default 指向上表下一节点，分别只接受 SET_MODE 与对应选择命令。末尾仍使用原五终章出口映射，不接受直接指定终章的命令，也不显示五个结局选项。末次继续按钮按本场承山决定说明实际行动：共同承山为“请大家稳山，再解开封印”；独自承山为“由我承山，换母亲自由（永久化为山影）”。

行路愿望是沉香此刻的心愿，不替母亲安排自由以后的生活。mountain-listen 与末尾对白根据已选决定回顾来路，母亲亲口回应去处；共同承山且先开山时，她提出先与沉香同行认路，再决定日后生活。守灯须以解除封印、母亲自愿且可自由离开为前提。独自承山的选项、对白和末次继续按钮都须明示永久化山、失去归家与人间未来；母亲的反对、失去与哀悼保留，不把牺牲描写成爱的义务。

## 16 组合的确定性规则

纯函数 resolveEnding(journeyIntent, mountainPact, approach, finalAction) 是终章派生的唯一规则，不使用分数、手速、协助次数、随机数或播放状态。

| 行路愿望 | 承山决定 | 山前路线 | 最后 wait | 最后 fulfill |
|---|---|---|---|---|
| home | shared | call-first | waiting | home |
| open-road | shared | call-first | waiting | light |
| home | shared | split-first | waiting | road |
| open-road | shared | split-first | waiting | road |
| home | self | call-first | waiting | sacrifice |
| open-road | self | call-first | waiting | sacrifice |
| home | self | split-first | waiting | sacrifice |
| open-road | self | split-first | waiting | sacrifice |

优先顺序固定：wait → waiting；否则 self → sacrifice；否则 split-first → road；否则 home 愿望 → home，open-road 愿望 → light。所有五终章均可到达，每次选择至少有改变终章的对照组合。暂缓可以收住此前承诺，不能被前面的 self 选择自动推进成悲剧。

五条原终章及各自操偶、静候、后记和谢幕继续使用。waiting 的封印未解，不能显示为已获自由；sacrifice 的沉香永久化山，不能显示为归家或日后可恢复人身。结束时记录本场真实四次选择，成果、PNG、全文与重演均据此复现，不再要求补选终章。

## 状态与消费者接口

StoryProgress 的 definitionVersion 固定为内部识别值5；approach/approachSource 保留。必须包含 choices={journeyIntent:null|'home'|'open-road',mountainPact:null|'shared'|'self',finalAction:null|'wait'|'fulfill'}。进入演出时三个值为 null；每项在对应选择前必须为 null，完成该选择后必须有合法用户决定。endingSource 必须为 null|'choices'，ending 和 choices 均不可缺省。

CHOOSE_JOURNEY、CHOOSE_PACT 与 CHOOSE_FINAL_ACTION 继续验证 runId/revision/nodeId、当前节点和冻结角色，使用原串行保存事务。四类选择命令不再要求对白时长门槛，操偶与过场完成继续使用原门槛。CHOOSE_FINAL_ACTION 在同一纯 reducer 操作中记录 finalAction、派生 ending/endingSource 并转入对应原终章；不得先保存决定再用第二次异步提交计算结局。重复点击、旧 revision 和迟到回调不重复生效。

路径、存档校验和只读重演都读取这组决定。末次选择前 ending/endingSource 为 null；选择后必须与 resolveEnding 的结果一致。导入时拒绝缺少已完成选择、提前出现选择、跨终章节点、篡改派生结局或非法版本；不通过静默修补替用户选择。schemaVersion 不变；其他剧本识别值均返回 unsupported-version，原始数据受保护。

当前draft/backup有效而previous-project是已知退役格式时，明确确认替换归档可原子归档当前项目并新开场次。此例外仅用于识别并丢弃上一项目，不加载或迁移旧故事；未确认、未知未来格式、混合未来字段及draft/backup中的退役数据继续受保护。

所有消费者统一采用 original-texture、lantern-region、台词定位和定场放映，不保留按旧剧本分流的逻辑。运行时对白回顾仅从持久选择派生，不写入存档、不修改原定义；文字和重演也应显示同一回顾。

## T45 终章节目单

正式谢幕写入completed检查点后自动打开节目单，且替换剧场的当前历史项，返回键不会反复进入已完成剧场。curtain之前或保存失败/未处理候选不会自动跳转；明确仅在本页继续的完成记录可显示节目单，同时保留未保存提示。教学/重演保持隔离，不触发正式完成导航。

成果页与PNG共用只读展示模型，列出四项真实选择并突出本场实际决定因素。解释按既有resolveEnding规则：暂缓优先，其次独自承山、先开山，最后才区分行路愿望；相守不写成解除封印，化山不写成日后归来。归家/守灯/同行/相守/化山印章只表达终章，不评判操作技术。PNG保持1600×1200和场景4:3，页面盖印动画不影响下载。

选定终章仍不等于演出完成。进入真实成果检查点前，节目单显示“这一场，还在路上。”和当前进度，不提前显示终章结果、印章或下载入口。

## 验证边界

必要覆盖为 16 组合 × 完整/导览、38 节点可达及每路径 23 节点、两新增选择和末次行动前后的 JSON 往返恢复、旧 guard/重复点击、不能跳过或代选、派生结局篡改拒绝，以及成果/PNG/重演与本场四次选择一致。退役或未知的剧本识别值只验证拒绝加载、保留原始数据及显式重新开始。字符数、标称时间及自动化路径不作为真人完整体验或配音听感的证明。

本轮内容不压缩、删减或替换原美术和音频。台词配音属于独立输入；若配音会话修改正在编辑的同一节点、字幕时间或引用文件，停止对冲突文件的写入并报告具体文件及需用户协调的动作。

## T38 中文配音时间适配

2026-10-27 经作者核对现状后批准接入：`voice.json` 保存角色、原文、合成参数、文件摘要与实测时长。`voice-arrangement.ts` 在实际选择派生对白后生成瞬时节点，不改原剧本 JSON 或 ProjectV1。完整/导览分别按同句所有合法变体的最长音频加至少400ms排时；视觉时间映射回原动作锚点。操偶及过场的领域完成门槛、字幕定位、导演与成果重演共用该编排，不能再用原 JSON 的标称时间提交完成。

配音默认开启且与音乐独立；原生人声 playing 期间音乐降至原音量25%，等待、结束和清理恢复。谢幕对白结束后保留原40秒唱段；暂停、定位、切章、失焦、后台、教学、保存阻塞及离页遵守既有撤销规则。媒体事件不能推进故事，迟到回调不能复活旧播放，`playing` 回调不得无条件重写 currentTime 形成 seek 循环。字幕和画面可在配音受阻时继续，重试按当前偏移开始。每次实际进入正式剧场都重置为配音开启，同页手动静音有效；入场不改变音乐或音效开关，隔离教学不触发正式配音。浏览器限制时提供一次点击解锁/重试，不以开关状态冒称实际起声。
