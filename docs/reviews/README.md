# 设计稿与内容审看

先打开[当前审看册](t10-review.html)，或在开发服务访问http://127.0.0.1:5173/docs/reviews/t10-review.html。它把全部264项按人物分件、场景/附件/纹样、剧情全文、八件展签、事实与声音分组，并附当前来源记录和实际舞台画面。可搜索、展开、查看原图和打印；本地文件与HTTP都能打开，不读取或写入业务存档。

审看册是只读快照，没有批准按钮；浏览它不修改本账本。使用 `node scripts/build-review-packet.mjs` 重建，`node scripts/build-review-packet.mjs --check` 检查内容/账本/预览是否已变化，过期返回1/STALE。生成过程不推导审看或权利确认；需作者对当前具体内容与本项目原创素材使用范围分别明确确认，再按下述证据协议登记。文化访问复核见[t10-source-follow-up.md](t10-source-follow-up.md)，后续SAVE/设备/性能缺口见[验收准备](../acceptance/t11-readiness.md)。

t10-review.json列出当前264项：81张游戏PNG、1张首页莲灯画、126个版本化节点（v4/v3/v2各36、v1 18）、8展品、20事实、1组合成声音源、2首音乐。所有记录初始pending，不从“可运行”推导作者审看或项目使用许可。

运行 `node scripts/review-gate.mjs --prepare` 可为新增/未审项目登记当前SHA；已approved记录保留原SHA，内容变化会使旧审定失效。该操作不生成任何授权。

作者实际确认后，集成人才可据真实确认更新相应记录：review包含approved、reviewer、reviewedAt（YYYY-MM-DD）、evidenceFile及该文件SHA；证据放在本目录可读Markdown内。图像或声音的rights还需要granted、实际holder、terms和证据。terms只允许本项目实际采用的project-authorized、CC0-1.0、CC-BY-4.0或CC-BY-SA-4.0，并须与资产清单一致。不得凭任意非unknown字符串绕过。

verify:assets --release检查当前PNG哈希、清单reviewStatus/许可和逐项审定/权利记录；verify:content --release检查节点/展品/事实/声音源哈希及审看，声音另核权利。证据文件缺失或改变会使记录无效。未齐备退出2并列出实际待核ID，格式/资源错误退出1。这是证据完备性检查，不能替代作者的文化判断、视觉/听感判断或实际授权。

本轮提供内置image_gen方向图及完整原提示（docs/art/）、实际分件组装与宽窄屏舞台截图（docs/art/t10-neck-props-study.png、docs/evidence/t10-neck-props-*，此前组装/动作证据仍保留t10-reference-*）、测量裁切/绑定规则（scripts/art/reference-*.mjs）、同风格道具源图、原生纹样与合成声音配方、可试听的两首戏曲音乐。资产审定摘要包括实际PNG/元数据、provenance、模板绑定、场景、纹样、配色和色区着色模式，调整比例或来源配色会使旧审定失效。它们是审看的具体对象，尚未标成提交定稿。

本轮作者回复为修改意见，不是定稿批准。两首音乐的公开CC BY 4.0许可有独立证据jacrc-music-license.md，rights据已有公开许可登记，内容/听感review仍pending；其余素材许可不由此推导。

2026-10-24补充：v4新增36节点已登记pending；展签、灯影、动态附件与声音变更已更新摘要，未推导审定。审看册包含本轮灯影与五种终章截图，并保留标注的历史画面；产品默认开启声音，本只读册不自动播放。

2026-10-25补充：首页莲灯图作为独立第264项登记pending；本地书法字体OFL许可与生成来源保留在presentation目录和素材致谢页。审看册加入新首页/练习/320px/三维调灯/开演前入口及窄屏五终章静帧，不由截图推导任何审定。
