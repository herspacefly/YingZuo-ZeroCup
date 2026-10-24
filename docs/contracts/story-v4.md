# v4 灯火、播放与灯影消费者契约

2026-10-24。新开演 definitionVersion=4，已知1/2/3/4按各自JSON恢复、文字排演、成果及重演，其他版本继续保护。ProjectV1/schemaVersion=1和assetVersion=1保持；新剧本仍36节点、两路线五终章，各路径21节点，保留v3长篇时长及独立导览。v3契约中“4为未知版本”现由本契约替代。

## 衣饰与剧情

RenderActor.costumeTreatment可选original-texture/legacy-motif，缺省legacy-motif供历史消费者兼容。新制偶/练习/灯影与v4故事、成果、重演显式original-texture；配色与色槽仍生效，patternId/carvedSegments/sharedMotif保留序列化读取，但不在这些视图附加图案或镂空。展馆独立刻纹示意可显式legacy-motif，不修改角色编辑稿。v1—v3冻结演出保留原版本图文。

v4以灯火呼应替代共纹相认；灯影任务region=lantern读取实际灯笼附件投影边界，协助也必须达到同一几何条件。结局仍由明确选择决定。

## 台词定位与定场

CueSeek={nodeToken,mode,cueIndex}只解析当前片段、当前模式字幕时间；导览全文只读。准备/保存/达标候选/定场放映/终止节点禁用定位。有效定位停止输入，清空任务观察、按键、协助和手部操作证据，从标准入口重新采样至对应台词，保留原播放/暂停状态；不能产生提交或跨节点。声音停止当前声源并将已越过cue标记消费，不追补音效。存档不记录定位时间。

只读成果重演在幕面ready、blocked状态变化时同步刷新目录可用性，不需要先播放一帧，不引入Store或写入路径。定场放映继续复用唯一导演时钟及一次候选保存。

## 默认声音与清理

StageAudioSession为document级对象，音乐与效果意图默认true，不写作品或浏览器偏好；手动静音跨路由保留，刷新重新默认开启。先尝试自动播放，受浏览器策略限制时在有效pointerup/touchend/click/keydown同步play/resume，去重同次手势，不逐帧重试。blocked与muted状态区分。版本化音效按实际definitionVersion映射；重开、定位与可见性/保存状态原子同步，静候前两秒保持安静。

resetLocalHistory单独排队、隔离旧任务并取消定时保存；一个事务删除yingzuo-v1/snapshots的draft/backup/previous-project/raw-invalid并写新projectId、revision1的初始草稿。失败回滚且保留可导出作品；旧标签页CAS冲突不能写回。只清当前站点同源应用数据，不动其他网站、下载文件或源资源。

## 灯影与人物

StageConfig.lampGeometry?:{version:1,depth:number}缺省depth=1.2，LAMP_POSITION原子更新lampX/lampDepth。灯深度范围[max(.6,3*puppetDistance),2.4]；旧puppetDistance仍表示偶幕距离。所有投影及逆变换读取同一几何：m=L/(L-d)，x'=lampX+m*(x-lampX)，y'=m*y。

工坊固定影偶站位、大小及姿态，不因拖灯自动适配；幕影由actor alpha独立绘制，不含背景。默认懒加载三维，灯具仅在水平x/z平面拖动，初始化/模块失败/上下文丢失回退完整二维并释放资源。射线、相机与Three对象不进存档。

斧头保留下段斧柄握点，附件gripMotion=axe-wrist-v1从肩肘导出受限角补偿；Canvas/Three/边界/PNG共用attachmentTransform，灯笼依旧竖直。CablePresentation为瞬时source/bend，活动部位曲线最大.035世界单位，松开700ms衰减；静止直线延伸幕外，复用页面唯一时钟，取消输入立即清理。

装饰动效不驱动剧情：最多24粒光尘，IntersectionObserver入场，页面失焦/隐藏暂停，减少动态与总开关关闭装饰。展馆传统硬杆科普不受数字柔线表现改变。
