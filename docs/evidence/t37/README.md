# T37 证据索引

- `acceptance.json`：源码检查点、检查汇总及114个唯一浏览器用例的最新状态。
- `build-fingerprint.json`：生产入口、五版故事和关键实现SHA-256。
- `unit-final.json`：50文件600/600；`unit-initial-failure.json`保留未来版本测试5→6的初始诊断。
- `browser-main.json`：新主矩阵84/84；`browser-compatibility.json`：旧版与教学首轮26/30；`browser-guide-and-stills.json`：4条教学复验加2条稳定截图6/6。`browser-smoke-fixed.json`为先行8/8，包含在主矩阵中，不重复计数。
- 八张PNG是宽窄持杖entry/action/spatial及ending-summary。均为最终包原生截图；剧情动作使用受控时钟，不作为原生全长或设备FPS证明。

首轮浏览器接线曾因Node JSON import attribute、隐藏导航及两个canvas定位失败；测试修正后主矩阵完整通过。旧静默节点在自动入场后立即出现操偶教学，旧测试需明确退出该教学并暂停正式演出，才能单测transport教学；产品未为断言回退自动开演。
