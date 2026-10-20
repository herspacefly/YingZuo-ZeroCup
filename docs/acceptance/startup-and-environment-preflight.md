# 启动、资源与环境预检

执行日期：2026-10-19—20。已验证源码feed67a40caccbce0c7c97b275c0a3652199d561。此记录属于T10期间的开发预检，不代表T10艺术审定、T11设备验收或T13性能/体验验收完成。任务状态仍以`docs/tasks.json`为准。

## 已实现的改动

- 81张canonical PNG只改变压缩编码；原始RGBA与浏览器实际绘制的RGBA逐字节一致。总量由7,894,199降至6,082,347bytes，正式方向图、人物比例、手型、服饰、背景明暗及绑定未变。
- 61张更小的无损WebP作为现代浏览器传输格式，绑定canonical SHA/尺寸；实际解码先验证半透明像素能力，再经原尺寸Canvas和本地PNG重新进入原生Image，避免不同源类型的缩放/纹理上传差异。能力不足或legacy继续用PNG，失败真实反馈、明确重试，离页取消与释放。
- 开场省去16张内容重复的alpha遮罩传输，canonical三图仍全部保留并独立核验alpha一致。默认三维和音乐仍按原规则主动开启。
- 原生测量发现起播后的首次RAF可能早于点击中`performance.now()`，原逻辑会立刻误暂停。现仅跳过这一次早帧、不移动播放基准；后续倒退、非有限值和>250ms仍暂停。前后各12次原生点击均观察到3次早帧，误暂停由3次降至0次。

完整像素证据见[png-reencode-pixel-proof.json](../evidence/png-reencode-pixel-proof.json)、[delivery-pixel-proof.json](../evidence/delivery-pixel-proof.json)。产品A/B另检查三纹样、两配色、镂空、固定母亲、三维、六个剧情场面及成果PNG，不能只由编码器的“lossless”标签推导画面一致。

## 启动与资源预算

测量脚本见`scripts/measure-startup.mjs`。每次使用新context、禁HTTP缓存、阻止Service Worker；本机与CDP 5Mbps/150ms各3次，1440×900与模拟390×844共12次。不清OS文件缓存、不限制CPU、不代表实体手机或远程部署。

首页“可操作”要求实际按钮可用、存档saved并等待两次原生RAF；点击后序幕Canvas就绪单独计时。图片/字体按真实HTTP响应与ResourceTiming、Content-Length、dist字节交叉核验，不能把已消费fetch的空`response.body()`算零字节。

| 路径 | 首段实际图片/字体 | 2MiB目标 |
| --- | ---: | --- |
| 原基线，55PNG | 4,289,566bytes | 未达标 |
| 现代默认云纹，39资源 | 2,094,040bytes | 通过，余3,112bytes |
| 现代水纹，39资源 | 2,096,640bytes | 通过，余512bytes |
| 现代花纹，静态39资源 | 2,092,456bytes | 静态预算通过，未单独做冷启动样本 |
| PNG兼容默认云纹，39资源 | 3,157,934bytes | 未达标，超1,060,782bytes |

原基线的限网序幕就绪中位数约7.7—7.9秒。最终现代路径的12次结果见[startup-optimized.json](../evidence/startup-optimized.json)，首页本机2秒/限网5秒目标单独判定，不给序幕新增未经约定的目标。为保持最终像素相同，本地PNG转码有CPU成本，不能宣称所有场景都更快。

| 最终包条件，每组3次 | 首页中位/最差ms | 点击后序幕中位/最差ms |
| --- | ---: | ---: |
| 桌面/本机 | 298.3 / 364.2 | 1,146.4 / 1,165.9 |
| 桌面/5Mbps+150ms | 686.0 / 687.7 | 4,434.7 / 4,444.9 |
| 模拟窄屏/本机 | 266.4 / 268.7 | 1,025.4 / 1,028.9 |
| 模拟窄屏/5Mbps+150ms | 679.1 / 686.8 | 4,477.9 / 4,480.2 |

水纹与PNG兼容各4次专项样本见[startup-wave.json](../evidence/startup-wave.json)、[startup-png-compatibility.json](../evidence/startup-png-compatibility.json)。水纹先通过study预置未开演草稿，与fresh默认冷context分列。静态三纹样见[startup-static-budget.json](../evidence/startup-static-budget.json)。PNG专项真实退出1，不能改写为通过。

两组4次专项来自首帧修复前构建6ce1e53e；资源/解码链与最终一致，构建指纹见[startup-production-build-before-clock.json](../evidence/startup-production-build-before-clock.json)。最终12次、原生起播及运行复测绑定fbe5dc68，不将不同阶段时间混成同一组样本。最终静态现代入口gzip111,755bytes，小于200KiB；它不包含动态Three、图片/字体或CSS，见[startup-entry-budget.json](../evidence/startup-entry-budget.json)。

## 环境整场流程

专用命令：`npx playwright test -c playwright.environment.config.ts`，默认核心配置不再重复包含该文件。每个环境分别验证full/guided×call-first/split-first。

