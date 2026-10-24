# 本轮证据索引

生产源码540bdeb，入口283837594ee06439db2fc023e4e66e0790b7860803c3464eafce04e62bfea7de。汇总acceptance.json，解读与限制见../../acceptance/t25-t28.md。

- browser-initial / browser-routes / browser-museum-recheck：原始分阶段Playwright报告；52/52、54/66、12/12，118唯一用例最新观察通过。12项为旧断言，未称单次全量全绿。
- startup / startup-png / museum-loading / lamp-loading：原生、禁缓存、隔离临时context，本地/5Mbps150ms×宽/窄，均≤15秒；不是实体设备或统计分布。
- fresh-user-home / fresh-user-start：用户实际IAB5173清历史后截图，不是临时测试context。两个旧标签都刷新验证新用户入口；其他来源或下载文件不在清理范围。
- ending-*：两路线在用例中都走通，截图是先呼唤路线的五种终章×两尺寸；受控RAF用于构图，不是时长。
- grip-visual + axe-*：举斧/落斧/回收与三维近看，受控RAF。软件GPU512px预算可见，不假称实体GPU画质或FPS。
- lamp-*及../t27/：本机原生鼠标拖灯/拖手柔线、模块失败、无WebGL和合成上下文丢失/重复进出的诊断。早期子树图仍含历史纹样，当前截图和根代码为original-texture。
- museum-visual + museum-native-*：原生滚动各入场对象、解码公开照片后补拍完整图文。museum-light-*保留交互示意检查画面。

临时错误探针与有大片未入场空白的早截图已删除，其原因记在验收文档。完整v4演出未重新做原生全程时长与听感测量。正式艺术/文化/许可审看、实体设备和旧性能缺口仍未完成。
