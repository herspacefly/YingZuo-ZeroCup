# 影作 · 一幕团圆

据传统故事《劈山救母》原创交互改编的短戏与数字展馆。当前完成 **T00 工程与兼容探针**：作品入口、可调灯位和偶幕距离的 Canvas 试作、独立 IndexedDB 提交／回滚检查。完整短戏、正式角色、展馆和正式作品存档仍待后续任务实施。

接手先读 [START_HERE](START_HERE.md)、[项目约定](AGENTS.md)、[当前状态](docs/STATE.md)和[任务账本](docs/tasks.json)。设计依据见[主方案](docs/plans/2026-10-15-yingzuo-design-and-implementation.md)与[叙事稿](docs/content/2026-10-15-yingzuo-story-bible.md)。

## 本地启动

使用 Node.js **24.x** 与 npm。当前实测 Node v24.18.1、npm 12.0.2；依赖以 `package-lock.json` 为准。

```powershell
npm ci
npm run dev
```

默认打开 <http://127.0.0.1:5173/>。首页为灯影试作；[运行检查](http://127.0.0.1:5173/probe.html)用于存储与构建入口诊断。无运行时 CDN、远程字体、API 或环境密钥。使用静态本地服务器，不能直接双击 HTML 运行模块。

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
```

`test:e2e` 会启动生产预览服务，占用 4173 端口；请先停止该端口上的其他预览服务。测试含 1440×900 与 390×844 Chromium 视口，手机视口属于模拟。测试截图和失败诊断写到忽略的 `test-results/`。T00 已保留两张[桌面](docs/evidence/t00-desktop.png)／[窄屏](docs/evidence/t00-mobile.png)检查截图。

`verify:assets` 当前明确输出 **NOT_READY 并返回退出码 2**，因为 T01 尚未建立正式资产清单。不能据此声称素材已审。T15 实施前没有 `verify:content`。

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
- 首页灯影试作不自动保存；此处 JSON 是测试记录，不能作为正式项目导入。T03 将实现正式 Project、事务存档、验证、恢复与导入导出。

实际结果、失败修复与未测试范围见 [验证记录](docs/verification.md)。当前不包含后台、分享或自由录制。
