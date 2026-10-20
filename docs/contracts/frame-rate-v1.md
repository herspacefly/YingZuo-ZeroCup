# frame-rate-v1：持续卡顿提示与画质偏好

对应主方案10.3。仅显示层，不属于ProjectV1，也不影响帧率独立的动作时间、完成证据或音乐时序。

- createAnimationClock可选第四参数FrameObserver，frame(deltaMs)/reset()。只向仍active且tick成功继续的唯一RAF回调送有效间隔；start/stop、完成、gap/error及dispose清空连续采样，迟到generation不送样本。观察器不创建自己的RAF或定时器。
- createFrameRateMonitor以至少1000ms为一窗，用frame count/elapsed计算平均fps；连续低于24fps累计至少10000ms才通知一次。24fps及更快窗清空低速累计；0ms忽略，非法/负值/>250ms重置。十秒是有效播放时间，不含暂停、加载、后台或跨节点间隔。
- 每个canvasStage拥有监测与面板，故事、练习、成果只读重演通过stage.frameObserver接线。静态制偶/展馆没有持续RAF，不制造静止页面低fps。
- 提示不暂停、不抢焦点、不改Store。选择“使用轻量二维”才把Canvas缓冲限制为宽≤512、DPR≤1，关闭并释放当前WebGL；当前轻量模式禁用空间重新展开。“继续当前画面”关闭本幕面的提示；同一幕面不会反复提示。
- 轻量偏好在本次document内跨短幕/路由共享，旧舞台销毁退订；刷新恢复默认。“恢复原画质”恢复设备原有缓冲预算，空间观察由用户另行展开。已有低端设备预算仍有效。
- 每页/节点dispose释放面板监听、偏好订阅、原有时钟、渲染器和资源；共享二维路径不依赖Element.remove。未知版本存档及只读重演仍不得写作品。

受控帧间隔验证提示策略，不证明真实设备FPS、冷启动或长期GPU/内存预算达标。

原生首帧时序：RAF传入帧开始时间，可能早于play事件内performance.now。唯一时钟仅忽略首次这样的旧帧，保留play基准，下一有效帧照常计算；此帧不采样FPS。之后的倒退、非有限时间或>250ms间隔仍暂停，取消代次与暂停恢复规则不变。真实早帧证据和无时钟覆盖产品回归见native-frame-start-before/after及clock-native-start。
