# 团圆成果与只读编排合同（T09）

日期：2026-10-18。消费ProjectV1/reunionSummary、Canvas、director-v1/story-play-v1及navigation-v1。不新增存档字段、故事节点或整场轨迹数据。

## 成果条件与节目单

`#/result`只对真实curtain/completed且含completedAt、冻结castSnapshot与approach的项目开放成果；其余状态显示实际进度与继续入口。成果ID始终为`runId:reunion`；导入复制项目改变projectId，仍保留本场runId/成果ID、完成时间、冻结外观和路线。

节目单显示母子角色、冻结纹样/配色、默认或编辑造型、已选路线、团圆时间与谢幕状态，以及本人确认的零组张宇翔（SpaceFly）署名。手动片段从本场路径已完成的interaction节点排除craft及assistedNodeIds推导；明确协助按实际记录列出，不将自动场面称手动操作。

普通error/unsaved/memory状态显示未保存说明，可导出当前已应用的有效团圆稿。未知版本、恢复/冲突、待提交候选与根操作锁不提供可变操作；待提交候选沿用“我的作品”的明确导出/重试/取消/内存继续入口。结果页不另开存储，不修改完成时间，也不从编辑稿生成本场造型。

## 稳定留影与编码

`createReunionArtifact(project)`先调用reunionSummary验证完整项目，返回独立`summary/frame`副本，未团圆抛错。场面读取reunion-hold入口与冻结外观/共纹，以现有`stagePlayFrame`恢复双偶稳定抱持，复用剧场远山透明度，保持母亲衣身可辨；没有瞬时鼠标姿态的持久化或伪造。

`mountReunionExporter(host,artifact)`返回`canvas`、`ready:Promise<void>`、`toBlob():Promise<Blob>`及幂等dispose。现有Canvas renderer先绘制完整1024×768源幕面，等待本地常规楷体就绪或最多3000ms回退系统字体，再一次合成到1600×1200输出并加标题、路线、纹样/配色、造型来源、UTC完成时间、短run标记及署名。合成完成或失败后释放源幕面；离页取消字体等待并释放，迟到字体不能重新合成。输出没有RAF或resize监听。1600×1200是输出尺寸，角色源幕面的采样仍遵守现有渲染预算。

T33将记录移至留影/下载概览下方的“本场行装、操演记录、终章信息”三组独立短卡，每卡使用语义化dl；未完成场仅显示当前进度。≤1180px概览与画面上下排列，记录≤1180px两列、≤700px一列。全部原记录与只读重演不变，布局不改变ProjectV1或完成条件。

ready只代表图像准备成功。资源/Canvas失败、toBlob抛错或null/空/非PNG、缺少编码能力都拒绝；legacy优先toBlob，否则使用msToBlob。重试通过销毁并重建导出器，实际重新加载资源。dispose拒绝准备/编码中的Promise并将Canvas尺寸归零，迟到图片或编码不能恢复页面。

`downloadResultBlob`支持msSaveOrOpenBlob或ObjectURL/下载链接，拒绝时如实反馈；返回清理函数撤计时器及URL，离页/换作品全部执行。JSON复用exportProjectJSON/downloadJSON，只导出当前显示的本场项目。页面只报告“已向浏览器请求下载”，不承诺文件已写盘。PNG编码完成后同时检查页面generation与当前操作锁；导入/新建进行中也不请求旧作品下载。

## 纯重演与播放生命周期

`createReunionReplay(project)`一次验证并复制已团圆项目，沿唯一已选路线读取next图生成14段（intro至curtain，不含completed或另一分支），每段时长为保存模式的targetMs。返回segments、总durationMs及sample(index,elapsedMs,reducedMotion?)；sample含frame、cues、allCues、lightLevel、shotLabel和ended。非法index抛错；负/NaN/-Infinity时间归零，+Infinity或超时固定末帧。零时长为立即ended的静止段。

采样复用导演、动作、几何目标与场面层，连制偶前段也使用本场冻结外观；操作段由程序编排招手/上路/架挡/灯影/落斧/伸手。返回帧独立可变，修改元数据/采样返回值不污染下一次或原项目。模块没有DOM、Store、剧情命令、计时器或RAF，也不产生过关观察；它是本场编排重演，不是完整操作录像。

`mountReunionReplay`读取上述纯模块，默认暂停；用户显式播放、暂停、从头重开、选择/前后片段。只有一个animation-clock，所有动作按绝对片段时间采样。资源切换期间暂停，ready后由用户继续；失焦、隐藏、超过250ms断档和异常暂停。减少动态不自动播放，用250ms步进看静止分镜；台词/本段全文仍可读。

PageView换作品/离页销毁播放器、时钟、媒体/页面/控件事件、字幕与Canvas，拒绝旧回调；普通保存回报不重置当前播放。根操作锁/待提交候选暂停重演。全过程不写原场run/revision/node、选择、外观、完成时间或成果ID。项目导入后仍默认暂停，保存能力失败时没有隐式重试。

## 后续边界

PNG与重演已使用T10原创皮影风格设计稿；只读重演仍静音，实际剧场可选合成短音，正式艺术与听感审定仍待T10；实体IE/手机/Safari与完整SAVE矩阵仍留T11。T09的SAVE-03证据覆盖本场JSON跨新浏览器导入、冻结留影和只读编排；不扩称全部恢复/兼容验收。T06已通过共享Canvas让编排幕面可主动展开同帧空间观察，机位不新增时钟或写原场；PNG导出仍直接调用二维renderer，不强制导入Three。接口见three-v1.md。
