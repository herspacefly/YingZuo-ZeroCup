# T07 三杆练习、动作与有限观察接口

日期：2026-10-17。消费ProjectV1、assets-v1、canvas-v1，不改变存档版本。`#/practice`只操控沉香；既有剧情、冻结造型、决定、完成时间及P1字段均不改变。

## 坐标与输入

`domain/rod-input.ts`的rodScreenPoint返回幕面世界坐标（x右/y上）。moveRodTo先逆投影，身杆扣除实际连接点的根偏移，左右手杆交给两骨IK；moveRodBy基于同一投影连接点移动。两者返回`{pose,bounds,fits}`，边界包含当前附件；固定角色、坏杆ID和非有限目标明确拒绝。

DOM先扣Canvas client rect，再用fitViewport/viewportToWorld处理letterbox；输入只用CSS像素。三个48px握柄从真实连接点向下/两侧展开，SVG连线避免窄屏重叠。pointerdown保留握柄到连接点的抓取偏移，拖动不跳变；幕面外不产生新目标。

Pointer优先，鼠标/Touch回退。只跟踪当前pointerId/touch identifier；up/cancel/lost capture、窗口失焦、隐藏和离页都释放。聚焦握柄后方向键按时间持续移动，松开即停，兼容旧IE键名；不劫持原生range方向键。下拉选杆配方向按钮、身杆/肩肘/大小range、朝向选择提供替代操作。高视口滚动控制区时保留可见幕面。

## 动作与单一时钟

`domain/actions.ts`导出只读actionDefinitions及`sampleAction(id,basePose,elapsedMs,template,stage)`。固定ID为wave-v1、walk-v1、bow-v1、raise-axe-v1、reach-v1。关键帧在content/actions.json，角度为局部弧度、根偏移为归一化单位。采样只读basePose与绝对毫秒，不读墙钟/前帧；输出新`pose/finished/elapsedMs/attachmentIds/bounds/fits`。根x偏移跟随base.facing；+Infinity取终点，负数/NaN/-Infinity取0；未知ID或缺axe附件抛RangeError。

选举斧会准备附件并重新适配边界；明确播放才运行。暂停保留相位，继续不补墙钟；重演从当前姿态捕获新base。拖杆/方向键/range结束预设相位并接管。减少动态时只提供250ms步进，不自动连续播放。

`app/animation-clock.ts`的createAnimationClock接request/cancel/now端口，最多一个RAF。重复start不叠加，stop/dispose取消，代号拒绝晚到回调。delta非法、倒退或超过250ms暂停；暂停时间不补算。Renderer仍无RAF。T16应在NodeScope复用此调度器，不叠加多条循环。

## 保存与替换

POSE统一进入ProjectStore串行队列，连续输入最多每200ms提交最新姿态，末次input有尾随提交。change/松杆/松键/暂停/结束/离页请求及时保存；memory/error保护状态只更新可导出的内存稿，明确保存或全局重试才写盘。顶部状态等待真实事务结果。

PageContext.isBusy在根durable操作前锁定输入，包括导入读文件。旧作品末姿态先入队，时钟停止；项目ID改变后清相位并恢复新姿态。候选/冲突/恢复/未知格式暂停输入。冲突时本页末姿态仍可进入导出稿，不自动覆盖磁盘。dispose清事件、捕获、RAF、保存timer、订阅，再由舞台释放图像与Canvas。

不保存按键、拖动、RAF、函数或动作相位；刷新从已存末姿态默认暂停。performance/partialRecording维持原值，不产生录制或成果。

## 有限几何观察

`story/interactions.ts`不导入Store或StoryCommand：

- normalizedTargetBounds：归一化x右/y下目标矩形转幕面世界，非法返回null。
- targetCoverageRatio：交集面积/目标面积，夹[0,1]，坏框为0。
- handDistanceRatio：投影手点距离/幕宽2，坏值为Infinity。
- withinAngleRange：局部弧度闭区间，坏值不命中。
- emptyHoldObservation/observeHold：节点绝对毫秒连续观察；首样本不赚时间，暂停、不匹配、倒退及超过250ms断档均清零。

T16/T17须使用最终受限姿态的实际区域/手点，并通过runId/revision/nodeId guard提交。几何值或动画结束回调本身不推进剧情。本任务不等于全图形剧情/手动可达性或正式美术验收。