| 环境 | 通过数 | 证据构建 |
| --- | ---: | --- |
| 1920×1080正常二维/主动三维 | 4 | 首帧修复前生产包6ce1e53e |
| 1024×768正常二维/主动三维 | 4 | 同上 |
| 1440×900减少动态且禁WebGL | 4 | 最终生产包fbe5dc68 |
| 模拟390×844减少动态且禁WebGL | 4 | 同上 |

实际阻断非本地HTTP并主动发出失败探针，产品外部请求为0。本地服务保留；原生两段媒体实际解码播放，正式故事走正常节点/保存，最后伸手真实拖动并经几何检查，其他交互采用明确协助。八展品展开、来源、本地图像、1600×1200PNG和整份JSON下载、刷新完成记录一致、各节点无横向溢出均有断言。已取消的资源请求单列，不与真正加载失败混为一谈。

正常8项最终一轮342.6秒、减少动态修正输入后的8项376.1秒，均无重试/跳过/未解决失败。正常流程前一轮把主动取消请求记为失败，修正分类后才完成整轮8项；最初减少动态8项失败来自测试沿用普通母亲动作的手部目标，改为读取公开可见目标、通过真实输入调整身杆/拖手后通过，不写隐藏完成位。诊断范围仍保留。普通8项与最终包之间只涉及首帧修复，缓存路径一致；最终核心回归及原生起播单列，不冒称这16项全部在同一构建完成。

原始记录见[environment-preflight-run.json](../evidence/environment-preflight-run.json)、[environment-reduced-motion-run.json](../evidence/environment-reduced-motion-run.json)；阶段构建指纹分别保留。剧情使用受控时间，不能称真实完整演出时长；减少动态窄屏用鼠标，不代替实体触屏测试。

## 原生时钟运行测量

`node scripts/measure-runtime.mjs`记录原生主页面RAF回调、实际Canvas绘制和WebGL调用；静止高对象场面的绘制调用与运动窗口分开。探针不覆盖RAF/performance；若原生低速提示未出现，轻量样本为N/A，不能强制制造提示。

当前自动化环境是i7-1260U、12逻辑核心、约16.9GB内存、Chromium156、ANGLE SwiftShader软件GPU。Trace和API计数有额外开销。四机位静态高对象场面调用峰值67，低于80；二维无GL调用的预算为N/A。默认二维原生回调约27.73Hz、四个三维机位约16.58—17.80Hz，尚未达到桌面目标；持续12秒低速后真实提示可用，主动轻量二维达到59.88Hz，通过探针的59Hz容差阈值。各窗口与范围见[runtime-desktop-preflight.json](../evidence/runtime-desktop-preflight.json)。默认画质仍失败，整份测量真实退出1；回调率/绘制次数不等于显示面板呈现FPS，不能据此宣布真实性能全面通过。

## 核心回归与检查

最终源码的核心浏览器回归覆盖282项，两视口各141项。首轮279通过/3超时、工具总耗时11.0小时；系统日志记录多次睡眠/新型待机，原始跟踪中的一次贴图失败为`net::ERR_NETWORK_IO_SUSPENDED`。相同生产包保持原5秒expect与90秒默认用例时限，三项定向复验3/3通过26.4秒，无代码/断言放宽。当前282个唯一用例已覆盖，无未解决复现失败；不能写一次282全绿或把11小时当体验/性能数据。

原始[首轮报告](../evidence/startup-core-regression.json)、[定向复验](../evidence/startup-core-recheck.json)、[系统待机事件](../evidence/startup-core-system-standby.json)、[精简失败诊断](../evidence/startup-core-timeout-diagnostics.json)均保留；重复trace ZIP在提取必要上下文/网络失败后删除。最终415/415单元、typecheck、生产构建、14份legacy ES5与六HTML入口、素材/内容/状态/审看册结构通过，均不代替正式验收。

两个素材生成器重新运行后，81PNG、61WebP及清单/模板/场景/CSV/剧情/像素证明共151个文件全部字节一致，见[startup-art-reproducibility.json](../evidence/startup-art-reproducibility.json)。实际应用无需现场运行生成器；它用于确认后续维护可以复现当前资源。

## 尚未完成与下一步

技术目标仍有PNG兼容首段体积和软件渲染默认画质帧率两项失败。PNG继续维持像素精度的代价已列明；接下来的兼容解码或分幕加载需保留视觉、暂停恢复、失败反馈与真实IE证据。性能先在代表性硬件和实体手机测量，区分软件GPU开销与产品热点，再针对测得热点优化；轻量模式这一个窗口达标不代表默认画质或其他设备达标。

外部条件另列：130项当前艺术/文化/原创资源范围正式审看、真实IE/IE模式与Android/iOS Safari、实体横竖屏/存储/文件操作、全程实际时长/扬声器听感、至少3位未参与开发者的EMO体验。T14仍须在依赖满足后完成干净安装/提交包及另一开发者15分钟接手；P1录制和分享未启用。不能把本轮预检记作全部开发完成。
