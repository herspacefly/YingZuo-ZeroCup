# 当前开发状态与交接

更新日期：2026-10-17。codex-root；实际分支main。用户暂存的赛事DOCX/PPTX未读取、未改动，两个暂存blob保持原值，不包含在开发提交。

## 当前阶段与入口

**T00、T03、T01、T15、T02、T04及T07已完成；当前无任务占用。下一项优先T05刻纹/灯控/确认冻结。**

- 环境仍为Node v24.18.1 / npm12.0.2、TypeScript7.0.2、Vite7.3.7 / legacy7.2.1；依赖与锁未变。npm ci恢复、npm run dev启动。5173实际响应200，复用既有开发服务。
- 产品首页有八根hash与E01—E08目录，共用一个ProjectStore。craft有编辑沉香/母亲双角色预览与配色/纹样；母亲共纹来自本场冻结快照。light仍为编辑舞台预览，刻纹/灯控尚待T05。
- practice已能身杆/左右手杆拖动，鼠标、Pointer触屏与Touch回退、方向按钮/握柄方向键、原生range、镜像/大小；五动作按时间演示、暂停继续、250ms步进。失焦/隐藏/长卡顿暂停，反复进出清理。高视口滚动控制区时保留幕面。
- 练习只保存编辑Pose，恢复默认暂停，不改既有剧情/冻结造型/选择/完成时间，也不启动新演出/录制。保存失败可导出最终稿；memory/error自动操作不重试写盘，明确保存才尝试。
- story只显示当前节点入口构图/冻结外观/场景附件并暂停，图形导演和整场手动操偶仍待T16/T17。文字排演story.html可走完整/导览两路径并存档；project/assets/study/probe.html保留独立检查入口。
- 80张几何占位PNG全部draft/unknown，正式人物/场景/声音/文化与许可留T10；展馆仍是目录，成果PNG、Three、图形全剧与P1录制/分享未实施。

## 本轮实际验证（T07）

- npm test：15文件209/209通过，新增32项。动作/有限几何观察20项、杆输入4项、共享时钟8项，覆盖绝对采样、60/120Hz等时、暂停/250ms断档/取消与迟到回调、镜像缩放/灯位/手杆IK和含斧头的实际边界。
- 最终npm run build含typecheck通过；六HTML仍有modern/legacy入口，verify:legacy确认13份legacy JS为ES5。构建后的源码未再变动。
- 最终npm run test:e2e -- --workers=2：122/122通过，2.6分钟。Chromium156.0.8078.4，1440×900桌面与390×844模拟手机各61项。新增22项练习流程，原100项回归通过。
- 浏览器覆盖真实鼠标三握柄、CDP触屏拖动/取消、无Pointer时Touch identifier/多触点结束、握柄持续按键/失焦/原生range键盘、快速末次input尾随/刷新、五动作与附件边界、暂停/继续/隐藏/长卡顿/减少动态、导入归档末姿态而新项目不被旧帧覆盖、保存失败可导出且不自动重试、内存继续直到明确保存、Canvas故障与10次播放进出后应用事件/RAF/旧Canvas释放。
- verify:assets通过80张PNG解码/alpha/区域/引用/CSV/哈希；verify:content通过18节点/两路径；verify:state通过19任务。release门禁仍未就绪，本轮未重复未改动的正式门禁。
- 只读审查发现并修复：下拉stop刷新重置旧值、<200ms滑块末次遗漏、新附件未重算边界、自动flush绕过memory/error保护。最终复核无新增阻塞；相应真实流程有回归。
- 初轮e2e诊断中的归档key误写previousProject，已按实际previous-project核对；事件计数把Playwright晚装的8个hit-target hook误算为应用泄漏，改按生产bundle调用来源统计且检查入页计数确实增加、离页回基线。Canvas故障注入需真实reload，hash改变不会重跑init script。没有降低生产断言。
- 已查看并保留docs/evidence/t07-practice-desktop.png与t07-practice-mobile.png，宽窄屏无横向溢出、48px握柄分开可见。临时截图脚本与test-results的5文件/4目录已逐项显式路径、无Force/无递归删除，Test-Path均false。
- 实际IE11/IE模式、实体手机/Safari、完整图形SAVE-01—07、全剧手动可达性/性能/时长/情绪、正式美术/文化/许可：未验收。当前通过不代替后续任务。

## 接线约束

- 先读docs/contracts的project-v1、assets-v1、story-v1、navigation-v1、canvas-v1、practice-v1。领域层无DOM/Three，Project版本和数据含义未变。
- 世界宽2/高1.5、灯深1.2；根x右/y下归一化、模板世界y上。facing只在根镜像一次；输入扣Canvas/letterbox、先逆投影再IK。握柄与真实连接之间保留抓取偏移。
- constrainPoseToStage返回pose/bounds/fits，包含姿态全部部件与显式附件。scale不低于.6，无法全纳明确false。几何判定必须读取最终受限姿态的实际点/区域。
- Renderer只收最多两角的纯数据帧，已加载资源的姿态帧同步绘制，不逐帧loading；仍无独立RAF。T07的animation-clock是唯一调度器基础，T16在NodeScope中复用，不叠加循环。
- 五动作ID与既有保留项一致：wave-v1/walk-v1/bow-v1/raise-axe-v1/reach-v1。sampleAction只读捕获basePose/绝对elapsedMs，返回fits/bounds；interactions只做覆盖/距离/角度/连续时间观察，不提交剧情命令。
- 所有写入经串行Store。Pose每200ms限频并尾随，松杆/松键/暂停及时提交；memory/error自动路径只编辑内存。根durable以isBusy在FileReader之前锁定；先入队旧稿，项目ID改变清相位。事件、保存timer、RAF、捕获、订阅、资源都有dispose。
- 剧情只存稳定节点/决定/冻结配置，推进继续用runId/revision/nodeId guard，不能由动画结束或输入回调直接改进度。

## 并行与检查点

纯动作/有限观察5文件由t07_actions在独立codex/t07-actions工作树完成，提交4e8670d5e2a79f5216019a923f50dfa0c52253a5。主Agent按相同文件集集成并统一全量验证；未重装依赖。t02_route_audit只读审查。

T07已验证源码检查点为b7bbff6bb123d582195e029f6db3f106a092dac1，对应209项单元、122项生产浏览器与13份legacy ES5；后续交接元数据提交不改变实现。上一T04为4297769f29dc02892c58abfcd3e218a0b0d804db；T03为bef273f2a5d13621c185a8289dee154514676102，T01为15f9650119d97fffd2accea82f64c5a4e07be9fc，T15为a619ab40e44e8ea91ef3d63deeaa7f12aa1a23cd，T02为d9c26e635c606e39d911c21222fe2e59a7fe47af。

托管t07-actions与上轮t04-pose-projection工作树已请求归档，工具返回queued；本轮两目录仍存在，保留已提交贡献，不声称已移除，不手动递归删工作树。

## 下一位首先执行

1. 核对Git暂存区/端口，保留两份用户赛事文档，不读取、不混入提交；当前可npm run dev启动。
2. 领取T05：分段刻纹、真实灯位/偶幕距离控制、确认冻结与默认影偶开演，复用ProjectStore/guard/现有bbox。先核对主方案T05与叙事craft验收，不改已冻结本场。
3. 随后T16导演/NodeScope/字幕与有限第二角色，再T17一条占位整场及刷新，补唯一分支两路、共纹回收、最后伸手、四秒静候和谢幕；T18展品、T09成果PNG。
4. 正式艺术/文化留T10，真实IE与图形恢复留T11；P1录制/分享仍在G3/T13之后。
