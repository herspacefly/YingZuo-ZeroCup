# 设计稿与内容审看

t10-review.json列出当前127项：80张PNG、18节点、8展品、20事实、1组声音源。所有记录初始pending，不从“可运行”推导作者审看或项目使用许可。

运行 `node scripts/review-gate.mjs --prepare` 可为新增/未审项目登记当前SHA；已approved记录保留原SHA，内容变化会使旧审定失效。该操作不生成任何授权。

作者实际确认后，集成人才可据真实确认更新相应记录：review包含approved、reviewer、reviewedAt（YYYY-MM-DD）、evidenceFile及该文件SHA；证据放在本目录可读Markdown内。图像或声音的rights还需要granted、实际holder、terms和证据。terms只允许本项目实际采用的project-authorized、CC0-1.0、CC-BY-4.0或CC-BY-SA-4.0，并须与资产清单一致。不得凭任意非unknown字符串绕过。

verify:assets --release检查当前PNG哈希、清单reviewStatus/许可和逐项审定/权利记录；verify:content --release检查节点/展品/事实/声音源哈希及审看，声音另核权利。证据文件缺失或改变会使记录无效。未齐备退出2并列出实际待核ID，格式/资源错误退出1。这是证据完备性检查，不能替代作者的文化判断、视觉/听感判断或实际授权。

本轮提供内置image_gen艺术方向图及完整提示（docs/art/）、四张舞台截图（docs/evidence/t10-*）、可读路径源（scripts/art/）和合成声音配方（src/audio/、src/content/sound-cues.ts）。它们是审看的具体对象，尚未标成提交定稿。
