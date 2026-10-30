# T44 用户建议来源核对（2026-10-30）

| 来源 | 本轮实际访问 | 采用内容与位置 |
| --- | --- | --- |
| [皮影数字博物馆 · 审美功能](https://shadow.caa.edu.cn/#/pygn/smgn) | HTML 200但无静态正文；按公开router.js → Pygn.js → utils/http.js、config.js定位[同站正文JSON](https://shadow.caa.edu.cn/api/pygn.smgn.json?__language=zh)，HTTP 200，正文可读 | C8：线条、服饰与头茬／身段组配；改写为E02观察卡和文化事实，不复制全文 |
| [hnpsart](http://www.hnpsart.com/) | Web读取超时；本机HTTP 502、HTTPS连接被关闭 | 未确认正文、站点主体或单图许可，未作为事实来源，也未下载媒体 |
| [中国西安数字皮影博物馆](http://www.leather-silhouette.com/ydy) | HTTPS握手失败；HTTP首页200。读取首页明确引用的`nwzimg.wezhan.net/pubsf/18024/18024358/cdn-static-pages/pages/pc/1734942_zh-cn.html.Body.js?version=20260908160323`，解码document.write后确认导航分类、首页简介及页尾主体 | C9：头插、影身之外的桌椅、云朵子、布景分类；改写为E01观察卡和文化事实 |

使用Python urllib读取公开文本及BeautifulSoup提取正文，未执行远程JavaScript，未操作浏览器登录会话。完整原文、图片和脚本未保存进仓库。

两条新增来源的textLicense/imageLicense/audioLicense均为unknown，usage为reference-only。没有确认图片复用许可，因此没有新增下载、热链、贴图替换或改变既有图像清单。本轮只把可核对的事实与短观察提示整合到既有展签，不改变五区七展签结构或实验模型。既有T10素材审定和外部照片许可问题继续由原任务记录。
