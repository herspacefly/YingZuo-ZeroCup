# T06 同一成影的三维戏台盒

依据主方案T06/9/10节、Canvas/导航/展馆/成果合同。Three仅空间增强，不改变ProjectV1、剧情图、输入投影或唯一时钟。

1. 各产品Canvas幕面下提供可展开空间观察，默认完整二维；现有幕面/操偶控件保持可用。主动展开且非legacy、有WebGL2接口时才动态载入Three；初始化/模块失败、context lost有真实反馈并回二维，可手动重试。手机/低内存/低核心数/省流按低预算绘制，不能锁剧情或知识。
2. Three仅在src/renderers/three/内导入。采用固定四机位workshop/front/backstage/exhibit，事件驱动即切，无额外RAF/tween/OrbitControls。正面幕面贴同一Canvas的实际输出；幕后使用同一分件/配色/刻纹合成与关节/杆世界坐标、灯深1.2和实际偶幕距离。木台、薄片、幕与灯为原创空间示意，不宣称物理透射仿真。
3. mountThreeStage(host,sourceCanvas,options,onStatus)返回update(frame):Promise<void>、setView(view)、resize、dispose。options为pixelRatio/maxWidth/textureSize；status为loading/ready/error/lost及message。sourceCanvas是已就绪二维幕面；update不拥有时钟，不改原帧/存档，相机不改变成影参数。每次资源变更用代号拒绝迟到，缓存稳定部件/纹理，释放离场资源。
4. 能力纯函数spatialCapability(input)返回eligible/reason/budget；input为legacy、webgl2、width、deviceMemory?、hardwareConcurrency?、saveData?、dpr?；budget为pixelRatio/maxWidth/textureSize。无WebGL或legacy不初始化/不导入。低预算<=1 DPR/512宽/512纹理；常规<=1.5 DPR/1024宽/1024纹理。能力只是准入，真实初始化失败仍走二维。
5. root共享Canvas在每次ready绘制后通知空间观察当前帧/实际Canvas；加载/错误不贴旧帧冒充新成影。按需模块离页/收起/换作品释放，旧加载/导入拒绝。所有buffer/材质/纹理/图像/监听/WebGL context有释放路径，不新增与剧情竞争的RAF。导出器继续只用Canvas，不强制带三维依赖。
6. 五区八展品仍有原DOM导航，展台机位附同一E01—E08链接；不用WASD或鼠标命中三维几何作为知识入口。四机位有键盘焦点与明确状态，减少动态同样即切。不能让空间相机误导二维杆的点击坐标。
7. 必要检查：纯能力预算/机位几何，实际WebGL四视图与共享纹理/冻结不改作品，灯/姿态/刻纹联动，失context/初始化失败/无WebGL/legacy/低预算，动态模块迟到拒绝，十次收起/离页/GPU与事件/RAF释放，宽窄屏截图、ES5产物及相关整站回归。真实IE/实体设备和正式艺术仍分别留T11/T10。

分工：renderer独立树只改src/renderers/three/及tests/unit/three-stage.test.ts；capability独立树只改src/app/capabilities.ts及tests/unit/capabilities.test.ts。root协调依赖/共享Canvas/空间UI/样式/浏览器/合同与账本，接口变更先协商。

官方依据：[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html)，2026-10-18核对；当前npm版本Three0.186.1，类型0.186.0。引用API不代表真实IE或GPU性能验收。
