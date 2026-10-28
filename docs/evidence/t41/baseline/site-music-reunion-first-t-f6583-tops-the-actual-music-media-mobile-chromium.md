# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-music.spec.ts >> reunion first two seconds stay quiet and paused story stops the actual music media
- Location: tests\e2e\site-music.spec.ts:26:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "跳到主要内容" [ref=f1e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=f1e3]:
    - link "皮影艺术数字文化馆首页" [ref=f1e4] [cursor=pointer]:
      - /url: "#/"
      - generic [aria-hidden] [ref=f1e5]: 影
      - generic [ref=f1e6]:
        - text: 皮影艺术
        - generic [ref=f1e7]: 数字文化馆
    - button "菜单" [ref=f1e8] [cursor=pointer]
    - button "我的作品" [ref=f1e9] [cursor=pointer]:
      - text: 我的作品
      - status [ref=f1e10]: 已保存
    - button "关闭戏曲音乐" [pressed] [ref=f1e11] [cursor=pointer]
  - main [ref=f1e12]:
    - generic [ref=f1e13]:
      - generic [ref=f1e14]:
        - generic [ref=f1e15]:
          - paragraph [ref=f1e16]: 幕前
          - heading "这一场，从此刻接续。" [level=1] [ref=f1e17]
          - paragraph [ref=f1e18]: 每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。
          - img [aria-hidden]:
            - generic: 这一场，从此刻接续。
        - navigation "这一场的去处" [ref=f1e19]:
          - link "制偶" [ref=f1e20] [cursor=pointer]:
            - /url: "#/craft"
          - link "灯影" [ref=f1e21] [cursor=pointer]:
            - /url: "#/light"
          - link "剧场" [ref=f1e22] [cursor=pointer]:
            - /url: "#/story"
          - link "练习" [ref=f1e23] [cursor=pointer]:
            - /url: "#/practice"
        - complementary "当前台词" [ref=f1e24]:
          - generic [ref=f1e25]: 幕上此刻
          - paragraph [ref=f1e27]: 沉香：娘，我回来了。
        - generic [ref=f1e28]:
          - figure [ref=f1e30]:
            - img "皮影舞台" [ref=f1e32]
            - paragraph [ref=f1e34]: 先听这一段，再接过操偶。
            - generic [ref=f1e35]:
              - button "展开戏台空间" [ref=f1e36] [cursor=pointer]
              - status [ref=f1e37]: 从幕前走到背面，看灯、薄片与操偶杆。
          - generic [ref=f1e39]:
            - status [ref=f1e40]: 正在播放当前片段，后续片段会自动接续。
            - heading "让我看看你" [level=2] [ref=f1e41]
            - paragraph [ref=f1e42]: 让两只影偶安静停留四秒，然后由你点击谢幕。
            - paragraph [ref=f1e43]:
              - text: 本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。
              - link "去制偶页 →" [ref=f1e44] [cursor=pointer]:
                - /url: "#/craft"
            - paragraph [ref=f1e45]: 让我看看你
            - generic [ref=f1e46]:
              - paragraph [ref=f1e47]: 点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。
              - navigation "当前片段台词定位" [ref=f1e48]:
                - button "定位到第1句，沉香：娘，我回来了。" [ref=f1e49] [cursor=pointer]: 沉香：娘，我回来了。
                - button "定位到第2句，母亲：让我看看你。" [ref=f1e50] [cursor=pointer]: 母亲：让我看看你。
              - button "展开本段完整台词" [ref=f1e51] [cursor=pointer]
            - generic [ref=f1e52]:
              - text: 演出节奏（暂停时可切换）
              - combobox "演出节奏（暂停时可切换）" [disabled] [ref=f1e53]:
                - option "完整演出" [selected]
                - option "节选导览"
            - generic [ref=f1e54]:
              - button "继续片段" [disabled] [ref=f1e55]
              - button "暂停" [ref=f1e56] [cursor=pointer]
              - button "重开片段（暂停）" [ref=f1e57] [cursor=pointer]
              - button "跳过本段，进入《幕后的双手》" [ref=f1e58] [cursor=pointer]
            - generic [ref=f1e59]:
              - button "关闭舞台音效" [pressed] [ref=f1e60] [cursor=pointer]
              - status [ref=f1e61]: 舞台音效默认开启；点击或按键后由浏览器自动解锁。
            - paragraph [ref=f1e62]: 每次进入剧场会自动开演，暂停后可继续片段。声音可选，静音也保留全部字幕与操作。
            - link "先去展馆走走 →" [ref=f1e63] [cursor=pointer]:
              - /url: "#/museum"
      - navigation "推荐体验顺序" [ref=f1e64]:
        - paragraph [ref=f1e65]: 这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。
        - list [ref=f1e66]:
          - listitem [ref=f1e67]:
            - link "1 故事缘起" [ref=f1e68] [cursor=pointer]:
              - /url: "#/"
          - listitem [ref=f1e69]:
            - link "2 制偶" [ref=f1e70] [cursor=pointer]:
              - /url: "#/craft"
          - listitem [ref=f1e71]:
            - link "3 调灯" [ref=f1e72] [cursor=pointer]:
              - /url: "#/light"
          - listitem [ref=f1e73]:
            - link "4 练习" [ref=f1e74] [cursor=pointer]:
              - /url: "#/practice"
          - listitem [ref=f1e75]:
            - link "5 正式演出" [ref=f1e76] [cursor=pointer]:
              - /url: "#/story"
          - listitem [ref=f1e77]:
            - link "6 留影成果" [ref=f1e78] [cursor=pointer]:
              - /url: "#/result"
          - listitem [ref=f1e79]:
            - link "7 展馆" [ref=f1e80] [cursor=pointer]:
              - /url: "#/museum"
      - button "再练一次" [ref=f1e81] [cursor=pointer]
  - contentinfo [ref=f1e82]:
    - generic [ref=f1e83]: 影作 · 据传统故事原创交互改编
    - link "让幕后的创作，也被看见 ↗" [ref=f1e84] [cursor=pointer]:
      - /url: "#/about"
    - link "素材致谢" [ref=f1e85] [cursor=pointer]:
      - /url: ./credits.html
    - button "切换全站装饰动效" [pressed] [ref=f1e86] [cursor=pointer]: 动效 · 灯火流转
```