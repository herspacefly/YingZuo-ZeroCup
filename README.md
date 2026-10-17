# 影作 · 一幕团圆

据传统故事《劈山救母》原创交互改编的短戏与数字展馆。已有 **T00工程**、**T03正式数据层**、**T01占位资产**、**T15文字剧情状态机**与 **T02产品页面骨架**。产品首页、制偶配色/纹样、当前剧情检查点、五区八件目录与节目单共用正式存档；图形演出、手动操偶、正式美术和展品互动仍在后续任务中接入。独立文字排演可走通完整/导览的两条路径，并保存、刷新接续。

接手先读 [START_HERE](START_HERE.md)、[项目约定](AGENTS.md)、[当前状态](docs/STATE.md)和[任务账本](docs/tasks.json)。设计依据见[主方案](docs/plans/2026-10-15-yingzuo-design-and-implementation.md)与[叙事稿](docs/content/2026-10-15-yingzuo-story-bible.md)。

## 本地启动

使用 Node.js **24.x** 与 npm。当前实测 Node v24.18.1、npm 12.0.2；依赖以 `package-lock.json` 为准。

```powershell
npm ci
npm run dev
```

默认打开[产品首页](http://127.0.0.1:5173/#/)，其他入口包括[制偶](http://127.0.0.1:5173/#/craft)、[展馆目录](http://127.0.0.1:5173/#/museum)、[节目单](http://127.0.0.1:5173/#/result)。原T00首页保留为[独立灯影试作](http://127.0.0.1:5173/study.html)；[运行检查](http://127.0.0.1:5173/probe.html)使用独立探针库；[存档工作台](http://127.0.0.1:5173/project.html)用于正式项目数据、自动保存、恢复与文件检查；[资产检查](http://127.0.0.1:5173/assets.html)显示三角色中性组装、镂空与场景层；[文字排演](http://127.0.0.1:5173/story.html)验证节点、两路径、完成时间与正式存档。无运行时 CDN、远程字体、API 或环境密钥。使用静态本地服务器，不能直接双击 HTML 运行模块。

## 检查与生产预览

```powershell
npm run typecheck
npm test
npm run build
npm run verify:legacy
npx playwright install chromium
npm run test:e2e
npm run verify:state
npm run verify:assets
npm run verify:content
```

`test:e2e` 会启动生产预览服务，占用 4173 端口；请先停止该端口上的其他预览服务。测试含 1440×900 与 390×844 Chromium 视口，手机视口属于模拟。测试截图和失败诊断写到忽略的 `test-results/`。T00 已保留两张[桌面](docs/evidence/t00-desktop.png)／[窄屏](docs/evidence/t00-mobile.png)检查截图。

`verify:assets`检查实际PNG、引用、CSV与哈希；`verify:content`检查18节点图、两条路径、角色/附件/姿态/图层、字幕时间基准与来源/资源引用。开发结构有效时通过。两项加`-- --release`均在当前阶段明确NOT_READY/退出码2；正式美术、文化与许可审定仍待T10。

```powershell
npm run build
npm run preview
```

生产预览默认 <http://127.0.0.1:4173/>，输出目录为 `dist/`。Vite 7.3.7 与 legacy 插件 7.2.1 已锁定；显式构建 IE11 目标，并检查 legacy 产物的 ES5 语法。曾实际发现 Vite 8 组合生成的 legacy 辅助代码含 ES2015 语法，因此本阶段使用已通过产物检查的 7.x 组合。升级工具链后须重做产物和浏览器探针。

**真实 IE11／IE 模式尚未验收。** Chromium 中强制执行 legacy 包只属于产物冒烟检查。后续 T11 需在真实环境补测完整流程、存储及文件下载；不将系统中存在 IE 启动器视作 IE 测试通过。

## 存储探针的边界

- `probe.html` 仅使用 `yingzuo-compat-probe-v1` 数据库，`samples` 仓库保留 current 和 backup；不访问未来正式作品的 `yingzuo-v1`。
- 保存等待整个事务 `oncomplete`，同时写入备份与当前记录。回滚检查在写入成功后中止事务，再核对两条记录。
- 同旧版本的第二写入者会收到冲突反馈并保留页面内灯位。禁止存储时明确未保存，仍可下载测试 JSON。
- study.html灯影试作不自动保存；probe.html的JSON是测试记录，不能作为正式项目导入。

## 产品页面与导航

八个根hash页面和E01—E08目录支持直接打开、返回与刷新，共用一个ProjectStore。地址不推进剧情；无run时需明确开演，已有run只继续。制偶页当前可保存配色与纹样，分件预览、刻纹和完整演出尚未接入。未团圆节目单只显示进度，展馆目录不冒记已看完。

“我的作品”中可导入/导出、新建归档、重试保存、取消候选或明确内存继续。保存候选未处理时保留当前页；未知版本/损坏/冲突保留原稿并显示处理入口。工作台在新窗口恢复后，先导出需要保留的页面稿，再明确重新读取。接口与后续页面清理要求见[导航合同](docs/contracts/navigation-v1.md)。

## 正式存档工作台

`project.html` 使用正式的 `yingzuo-v1/snapshots`，已有以下检查入口：

- 编辑名称、配色和纹样，500 ms 防抖保存，连续操作最长等待 2 秒；刷新保留项目身份与编辑数据。
- 导出当前项目或未保存的待提交稿；先验证导入文件，再原子归档当前项目并作为新项目接续。导入保留原剧情检查点、runId、决定和冻结造型，默认暂停。
- 新建或恢复上一项目；再次替换归档前可先导出并明确选择。普通保存不改变上一项目。
- 草稿损坏时停下来检查备份；明确恢复后保留损坏原稿，继续编辑、保存和刷新。未知版本和超限原稿保留且停止覆盖。
- 两标签冲突后保留双方版本，暂停自动覆盖；当前未保存稿可导出，明确接管才重读并再次检查版本。

原始记录导出是 `yingzuo-raw-snapshots-v1` 诊断包，使用类型标记保留损坏值，不能当Project文件导入。工作台用于数据接线检查；文字排演通过同一个ProjectStore提交剧情命令，接口以[ProjectV1合同](docs/contracts/project-v1.md)为准。

## 文字排演与剧情接线

story.html提供显式开始、跳过序幕、编辑稿/默认影偶开演、两条路径、文字协助、四秒静候、谢幕和稳定成果摘要。它不提供手动操偶；操作段按明确协助记录，自动分镜不算协助。两模式用同一故事和完成条件；切模式需暂停并重开当前短节点。

推进先保存再应用，失败时保留旧节点和可导出候选，可原样重试/取消/明确内存继续。进入curtain仅写一次完成时间，成果ID由runId派生；刷新默认暂停，不重新选择已保存路线。新项目先归档，既有演出不会被组件重挂载重置。

消费者先读[剧情合同](docs/contracts/story-v1.md)，复用domain/story.ts与app/story-commands.ts。T16/T17再接NodeScope、演员调度、实际时钟/输入/几何判定；文字排演通过不代表完整图像流程或实际演出时长验收。

## 占位资源与消费者

T01 提供三角色十/六/四部件、统一九关节字段、三种分段镂空、五套色板（含两个固定角色色）与三组场景层。80 张 PNG 全部由本地 Canvas2D 生成，来源脚本为 `node scripts/generate-placeholder-assets.mjs`，未使用外部图片/字体；来源和许可保持真实草稿状态。正式原画替换后不要再运行此占位生成器覆盖它们。

T04/T15/T16 先读 [资产合同](docs/contracts/assets-v1.md)；类型位于 src/content/asset-types.ts，模板/清单位于 src/content。assets.html 仅供中性姿态和图层检查，没有运行时操偶、双角色成影、IK 或剧情。文化资料 C1—C7 在 sources.json 登记访问情况和引用边界。

实际结果、失败修复与未测试范围见 [验证记录](docs/verification.md)。当前不包含后台、分享或自由录制。
