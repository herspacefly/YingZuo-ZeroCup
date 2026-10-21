# 扩展剧本与空间分镜契约

v1 contract继续对旧记录生效；definitionVersion 2使用reunion-v2.json，新开演显式传2，不修改v1 JSON。入口currentStoryNode、storyEntry、恢复、成果、展馆、文字协助与重演均选择definitionFor(story)。

- StoryProgress的v2记录严格包含ending和endingSource；选择前两者为null，选择后必须是合法EndingId及user。v1禁止这些字段。选择前的节点不得预填后续选择；节点、路线、终章、已协助节点必须属于同一有效路径。
- EndingId为home/light/road/waiting/sacrifice；CHOOSE_ENDING只能在ending-choice提交并携带runId/revision/nodeId。操作协助、失误与偏好不生成终章选择。v2原三种结局字段含义不变。
- v2共有36节点，十路径各21节点，后记完成进入curtain时唯一记录completedAt；静候节点需用户看完后确认，谢幕再进入completed。重试使用同一Store候选，不重复完成时间或成果ID。
- reunionSummary兼容旧名称，v2返回definitionVersion、ending及runId:ending:endingId。所有成果画面、PNG标题、节目单和只读重演必须使用本场结局；非home不得套用旧团圆握手构图。
- 剧情只保存稳定节点与冻结造型，拖动/按键/IK/时钟/SpatialPresentation/相机不进入ProjectV1。直接输入与旧控件共用同一Pose，保留原几何门槛；单独摆腿不生成任务参与标记，最后伸手另需右手操作或明确协助。

## 空间接口

CanvasFrame可携带可序列化的spatial:SpatialPresentation。字段为nodeId、progress（0..1）、light（0..1）、reducedMotion、ending、backstage，由导演采样，不提供推进剧情的函数。prepareFrame保留并校验分镜数据；stagePlayFrame保持同一来源。

mountThreeStage新增observe(yaw,pitch,zoom,actorId)，限制拖转与缩放；setView支持story/character及旧四机位。仅renderers/three导入Three，update仍拒绝迟到资源和帧。空间收起、失败、context lost与dispose清理geometry/material/texture/监听，不拥有额外RAF。

旧四机位提供观察锚点，observe同样可受限偏转及缩放。普通GPU采用受光漫反射；检测到软件GPU时仅降低空间绘制缓冲至至多512宽，并采用烘焙面光/分镜调光。原始纹理和二维/PNG画质不因此改变。该预算不等同于性能验收通过。

同一故事控制器跨短幕通过spatialPreference/restoreSpatial传递瞬时观察偏好；用户从未展开时不建WebGL，上次离页/作品切换不持久继承。轻量二维仍释放空间并禁用展开。减少动态的剧情镜头使用固定位置与分镜静帧。
