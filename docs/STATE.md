# 当前开发状态与交接

更新日期：2026-10-17。codex-root；实际分支main。两份用户暂存赛事DOCX/PPTX未读取/未改动，暂存blob保持原值，不纳入开发提交。

## 当前阶段与入口

**T00、T03、T01、T15、T02、T04、T07及T05已完成；当前无任务占用。下一项优先T16节点导演/NodeScope/序幕，再T17占位整场。**

- 环境Node v24.18.1 / npm12.0.2、TypeScript7.0.2、Vite7.3.7 / legacy7.2.1；依赖/锁未变。npm ci恢复，npm run dev启动。原5173服务本轮已停止，重新启动的会话17320仍在，实际响应200。
- craft已有双角色三段镂空/还原/完成下一段、三套色板与衣身/袖/下摆色槽，同一部件遮罩真实成影；母亲未冻结时预览当前纹样，有本场时保持castSnapshot.sharedMotif。身杆鼠标/触屏/方向键/按钮试提为可重置临时排演，不写practice保存Pose。
- craft可用编辑稿或默认影偶明确开演。无run直接访问时一个候选内显式跳序并确认craft，保存成功进memory-wave；已有intro/craft保留run和mode。默认冻结默认Appearance并标preset，编辑稿不被擦掉。失败保留旧实际节点、同一冻结候选和后续排队编辑；全局重试成功后可点继续已冻结演出。
- 已冻结场可明确归档重开：保存最新编辑，原子归档旧项目，保留外观/舞台/Pose/标题建立无story的新项目，再由用户确认新run。已有上一归档时需明确替换；失败不导航。普通编辑不改旧场造型、决定或完成时间。
- light已有灯位[-.8,.8]、偶幕距离[.05,.4]滑块/原生键盘/逐步按钮/重置、几何倍率与真实保存。只改编辑Stage，预览适配不写Pose，剧情使用自己的entryStage。
- practice已有独立三杆与五动作、唯一时钟、暂停/步进和Pose保存；恢复默认暂停。memory/error自动操作只编辑可导出稿，明确保存才重试磁盘。P1字段不创建假录制。
- story仍显示当前节点入口暂停构图，尚无图形导演/整场推进。story.html文字排演可走完整/导览两路径并存档，project/assets/study/probe.html保留检查入口。
- 五区八件仍为目录，80张几何PNG为draft/unknown；正式人物/场景/声音/文化与许可留T10。Three、成果PNG、图形全剧、P1录制/分享未实施。

## 本轮实际验证（T05）

- npm test：17文件229/229通过，新增20项（字段10、craft保存/归档10）。含真实Store排队字段合并、严格坏值、最新外观一次冻结/默认标记、旧guard/重复确认、失败候选/排队编辑/取消、归档保留最新编辑及上一项目保护。
- 最终npm run build含typecheck通过；六HTML有modern/legacy入口，verify:legacy确认13份legacy JS为ES5。最终构建后源码未再改变。
- 最终npm run test:e2e -- --workers=2：144/144通过，4.6分钟。Chromium156.0.8078.4，1440×900桌面和390×844模拟手机各72项；新增22项T05，原122项回归通过。
- 新流程覆盖三段/部位颜色/共纹真实图像与SAVE-01刷新、同一事件内未保存编辑立即确认/重复点击、默认使用旧craft run、失败候选冻结与后续编辑分开/真实导出重试、归档重开与已有归档保护、灯影键盘/步进/上限/重置/刷新及旧节点图像不变、内存继续不自动写盘、试杆真实鼠标/CDP触屏/Touch回退标识与取消、旧Pose/剧情不变、十次craft/light进出事件清理、Canvas不可用、legacy新流程冒烟。
- 初轮定向18/20，三处色槽控件的隐式label混入选项文字，精确名称无法定位。已加明确aria-label并保留原精确断言，最终两视口通过；没有降低断言。T04的craft resize计数因新增身杆overlay实际从1变2，明确标注两所有者，离页仍要求回0。
- 只读审查发现候选已冻结而摘要仍称可同步改母亲纹样，已区分“待保存候选”与“后续编辑稿”；最终复核无新增阻塞。
- verify:assets通过80张PNG/alpha/区域/CSV/哈希，verify:content通过18节点/两路径，verify:state通过19任务。未重复未改动的release门禁；正式发布/艺术/文化/许可仍未就绪。
- 已查看并保留docs/evidence/t05-craft-desktop.png、t05-craft-mobile.png、t05-light-desktop.png、t05-light-mobile.png。无横向溢出，控件/共纹/镂空可见；不是正式美术验收。
- 截图临时脚本与test-results的5文件/4目录已逐项显式路径、无Force/无递归删除，Test-Path均false。托管工作树归档仍queued，不能声称目录已移除。
- 实际IE/IE模式、实体手机/Safari、图形全剧手动可达性/完整SAVE-01—07、全剧性能/时长/情绪及正式美术/文化/许可：未验收。

