# 《影作·一幕团圆》开发入口

本队参加 2026 年零杯**零组**，比赛信息以开幕式 PPT 为准。主题为“匠心传成，非遗焕新”。当前采用 **2.0 叙事方案**：以传统故事《劈山救母》为核心的原创互动短戏与数字展馆，替代旧版单偶工坊范围。

## 先理解作品

点灯引入 → 为沉香制偶 → 灯下回应与分离 → 上路学艺 → 选择先呼唤／先开山 → 亲手让母子伸手相见 → 谢幕看见幕后 → 同台成馆。

主线约 6—8 分钟，另有三分钟导览；五区八展品可直接从首页进入。只有一个实质剧情分支，两路都团圆。沉香是唯一可定制和操控角色；母亲与二郎神用脚本有限动作，同屏最多两角色。

**十五秒单偶自由录制与在线分享已降为 P1。** 先做完整故事、谢幕、展馆与恢复，不能仍按旧优先级先做录制器。

## 每次开始或中断后恢复

1. 读 [项目执行约定](AGENTS.md)。
2. 读 [实际状态与下一步](docs/STATE.md)，核对真实文件、分支、未提交差异。
3. 查 [任务账本](docs/tasks.json)，领取依赖满足且无人占用的任务；中断任务按交接规则接续。
4. 工程查 [主设计与实施方案](docs/plans/2026-10-15-yingzuo-design-and-implementation.md)；剧情、美术与展品查 [叙事执行稿](docs/content/2026-10-15-yingzuo-story-bible.md)。
5. 做一个可检查的小步骤，更新 nextAction、实际验证和必要交接，再停止。

**T00、T03、T01、T15、T02、T04及T07已完成。**[产品首页](http://127.0.0.1:5173/#/)已有八入口、五区八件目录与节目单；[制偶页](http://127.0.0.1:5173/#/craft)有双角色分件/颜色/共纹预览，[练习台](http://127.0.0.1:5173/#/practice)有三杆鼠标/触屏/键盘操作、五动作和姿态保存；剧情仍显示当前节点暂停构图。[文字排演](http://127.0.0.1:5173/story.html)可走两路径并保存接续；project/assets/study/probe.html保留独立检查入口。启动见[README](README.md)，消费者读[ProjectV1](docs/contracts/project-v1.md)／[资产](docs/contracts/assets-v1.md)／[剧情](docs/contracts/story-v1.md)／[导航](docs/contracts/navigation-v1.md)／[Canvas](docs/contracts/canvas-v1.md)／[练习合同](docs/contracts/practice-v1.md)，真实证据见[验证记录](docs/verification.md)。下一项优先 **T05刻纹/灯控与确认冻结**，随后T16节点导演、T17占位整场；正式美术、八展品演示和成果PNG仍未完成。

Canvas 2D 完整覆盖故事和展馆；Three.js 增强空间与材料。本地用户剧情恢复与开发者接手是两套机制，都必须完成。

其他资料：[比赛信息与评分](2026年零杯比赛信息与要求.md)、[实际验证记录](docs/verification.md)。内部相对链接在复制目录／独立工作树后仍有效。

## 新会话接续提示

> 请继续本仓库《影作·一幕团圆》2.0。先读START_HERE.md、AGENTS.md、docs/STATE.md、docs/tasks.json，核对文件与Git差异，保留已有成果，不重新生成覆盖工程。T00/T03/T01/T15/T02/T04/T07已完成，已有事务存档、串行Store、三角色资产、guarded剧情命令、八页hash、双角色Canvas/IK/投影/bbox及独立三杆练习/五动作/唯一时钟/有限几何观察。消费者先读docs/contracts下project-v1、assets-v1、story-v1、navigation-v1、canvas-v1、practice-v1。优先T05刻纹/灯控/确认冻结，再T16导演和T17占位整场。practice只保存编辑Pose，不改冻结剧情；memory/error需明确保存，不自动重试。当前节点暂停构图、文字排演与展馆目录不等于整场手动/正式展品验收；正式美术/文化/许可仍待T10。按依赖接续一个明确小步骤，记录真实检查并更新状态，不恢复成录制优先。
