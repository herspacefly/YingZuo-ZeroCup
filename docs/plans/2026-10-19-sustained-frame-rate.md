# 持续低帧率提示实施计划

**Goal:** 补齐主方案10.3中持续10秒低于24fps时的提示，让用户可主动改用轻量二维，剧情与存档不变。

**Architecture:** 复用createAnimationClock的有效帧间隔，注入可选frame/reset观察器；每个canvasStage拥有一个纯帧率监测器和提示面板。暂停、失焦、加载、长间隔及销毁清除连续观测，不另开RAF或计时器，不写入ProjectV1。故事、练习和只读重演共用此入口。

**Tech Stack:** TypeScript、原生DOM、Canvas2D、现有Three.js可选观察、Vitest、Playwright。

## 决策与边界

- 采用连续1秒采样窗口；各窗口平均帧率均低于24，累计至少10秒后提示。达到24或更快的窗口清除连续低速；暂停/恢复等生命周期边界也清除。零间隔忽略，非法或超过250ms间隔交给既有停顿保护，不计作持续低速。
- 比较过独立RAF/定时器探针、自动降档、现有时钟观察三种路径。独立循环会破坏唯一调度；自动降档会擅自改变画面；选现有时钟观察并由用户主动处理。
- 提示不阻断操作、不自动暂停/跳节点，不抢焦点。用户可“使用轻量二维”或“继续当前画面”；同一幕面只提示一次。轻量二维将Canvas缓冲限制为512宽、DPR≤1，并实际释放当前空间观察；提供“恢复原画质”，空间可另行展开。
- 监测以本幕面生命周期为界；画质偏好在本次打开网站期间跨短幕/路由共享、刷新恢复默认。销毁时退订共享偏好，不改冻结造型、几何交互、动作时间、分支、保存或音乐时序。原先仅本幕面有效会导致切幕重新升档，实施中已修正该设计。
- 属于T10期间可执行的性能准备，不领取依赖尚未完成的T13，不把受控时钟证明为实测设备FPS。

## 实施步骤

1. 新增src/app/frame-rate-monitor.ts及必要单元测试；扩展src/app/animation-clock.ts可选观察器，验证单时钟、暂停/失焦/迟到/长间隔隔离。
2. 新增src/features/shared/stage-performance.ts，在canvas-stage.ts接入；Canvas renderer增加仅调整缓冲的轻量设置，spatial-stage.ts提供实际关闭二维入口。样式加入既有spatial.css，不增加全局样式导入。
3. story/controller.ts、practice/controller.ts、result/replay-view.ts传入幕面观察器，保持现有生命周期和存档行为。
4. 新增tests/e2e/frame-rate.spec.ts：持续阈值、正常帧率/暂停不误报、实际关闭WebGL/降低缓冲且动作与存档不变、恢复画质、继续当前画面及跨页清理；桌面/模拟手机均验证。
5. 运行typecheck、必要单元、生产构建/legacy检查，定向frame-rate/director/practice/replay/three及必要音乐回归；不重复无关存档全站。更新实际记录、预算与交接，清理本轮临时产物，显式路径提交。

## 文件所有权与当前状态

codex-root负责上述源码、tests/unit/frame-rate-monitor.test.ts、tests/unit/animation-clock.test.ts、tests/e2e/frame-rate.spec.ts、主方案/合同与账本/交接。独立只读completion_audit仅盘点未完成项，不改代码。不读取、修改或提交用户DOCX/PPTX。

已完成实现和本轮验证。402/402单元、最终typecheck/build（120模块，17.92秒）、14份legacy ES5/六HTML检查通过；最终生产包188/188相关E2E一次通过、零重试，报告5.6分钟，两视口各94项，含14项新增帧率用例。未重复无关全站与此前36项SAVE预检。

独立复核发现共享Element.remove兼容问题，以及继承轻量→恢复→再提示的按钮状态遗漏；均已修复并通过两视口实际流程。早期174项回归在观察到29项通过后为修P2主动停止，不记完成；最终188覆盖受影响的故事/练习/重演/三维/音乐/制作流程。构建前的初版14项24秒通过仅记历史。

当前入口gzip103,597bytes，小于200KiB；仅现代入口与四个modulepreload，非冷启动或设备FPS。逐文件/indexSHA、源码工作字节与检查范围见evidence/t10-frame-rate-functional-checks.json和t10-frame-rate-entry-budget.json。两张新宽窄屏提示截图已目检，无横向溢出；14张被回归改写的历史PNG已恢复，test-results按核对的绝对路径/无reparse逐项清理1文件0子目录，无额外临时脚本/工作树。

尚未全部完成：T10正式审看、T11实际设备/浏览器、T13性能/真实时长/听感/至少3位体验者、T14可提交包/干净安装与换人接手仍保留原状态；P1录制和分享未启用。
