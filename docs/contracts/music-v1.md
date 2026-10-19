# 本地录音音乐播放合同 v1

`src/audio/stage-music.ts` 使用 HTMLAudioElement 播放经来源和许可核对后随项目保存的音乐文件。它独立于有限合成舞台音效，不要求 AudioContext，不改变剧情、保存、目录版本或演出时钟。

## 接口与消费者

`createStageMusic(onStatus, { tracks, createAudio? })` 返回 `enable(): Promise<boolean>`、`mute()`、`update(sample)`、`reset()`、`dispose()`。`MusicTrack` 为 `{id,src,title,credit,volume,loop}`；消费者提供稳定且唯一的 id、本地 src、准确标题和署名。volume 取 0—1；越界会夹取，非有限值回退 .3。音乐资源和版权记录由内容清单维护，播放器不下载外部音乐或推断许可。

`MusicSample` 为 `{trackId:string|null,playing:boolean}`。唯一演出时钟与路由拥有选曲权：页面通常使用纯器乐，谢幕可选唱段；剧情暂停、剧情资源未准备或等候保存时，以及全站窗口失焦/页面隐藏时，应送入 playing:false。失焦或隐藏保留所选 trackId，使回到页面后从原位置继续。reunion-reach（伸手）与 reunion-hold（相见）两个节点各自的前两秒由消费者送入 trackId:null 保持安静。播放器不自己判断剧情时间，不申请 RAF、interval 或 timer，不写 Store。

`MusicStatus` 为 `{state,message,trackId}`，state 可为 muted、enabling、enabled、unavailable、error、disposed。消费者展示真实 message。enabled 表示已保留用户启声选择，暂停或静候时可以没有实际声响；不表示扬声器音量或实体设备已验收。onStatus 不应抛异常。

## 用户授权与浏览器策略

构造及静音状态 update 都不创建 Audio、设置 src 或加载文件。仅用户显式操作调用 enable 后才允许创建播放器、设置本地 src、调用 play。enable 在已有 playing 样本时同步调用 play，保留用户操作上下文；当前暂停或无曲时只记录启声偏好，直至后续 playing:true 才尝试实际播放。

现代浏览器的 play Promise 拒绝，以及旧式返回 void、同步异常、error 事件均有明确处理。浏览器若拒绝后续播放，报告 error、清理资源并取消启声偏好；需用户再点击 enable 重试。未知曲目、加载和解码错误也遵循此规则。不以已点击按钮或 Promise 尚未结束宣称播放成功。旧浏览器返回 void 的 enabled 只表示同步调用已接受，后续 error 仍报告；不能据此推断音频可听。

## 暂停、切曲与异步清理

同曲暂停会调用 pause，保留原媒体对象和播放位置；继续时不 seek、不补播经过的剧情，也不反复建立元素。同曲每个未决 play 去重。换曲释放旧媒体，再在需要播放时创建新媒体，从新曲开头播放。trackId:null 释放上一曲；静候后的曲目重新开始。

mute 会取消启声偏好，dispose 幂等且使实例永久退出。两者及切曲、reset 均先使旧请求失效，然后依次移除 error 监听、pause、removeAttribute('src')、load；不把 src 设置为空字符串，避免请求当前页面。任一步清理失败仍尝试剩余清理并报告具体问题。reset 清除样本并释放曲目，同时保留正常已开启的偏好，等待消费者送入新样本。

暂停、重开、换曲、静音和退出后的迟到 play 成功会再次停止属于旧请求的媒体；若同一媒体已有新的有效播放，则旧回调不打断它。迟到拒绝与已移除监听的旧 error 不覆盖新曲状态。旧媒体停止异常会附在当前真实状态下报告，不把新开关或曲目变成旧请求的状态。

## 验证边界

单元替身验证默认不创建、暂停位置、曲目切换、异步迟到、显式重试、void play 和资源清理。替身不证明音乐内容、真实自动播放策略、网络解码、音量/混音、扬声器听感或手机/Safari/IE 设备兼容；集成页面与真实环境另验。音乐播放失败不改变字幕、互动、节点推进或存档。

曲目处理记录中的 LUFS 是滤镜目标，成品淡入淡出与 MP3 编码后的完整解码实测另见 `docs/audio/decoded-metrics.json`：京胡 -22.5 LUFS / -9.3 dBFS true peak，谢幕 -18.8 LUFS / -3.5 dBFS true peak。该记录绑定成品 SHA，仅验证数字信号，不等于扬声器听感。
