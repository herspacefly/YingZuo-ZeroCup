# 当前开发状态与交接

更新日期：2026-10-17。codex-root；实际分支main。用户暂存的两份赛事DOCX/PPTX未读取、未改动，不包含在开发提交。

## 当前阶段与入口

**T00、T03、T01、T15、T02及T04已完成；当前无占用任务，下一项优先T07。**

- 环境仍为Node v24.18.1 / npm12.0.2、TypeScript7.0.2、Vite7.3.7 / legacy7.2.1；依赖与锁文件未变。npm ci恢复，npm run dev启动。
- http://127.0.0.1:5173/ 实际响应200，复用上轮开发服务。index为产品外壳，八根hash与E01—E08目录共用一个ProjectStore。
- craft已用生产Canvas显示编辑沉香与母亲预览；颜色、已存分段镂空和袖口共纹在独立部件中合成。母亲固定配色，已有本场时共纹读取冻结快照。当前没有新增刻纹控件。
- light/practice显示编辑稿的真实几何投影/姿态，尚无灯控/拖杆。story显示当前节点入口姿态、冻结造型、场景层和附件，保持暂停；没有自动演出或新推进后门。
- study/probe仍是独立T00试作/探针；project为正式存档工作台，assets为中性组装检查，story.html为可走两模式两路径的文字排演。它们不替代产品演出。
- 80张原创几何占位PNG、来源与许可状态未改，全部draft/unknown。正式人物/场景/声音留T10；展馆仍是目录，成果PNG、Three、完整操偶/导演/图形全剧均未完成。

## 本轮实际验证（T04）

- npm test：11文件177/177通过，新增30项（25姿态/投影，5Canvas数据帧边界）。包含两手IK重合/伸展/超限、任意pivot/bind/rest、禁用关节、附件、实际角点bbox、极灯位/镜像/缩放与letterbox往返。
- 最终npm run build含typecheck通过，六个HTML有modern/legacy入口；verify:legacy确认13份legacy JS为ES5。
- 最终生产包浏览器100/100通过，2.2分钟；Chromium156.0.8078.4，1440×900桌面与390×844模拟手机各50项。新增16项验证真实双人预览、冻结母亲/节点画面、镂空保留背景、缺图及像素读取失败/重试重新请求、Canvas不可用、迟到加载、十次进出/resize清理、legacy；原84项回归通过。
- 早期图像检查曾错误用朱色像素判断靛色影偶，已改为实际深色像素与图像差异。绘制失败测试进一步发现文档解码图片缓存会复用同URL；失败后清资源并追加数字重试代次，已实际验证新请求与恢复，不放松断言。
- verify:assets通过80张PNG解码/alpha/颜色区/引用/CSV/哈希；verify:content通过18节点/两路径与角色/字幕/来源契约；verify:state通过。release仍未就绪，未重复未改动的正式门禁。
- 已查看并保留docs/evidence/t04-craft-desktop.png、t04-craft-mobile.png、t04-story-desktop.png。画布按4:3 letterbox等比显示，宽窄屏无横向溢出；是工程视觉证据，不是正式艺术验收。
- 独立只读审查三项已修复复核：绘制失败清缓存、场景覆盖只取白名单数值、工厂异常/空帧清签名并取消旧加载。同序部件用原下标稳定排序，未依赖旧浏览器sort稳定性。
- 本轮截图脚本、test-results的5个文件和空目录已逐项、显式路径、无Force/无递归清理；Test-Path为false。证据截图保留。
- 实际IE11/IE模式、实体手机/Safari、完整图形SAVE-01—07、手动可达性、全剧时长、性能、情绪及正式美术/文化/许可：未验收。

## 接线约束

- 先读docs/contracts的project-v1、assets-v1、story-v1、navigation-v1、canvas-v1。领域层无DOM/Three；共享类型/存档版本未变。
- 世界宽2/高1.5、灯深1.2；根归一化x右/y下，模板世界y上。facing只在根一次镜像。输入先扣容器/letterbox，再逆投影/逆根变换，杆柄必须走同一正投影。
- constrainPoseToStage返回{pose,bounds,fits}，bbox含当前姿态全部部件及可见附件。必要时缩小但scale不低于.6；无法全纳明确fits=false，不把受限手部当目标已达成。
- Renderer只接actors/stage/sceneLayers/attachments纯数据帧，最多两角；固定角色不带Appearance。局部部件上色/alpha/镂空后才进入舞台，前景山片在演员后画。Renderer不重排导演入口根位置。
- 当前update/resize按需绘制，没有RAF或演出计时器。T07/T16必须沿用唯一时钟驱动，不另开多条动画循环。PageView.dispose清事件/resize/缓存/图像回调/Canvas，旧加载不能复活旧页。
- 预览边界适配不回写Project；剧情仍只保存稳定节点/决定/冻结配置。所有写入继续走串行Store与事务版本检查，URL或画布不推进节点。

## 并行工作与检查点

纯数学4文件由t04_math在独立codex/t04-pose-projection工作树完成，提交7ff5c01cae75868e29aa8e50dbd2dde91fc7040d；主Agent按相同文件集集成并完整验证。未重装依赖。只读审查者t02_route_audit不写文件。

托管工作树C:/Users/zhang/.codex/worktrees/t04-pose-projection/ZeroCup已请求归档，工具返回queued；本轮未声称目录已移除。它保留已提交贡献，可通过任务附件恢复/处理，不手动递归删Git工作树。

T03检查点bef273f2a5d13621c185a8289dee154514676102；T01为15f9650119d97fffd2accea82f64c5a4e07be9fc；T15为a619ab40e44e8ea91ef3d63deeaa7f12aa1a23cd；T02为d9c26e635c606e39d911c21222fe2e59a7fe47af。T04源码检查点4297769f29dc02892c58abfcd3e218a0b0d804db，对应177项单元、100项生产浏览器和13份legacy ES5检查；交接元数据提交不改变已验证实现。

## 下一位首先执行

1. 核对Git/暂存区和端口，保留两份用户暂存赛事文档，不读取或混入提交。
2. 领取T07三杆输入与五种时间动作：仅沉香可控，复用逆投影、solveArm、真实bbox和杆连接；覆盖鼠标/触屏/键盘、暂停清按键与离开清事件。不把输入直接转成任意剧情完成。
3. T05刻纹/灯控/确认冻结也已满足依赖；随后T16接NodeScope和唯一时钟，T17走通占位整场与最后伸手，T18/T09接展品/成果。
4. 正式艺术设计与文化核对留T10；真实IE和全图形恢复留T11；P1录制/分享仍在G3之后。
