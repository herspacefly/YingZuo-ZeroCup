# T16 节点导演与清理接口

日期：2026-10-17。消费story-v1、canvas-v1、practice-v1；ProjectV1与资产版本不变。导演使用原创皮影风格设计稿与完整字幕；T10剧场可明确开启有限合成短音，不代表正式艺术/听感审定。

## 纯数据导演

`createSceneDirector(project, entry)`校验当前guard，捕获本节点、模式、外观和共纹的独立副本，返回`durationMs`与`sample(elapsedMs, input?, reducedMotion?)`。冻结后只读castSnapshot；intro/craft尚未冻结时捕获当时编辑Appearance。Stage/Pose始终来自节点entry字段，不读取可编辑Project.stage/pose。

sample只返回`frame/elapsedMs/durationMs/ended/automatic/cues/lightLevel/shotLabel`，不写Store、不调用DOM/RAF、不提交完成。负数/NaN归0，正Infinity与超时保持末帧。帧含受约束姿态、附件bbox、场景白名单参数，最多两演员；input只接受沉香Pose与灯位/距离，固定角色保持自身色板及有限脚本。

时长取当前模式targetMs，字幕用subtitlesForMode，半开时间段命中；末帧保留恰好结束于片段终点的字幕。序幕完整18秒/导览10秒：点灯、分离、操偶杆示意、备行装。有限脚本覆盖分离、学艺、两路回应、谢幕；呼唤回应不提前开山。减少动态使用独立视觉分镜点，字幕仍按真实模式时间；单台词场面也能看见得斧、回应与幕后显杆。shotLabel是二维调度说明，不冒称Three镜头。

## 唯一时钟与NodeScope

`createNodeScope(token,onError)`拥有当前挂载实例，提供只读token/active、isCurrent、own、guard、listen、timeout、audio与dispose。own的返回函数只注销；退出后新注册立即清理。dispose先失活，再逆序释放全部资源，支持重入，错误报告后继续清理；reporter也失败时，全部清理后抛带errors的报告错误。guard保留this/参数/正常返回，失活后不执行。

listen/timeout保护迟到事件，audio仅登记退出时暂停并归零，不启动播放。当前没有实际声音资源，音频清理只用可控media替身验证。

每次进入、切模式或重开都有新storyEntry generation。当前scope持有一个animation-clock，Renderer没有第二RAF。失焦、隐藏、异常或大于250ms断档暂停，不补墙钟；恢复默认从当前短节点0毫秒暂停重建。普通路由草稿自动保存不打断播放；全局durable锁或待提交候选会暂停。

## 提交、失败与下一幕

`submitScopedSceneCommand(store,scope,command,observation)`复制命令/观察，在Store串行队列内部同时核对活跃token和runId/revision/nodeId。自动场还要求cinematic/curtain、scene/automatic、未暂停、达到当前模式targetMs；其他节点不能凭时间结束。自动结束在暂停UI前捕获运行观察，只请求一次。序幕skip仅接受用户明确动作，出口只能到craft；SET_MODE须暂停并持久化，成功的新revision重新挂载且暂停。

保存失败时保留已应用节点与末帧，候选交给全局重试/导出/取消/内存继续，不重新构造候选身份。取消后可在同一末帧重新确认，不强迫重播。memory/error播放结束不会自动重试磁盘；需点“确认进入下一段”。

新节点用独立待显示canvasStage准备资源。旧scope已经退出、时钟停止，但旧Canvas与字幕作为静态显示保留；新stage ready后才一起替换并释放旧像素。加载失败显示真实错误与重试，离页同时销毁待显示和已显示stage，迟到图片不能夺回页面。shared canvasStage新增resize/retry方法，原单stage失败清空规则不变。

## T17 图形整场消费者

T17复用本导演、NodeScope与唯一时钟接沉香输入、实际几何观察、明确协助、唯一分支和用户谢幕，详见[图形整场合同](story-play-v1.md)。只有互动段传入临时Pose/灯控，自动短场面仍保留导演脚本；操作时间超过targetMs不会自行完成。舞台回应、显影和山片开合由纯stagePlayFrame消费真实成功后的阶段，不将ended当互动成功。

reunion-hold播满4秒只开放用户“谢幕”，刷新使用确定的稳定手点构图。瞬时姿态/协助时间不入存档；失败、取消和明确内存继续沿用本合同。完整SAVE矩阵、实际时长/情绪/性能、实体设备及正式美术仍需各自验收。

T10声音由story/controller的createStageSound统一拥有，sample传同一rt.elapsed/mode；点击播放先发当前时刻以保留0ms cue，实际interaction evidence开始resolution时才发送开山/寻光/握手事件。stop/closeScope先发playing:false，重开reset，页面dispose关闭context；没有音频RAF或存档字段。声音故障不推进或阻断剧情，详见audio-v1.md。
