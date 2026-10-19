# 当前开发状态与交接

更新日期：2026-10-19。codex-root，main。当前已验证源码 91d5dbf3ee370a8a2f16d7c10541cacd09f2bb76，完成作者本轮颈前抠除、精细道具与戏曲音乐修改。T10仍in_progress：130项艺术/文化review尚待作者明确审看；T11/T13仍todo。

## 当前可运行状态

- 开发入口 http://127.0.0.1:5173/ ，制偶/#/craft、剧场/#/story；审看册 /docs/reviews/t10-review.html。原5173服务在长回归后已不可达，现已重启会话11524，收尾HTTP200；4173回归预览已结束。
- Node24.18.1/npm12.0.2、TS7.0.2、Vite7.3.7/legacy7.2.1、Three0.186.1/类型0.186.0不变；依赖与锁未改。素材处理另用FFmpeg9.0和Python3.13.9。
- 原有两模式/两路径、最后手部操作/团圆、五区八件、PNG/JSON、只读重演、四机位及有限合成音效保留。ProjectV1、唯一演出时钟、关节拓扑及既有道具bounds未改。

## 作者本轮修改与实际实现

作者回复是三项修改意见，不是当前版定稿批准。不从“继续”或外部音乐CC许可推导全体审定。

- 三角色head颈前局部纸底解除肤色保护，只剔纸色；三处纸底alpha采样透明，母亲衣领/二郎神胡须仍保留。九张head三图更新，其余人物部件与已压暗背景保留。
- 内置image_gen按原方向图生成斧/提灯、守关兵器两张精细透明源，确定性裁切后接入。旧审看册把守关兵器误标为灯，现已更正；新增chenxiang-lantern，call-light与split-search实际举灯。当前81PNG，旧80ID保留。完整原提示/源SHA在docs/art/t10-props-v2-prompts.md，近看图t10-neck-props-study.png。已目检实际手持绘制、颈前轮廓与宽窄屏，无横向溢出。
- 独立戏曲音乐开关默认关闭，不创建Audio或请求文件。开启后非剧情页用京胡器乐，剧情随播放/资源/保存暂停；失焦/隐藏保留位置，回焦续播；reunion-reach及reunion-hold各自前两秒安静，实际curtain选唱段。静音/切曲/pagehide释放媒体，迟到play隔离，失败明确重试。合成舞台音效仍独立，不增加存档字段或时钟。
- 两条本地MP3：京胡96秒1,152,670bytes；谢幕人声+同步京胡40秒480,906bytes。JaCRC v2.0的NACTA新录音《贵妃醉酒·海岛冰轮初转腾》，宋若萱演唱、Rong Gong录音，京胡演奏者未单独署名；CC BY 4.0。网站状态旁/关于页标明署名、来源及节选/响度/淡入淡出/混音改动，不冒称本剧原声或地方皮影唱腔。
- scripts/prepare-opera-music.mjs严格HTTP206/Content-Range只取两ZIP成员约58.4MB，验证CRC及WAV/MP3 SHA；不下载整7.1GB。提取记录docs/audio/jacrc-extraction.json，公开许可证据docs/reviews/jacrc-music-license.md。完整解码测得京胡-22.5 LUFS/-9.3dBFS true peak，谢幕-18.8/-3.5，处理参数中的LUFS为目标；实测见decoded-metrics.json，不代扬声器听感。

## 实际验证与边界

- 33文件388/388单元通过1.92秒；最终build含typecheck通过118模块2分10秒，14legacy ES5/六HTML双入口通过。81图/颈部像素、18节点/两路径+五区八件、音乐签名/字节/SHA和19任务结构检查通过。
- 最终336项浏览器首轮315通过/21失败，另两条工作进程退出超时，工具报告3.2小时，含异常长停顿，根因未证实。随后同一生产包单工作进程复验21/21通过172.48秒：期望等待15秒、默认用例90秒，原测试显式上限/业务断言/演出时钟不改。共336项已覆盖，无未解决失败；不能称为一次336全绿或性能通过。完整摘要/首轮错误见docs/evidence/t10-music-functional-checks.json。两视口1440×900/390×844，Chromium156.0.8078.4；新增10项音乐用例首轮全通过。
- 生成器重跑88文件（81PNG、清单、三模板、场景、CSV、剧情）全部字节一致；evidence/t10-neck-props-reproducibility.json绑定各文件SHA。既有三角色真实几何/8目标仍通过，不降低.35覆盖/.04手距门槛。
- 审看册快照8123e59ec836a86e796b473d46cf3a76447d5369bacc2079a89b6285c096a2ce，130唯一项/84图/2音频。HTTP桌面/file桌面/HTTP模拟手机均实测搜索/筛选、全部图片、无横向溢出和零业务存储调用；HTTP两段原生控件实际播放，时长96/40秒。展开源图的横向溢出已修。概要图先收集再算snapshot；改变当前近看/舞台PNG字节均真实STALE/1，恢复后--check通过，重复HTML字节一致且账本不变。
- 静态现代入口+4个modulepreload gzip102,878bytes，低于200KiB；t10-music-entry-budget.json保存逐文件/indexSHA。只是JS静态预算，不含音频/图片，不代表冷启动/FPS/设备或完整时长验收。
- 130项摘要均匹配，review全pending；仅两条music rights据公开CC许可granted。release资产/内容243/50待核，Node子进程实测退出2。实体IE/手机/Safari、完整SAVE边界、真实时长/音量/听感、fps与至少3位陌生人体验仍未验收。

## 集成与清理

音乐独立贡献1dc06de723db564ad62700be6c0d197184f8dbc2按文件接收。独立只读复核发现失焦重开P2后已修为原位置续播，实际浏览器断言通过；后续独立复核因服务额度未执行，root完成接线核对。该树Git干净、无依赖junction；归档返回queued，目录仍在，不手工删除托管树。

22张被回归改写的历史PNG已恢复；保留本轮源图、近看/实际舞台/审看截图、必要诊断、音乐与dist。原WAV和空源缓存已清理；三份临时预览/复验配置/原始报告逐项删除，test-results核对绝对路径和无reparse后逐项无Force/无递归清理1文件0子目录，目录已不存在。临时截图过程等待隐藏懒加载图已停止其专属进程树，显式加载后重拍完成，不影响产品或复验结果。

用户DOCX/PPTX未读未改未提交，暂存blob保持6e2b3c8a51d0e85b4e4c32f2294e9ab3bdf313cb及277174bc62ffdf18cde8656f89a9bfeec85dc165。

## 下一位首先执行

1. 核对源码91d5dbf3ee370a8a2f16d7c10541cacd09f2bb76、Git/暂存与5173；运行审看册--check识别材料是否过期。无新改动/失败/疑点不要再跑全量；本轮未解决失败为0，但不是性能验收。
2. 接收作者对当前具体设计/文化和本项目原创素材使用范围的明确结论，有真实证据才更新相应review/rights与摘要；不把“继续”当批准。音乐公开CC许可已独立登记。
3. 可按docs/acceptance/t11-readiness.md补SAVE-02关闭标签/保存后图像加载窗口、SAVE-07产品双标签与500ms边界及性能准备，T11/T13不跳依赖、不记提前验收；P1仍G3后。
