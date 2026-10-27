# T39：仓库改名与GitHub Pages连续部署

用户授权更新本地远程地址、修复公开子目录运行并推送；后台点击由用户自行完成，不使用computer use。

## 实现

- origin改为`git@github.com:herspacefly/YingZuo-ZeroCup.git`，main继续跟踪origin/main；本地目录不搬迁。
- 保留Vite相对base，展馆照片统一经部署base解析，原始媒体清单／哈希／许可不改；CSS资源由Vite转换，原有纹理、音乐与配音相对路径保留。
- GitHub Actions在main普通push后按Node24/npm12安装、检查、构建，验证根路径及`/YingZuo-ZeroCup/`子目录，再上传且只上传dist部署。保留手动触发入口。
- Pages后台Source需选择GitHub Actions，用户负责点击；不发布源码目录、不将dist提交到main，也不把上线成功等同正式素材／听感／设备验收。

## 验证

类型、必要单元、资源／内容／声音／ES5及新增生产包根路径和子目录浏览器回归；覆盖照片与灯箱、字体、幕面、音乐／配音、保存刷新及导出。推送后核对Actions实际结果、公开HTML及资源HTTP，并执行线上冒烟。

## 边界

不迁移剧情、存档和本地用户数据，不调整原素材品质或重做艺术审看。公开域名与localhost的浏览器存储互不共享；通过已有JSON导出／导入迁移作品。