## 消费者与约束

- 读docs/contracts的project-v1、assets-v1、story-v1、navigation-v1、canvas-v1、practice-v1、craft-v1。Project版本未变。字段编辑继续经唯一Store，禁止旧APPEARANCE/STAGE覆盖排队字段。
- T05新增CARVE_SEGMENT/CARVE_NEXT/COLOR_SLOT/APPLY_PALETTE/LAMP_X/PUPPET_DISTANCE；APPLY_PALETTE复位0/1/2，既有PALETTE保留色槽。普通字段沿用500ms/最长2秒自动保存，input/change/步进不自动flush保护状态。
- confirmCraft捕获guard，执行时取最新外观，只持久化最终冻结候选；archiveForRehearsal先保存最新编辑再原子归档，不复用旧run。候选和根isBusy保护仍有效，未知版本/冲突不自动覆盖。
- 世界宽2/高1.5、灯深1.2，根归一化x右/y下，世界y上；输入先扣Canvas/letterbox再逆投影/IK，facing在根只镜像一次。实际bbox包含显式附件，scale不低于.6，fits=false不能当命中。
- Renderer无独立RAF，已有资源的姿态帧同步绘制。T07共享animation-clock可给T16复用，NodeScope应持唯一时钟，暂停/失焦/隐藏/长断档清输入与连续观察，不叠加第二循环。
- 五动作稳定ID及有限几何观察见practice-v1；T16/T17必须从受限后的实际手点/区域判定，用runId/revision/nodeId guard提交，动画结束不能直接改剧情。
- T05新增试杆/字段事件均dispose；身杆临时Pose与practice持久Pose、节点entryPose是独立边界。T16导演必须使用节点entryStage，不读取可编辑Project.stage。

## 并行与检查点

字段2文件由t05_fields完成，提交f48a29ebb853b676103901e496cdfe87ef6abf2d；身杆1文件由t05_body_rod完成，提交2c95d780d27a023ff2b075a9b1a5975d8d432282。主Agent按文件集成，补产品/开演/验收并统一验证。工作树工具初始返回detached HEAD，集成人已建立codex/t05-editor-fields与codex/t05-body-rod分支保留提交；以后应在派发前先核对并建立独立分支。两树请求归档返回queued，目录仍在；旧T04/T07的queued树也不手动递归删除。

T05已验证源码检查点：3e8880cdc856744a03be66d1fc18481d9c4a4c0e，对应229项单元、144项生产浏览器和13份legacy ES5；后续交接元数据提交不改变实现。上一T07为b7bbff6bb123d582195e029f6db3f106a092dac1；T04为4297769f29dc02892c58abfcd3e218a0b0d804db。更早T00/T03/T01/T15/T02证据与SHA见verification和账本。

## 下一位首先执行

1. 核对Git/端口/暂存区，保留两份用户赛事文档，不读、不混入提交；现可从5173使用制偶/灯影/练习。
2. 领取T16，先读主方案8/短节点及story-v1：NodeScope、唯一时钟、脚本第二角色/字幕、节点灯位/图层初值、暂停重开与晚到资源拒绝；接序幕可跳过，不创造新URL推进后门。
3. 随后T17走一条占位图形整场与刷新，再补唯一分支两路、共纹回收、用户最后伸手、四秒静候及幂等谢幕；T18展品、T09成果PNG。
4. 正式艺术与文化留T10，真实IE和完整图形恢复留T11，P1录制/分享仍在T13/G3之后。
