# T15 剧本、命令与接续合同

日期：2026-10-16。消费者为T02/T05/T07/T09/T16/T17/T18；ProjectV1存档字段及含义延续主方案与ProjectV1合同，没有新增轨迹/时钟存档。

## 剧本数据

`src/content/stories/reunion-v1.json` 是首个实际剧本，storyId=reunion、definitionVersion=1、assetVersion=1。共18个节点，每条路径经过15个节点：

```text
intro → craft → memory-wave → memory-separate → road → training → guardian → approach-choice
  call-first:  call-light → call-response → call-split
  split-first: split-axe → split-search → split-response
→ reunion-reach → reunion-hold → curtain → completed
```

节点含kind、四幕标题与原创文字、actors、entryPoses、entryStage、entrySceneLayers、entryAttachments、字幕、两模式节奏、动作/完成条件/出口、前置条件、资源/来源ID。仅沉香可控，母亲与二郎神脚本控制；同屏最多两人。training是分镜，不能冒称用户操偶或协助操作。

entryPoses补齐九关节并服从T01模板限制；简化角色未使用关节为0。entryStage和图层是节点独立初值，不读取可变Project.stage。附件显式列出宿主角色与模板attachmentId，所需PNG必须在assetIds。mountain初始开合、尘幕与两条事件顺序对应，T16再负责按节点实际调度。

字幕的唯一时间基准为`subtitleTimebase: full-target-ms`。T16使用`subtitlesForMode(node, mode)`：full原样，guided按guidedTiming.targetMs/fullTiming.targetMs同比例映射所有字幕；不能直接把full时刻用于guided。targetMs表示设计节奏，操作节点可无限等待；minDurationMs是过场最短播放时间。reunion-hold两模式至少4秒，并且需要用户点击谢幕；计时本身不能直接提交。

完成条件保存归一化目标与阈值：寻光覆盖至少35%、稳定600ms；举斧稳定500ms后落下；伸手距离≤幕宽4%，小幅收束≤2%。T15只检查输入证据的种类、有限范围及阈值，不实现IK/命中/物理可达性；实际检测、暂停计时、协助片段、键盘路径由T04/T07/T16/T17完成并验收。

对白、记忆同台、共同纹样及互动顺序标为original-adaptation；C3/C4核对剧目，C5仅核对京剧梗概，不是完整皮影戏本。verify:content通过不等于正式内容/美术/许可审定，发布审定留T10。

## 唯一剧情入口

`startStory(store, runId, mode)`经Store.commit初始化intro/revision=0。runId由显式开始动作生成一次，不在重挂载时生成；已有story时返回no-op。本页不在同一项目内重置旧演出。新项目走Store.newProject原子归档；“按旧编排再演”的只读运行器留T09。

`submitStoryCommand(store, command, context)`将命令/运行时观察复制一次，再交给纯函数`reduceStory(project, command, context, definition)`。命令统一包含`runId/expectedRevision/expectedNodeId`，先核对身份，旧身份返回null且不写入；当前身份动作/payload错误则明确失败并保留原稿。

| action | 允许与结果 |
| --- | --- |
| CHOOSE | 仅approach-choice；明确call-first或split-first，一次写决定、approachSource=user和分支入口 |
| COMPLETE_INTERACTION | 仅interaction；user提交对应evidence，assistance明确记录本节点。craft不能当协助；它需要用户确认造型 |
| COMPLETE_SCENE | 仅cinematic/curtain；过场满足最短时间后由script提交，reunion-hold必须user。仅intro可用user/skipped=true跳过；curtain可明确assistance |
| SET_MODE | 仅暂停时；改变节奏和revision，不换节点/决定/角色/完成时间。相同模式no-op；成功后重挂载原短节点 |

每次有效命令仅revision+1，saveRevision由存储事务独立维护。completed无推进出口，仍可暂停切模式；revision耗尽时停止覆盖。进入curtain时从传入context.now写一次completedAt，后续谢幕、模式变化、恢复与候选重试均保留。

context中的paused、elapsedMs、now来自当前挂载节点，不能来自存档。它们不是安全授权凭据；T16负责验证NodeScope token、冻结/恢复时钟、丢弃旧回调，不能把任意动画回调直接当推进依据。

## 冻结与真实参与

craft的user evidence为`{kind:'craft', presetAppearanceUsed:boolean}`，必须对应明确选择：

- false：从Store队列执行时最新appearance深拷贝冻结；表示使用用户确认的编辑稿，不能带页面捕获的旧appearance。
- true：采用defaultAppearance作为本场默认影偶，并标记预设。编辑稿保留；默认造型不会伪装成用户手工制作。

sharedMotif取实际冻结appearance.patternId；母亲与二郎神使用固定色板。后续编辑、切模式都不重新冻结。guided不自动给所有片段记协助；只有明确提交assistance的本路径已完成节点才记录，curtain在走到completed时才可入协助列表。

`reunionSummary(project)`只在curtain/completed返回派生摘要，ID恒为`runId + ':reunion'`。摘要不另存进度表；它读取冻结配置、决定、协助记录、预设标记与一次完成时间。进入展馆/结果/练习台仍由普通路由命令处理，不推进剧情。

## 保存失败与重挂载

命令经Store.commit立即生成候选。事务完成前，getState().project仍为旧节点；getExportProject可导出候选。失败后不卸载原节点，显示未保存，可重试原候选、导出、取消，或明确仅在本页继续。retryPending不重跑reducer，不重新生成runId或completedAt。并发/未知版本保护沿用T03。

`storyEntry(project, definition, generation)`返回节点初值的独立副本、当前guard和新挂载token，始终paused=true/elapsedMs=0。generation为调用者管理的临时计数；同revision内重挂载也需更新它。T16已用NodeScope在队列内核对token，复用唯一时钟；自动场须播满targetMs，退出清理与下一幕保留旧帧见[导演合同](director-v1.md)。互动及用户谢幕不能由该自动入口完成。

`story.html`是文字检查页：操作段用明确文字协助，过场有可暂停时钟，页面隐藏/失焦/超过250ms停顿时暂停；刷新或模式变化重开当前短节点。没有动画、声音、手动操偶、完整展馆或成果PNG；不能据此声称STORY-03—06全部图形流程已验收。
