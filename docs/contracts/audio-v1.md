# 有限原创合成舞台声音合同 v1

作者追加网上戏曲器乐背景与谢幕唱段，由独立HTMLAudio服务实现，见[music-v1](music-v1.md)和src/content/music.json。本合同下文“无外部声音/不循环”等仅指原有合成提示声。两个开关独立、默认均关闭，音乐同样遵守剧情暂停与团圆前两秒安静。

适用于 T10 的剧情增强声音。消费者为剧情 controller；声音不拥有演出时钟、输入、命令、保存或节点推进。关闭声音时对白字幕、视觉提示和全部操作保持完整。

## 调用与权限

`createStageSound(onStatus, options?)` 返回 `enable(): Promise<boolean>`、`mute()`、`update(sample)`、`reset(nodeId)`、`dispose()`。默认只报告静音状态，不创建 AudioContext；用户点击“开启声音”后才调用 `enable()`。刷新或重新挂页不继承启声许可。legacy、缺少 AudioContext 时明确报告不可用，不尝试加载文件或补丁。

`StageSoundStatus` 是 `{state,message}`，state 为 `muted/enabling/enabled/unavailable/error/disposed`。enabled 只说明用户已开启音频设备，不代表场面正在播放，也不代表扬声器音量或实体设备已验收。设备创建、resume、声源启动和清理失败提供真实说明；消费者展示 message。

`update({nodeId,mode,elapsedMs,playing,event?})` 使用现有节点内容时间，mode 为 full/guided。每次采样传入即可；暂停、失焦、资源失败、等待保存、离页之前必须送入 playing:false，离页再 dispose。音频不申请 RAF、setInterval、另一个演出时钟，也不生成存档字段。

用户实际完成开山、寻光和伸手动作并开始其 resolution 时，可分别传入 `mountain-open/light-found/hands-meet`。重复携带同一 event 不重播；只有相应 axe、light、reach 节点接受事件。不会依据用户已等待多少秒猜测开山或互动成功。消费者可在一次 update 内传入事件；如果处于暂停，该事件被消费且不补播。

## 时序和稀疏声音

`src/content/sound-cues.ts` 保存原创的有限提示表，静态 cue 以完整版内容时间表示，再按同一节点 full/guided targetMs 比例映射，和 director 的分镜比例一致。点灯为短三角音；隔山和阻拦为合成低音；实际开山为短噪声与低音；回应、团圆和谢幕为轻量收束。

声源每次 0.24—0.48 秒，不循环底乐、不发出人声、唱腔、乐器录音或掌声。合成配方和时间表是本作原创设计，不用于宣称地方音乐、传统音色或真实观众反馈。无外部声音文件、下载、网络请求或素材授权依赖；不能据此宣称全剧声音已通过听感或实体设备验收。

reunion-hold 在 2500ms 才进入一次轻收束，前两秒完全静候；导览与完整版该节点均为 4000ms。开山声只出现在实际 resolution 起点，进入静候节点会停止前一节点的所有声源。

同一节点每 cue/event 至多一次，重开必须显式 `reset(nodeId)`；节点或模式变化会自动清理并清空去重记录。暂停立即 stop/disconnect，不续接被截断的短声、不补发暂停期间或开启声音之前经过的 cue。连续采样超过 cue 220ms 的迟到窗口会直接跳过，长帧不堆积声音。迟到或倒退采样不清空已消费的 cue。

## 生命周期与验证边界

声源结束后释放其 gain/连接和 onended；暂停、节点变化和 reset 立即停止全部活跃声源。mute 同时关闭 context，后续用户显式启声才新建。dispose 幂等并关闭 context、清空去重和样本。等待 resume 时发生暂停、节点变化、reset、mute 或 dispose，会使该请求失效并关闭旧 context；其迟到成功/失败不会开启声音。正常已启声状态可跨节点保留明确偏好，但仍在每节点边界清理声源。

options 中的 legacy/createContext 仅用于能力选择和依赖注入，音频接口不进入 Project。单元替身证明默认不建、异步取消、暂停/静音释放、去重/重开、故障和时序边界；不证明浏览器自动播放策略、真实扬声器听感或手机/Safari 兼容。生产浏览器由集成人另验，实体与听感验收留 T11/T13。
