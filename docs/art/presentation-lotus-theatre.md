# 首页莲灯画面与题字字体

2026-10-25，为作者指定的首页“一幕团圆”装饰画新增。正式剧情场景和原影偶/音频未替换。

- 文件：`public/assets/presentation/lotus-theatre.png`，1122×1402，RGB，3,043,466 bytes。
- SHA-256：`31d874df87927ab464796e814332f6a7b7c028f1226392d02121c502586bdbe8`。
- 生成工具：内置 `image_gen`。方向为皮影风格的精细朱砂木框、宝莲灯暖金透光、华山云水、纸幕织理；中央留出独立 HTML 题字空间，不在图片烘焙文字。
- 原始返回文件：`C:/Users/zhang/.codex/generated_images/01a15bd0-b0a3-7922-85d0-732dc19e15de/exec-50d38075-61f2-4bd4-833e-0f228842b013.png`。仓库保留原分辨率副本，资源清单独立于游戏分件。
- 制作过程归属 AI 辅助美术；并未据此登记作者美术审定或使用范围批准。正式审看项 `asset:presentation-lotus-theatre` 仍 pending。

标题字体采用 [Ma Shan Zheng 官方仓库](https://github.com/googlefonts/mashanzheng)，OFL-1.1。源 TTF 和完整许可保留于 `docs/art/presentation-font/`，实际 WOFF2 与许可置于 `public/assets/presentation/`。`scripts/prepare-presentation-font.py` 用 fontTools 生成覆盖当前标题字符的字集；完整哈希、字集和文件大小见同目录 manifest.json。正文和控件不替换成书法字体，失败沿用原字体。
