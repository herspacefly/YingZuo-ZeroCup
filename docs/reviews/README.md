# 设计稿与内容审看

更新：2026-10-27。现有[T10审看册](t10-review.html)是历史只读快照，不是当前v5与中文配音的完整审看材料。本轮只读检查 `node scripts/build-review-packet.mjs --check` 返回 `STALE`；未重建快照、修改生成器或登记任何批准。

现有生成器按人物分件、场景／附件／纹样、v1—v4剧情、展签、事实、图文与声音整理材料，**尚未自动纳入v5的38节点、按四次选择派生的对白，以及354条中文角色配音与其时间编排**。当前公开展馆是五区七展签；旧E08记录属于兼容历史，不能据旧说明恢复公开展项。仅重跑现有生成器也不能补齐上述范围，后续须先扩展生成与审定对象；本轮仅记录缺口。

v5选择与正文先读[v5契约](../contracts/story-v5.md)及实际 `src/content/stories/reunion-v5.json`／选择派生实现；中文配音另读[T38验收](../acceptance/t38.md)、38条[试听页](../evidence/t38/listen.html)及[读音清单](../content/voice-v5-pronunciation.md)。试听页是四角色、最长句、派生回顾和五终章后记的校对入口，不代表354条已完成人耳逐句听审。T38仍为 `in_progress`，具体状态以任务账本为准。

旧审看册可搜索、展开、查看原图和打印，本地文件与HTTP都能打开，不读取或写入业务存档。开发服务启动后可访问http://127.0.0.1:5173/docs/reviews/t10-review.html；应结合其历史范围与过期状态阅读。

审看册是只读快照，没有批准按钮；浏览它不修改本账本。使用 `node scripts/build-review-packet.mjs` 重建，`node scripts/build-review-packet.mjs --check` 检查内容/账本/预览是否已变化，过期返回1/STALE。生成过程不推导审看或权利确认；需作者对当前具体内容与本项目原创素材使用范围分别明确确认，再按下述证据协议登记。文化访问复核见[t10-source-follow-up.md](t10-source-follow-up.md)，后续SAVE/设备/性能缺口见[验收准备](../acceptance/t11-readiness.md)。

`t10-review.json`保留264条历史记录，当前均为review pending，仅两首音乐的rights有独立granted证据；数量不是最新完整作品的审定数。实际待核对象还涉及展馆图文与外部照片，生成对象可能与历史账本不同。不得从旧数量或“可运行”推导v5、新配音、当前展馆及素材已审定。

运行 `node scripts/review-gate.mjs --prepare` 可为新增/未审项目登记当前SHA；已approved记录保留原SHA，内容变化会使旧审定失效。该操作不生成任何授权。

作者实际确认后，集成人才可据真实确认更新相应记录：review包含approved、reviewer、reviewedAt（YYYY-MM-DD）、evidenceFile及该文件SHA；证据放在本目录可读Markdown内。图像或声音的rights还需要granted、实际holder、terms和证据。terms只允许本项目实际采用的project-authorized、CC0-1.0、CC-BY-4.0或CC-BY-SA-4.0，并须与资产清单一致。不得凭任意非unknown字符串绕过。

`npm run verify:assets -- --release`检查PNG哈希、清单reviewStatus／许可和逐项审定／权利记录；`npm run verify:content -- --release`按现有审看生成对象检查节点、展品、事实、图文和声音源，需权利的对象另核证据。v5／新配音尚未进入该发布审看范围，不能用这两个命令的结果代替它们的审定；普通五版内容检查与 `npm run verify:voice`是另一组结构／音频功能检查。证据文件缺失或改变会使记录无效。直接运行校验脚本时，未齐备退出2，格式／资源错误退出1。这是项目内部证据检查，不能替代文化判断、视觉／听感判断或实际授权，也不是赛事官方结论。

本轮提供内置image_gen方向图及完整原提示（docs/art/）、实际分件组装与宽窄屏舞台截图（docs/art/t10-neck-props-study.png、docs/evidence/t10-neck-props-*，此前组装/动作证据仍保留t10-reference-*）、测量裁切/绑定规则（scripts/art/reference-*.mjs）、同风格道具源图、原生纹样与合成声音配方、可试听的两首戏曲音乐。资产审定摘要包括实际PNG/元数据、provenance、模板绑定、场景、纹样、配色和色区着色模式，调整比例或来源配色会使旧审定失效。它们是审看的具体对象，尚未标成提交定稿。

既有作者修改意见及T38“保持当前声线与自然语速／暂无修改意见”的反馈，不等于全体定稿或全量人工听审。两首音乐的公开CC BY 4.0许可有独立证据jacrc-music-license.md，rights据已有公开许可登记，内容／听感review仍pending；其余素材许可不由此推导。12张外部照片的复用许可仍记为unknown，AI辅助来源与配音制作方式见素材致谢及T38材料，不自行补成使用批准。

## 历史补充

2026-10-24补充：v4新增36节点已登记pending；展签、灯影、动态附件与声音变更已更新摘要，未推导审定。审看册包含本轮灯影与五种终章截图，并保留标注的历史画面；产品默认开启声音，本只读册不自动播放。

2026-10-25补充：首页莲灯图作为独立第264项登记pending；本地书法字体OFL许可与生成来源保留在presentation目录和素材致谢页。审看册加入新首页/练习/320px/三维调灯/开演前入口及窄屏五终章静帧，不由截图推导任何审定。
