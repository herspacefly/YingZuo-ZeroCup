# T06 戏台空间观察接口

日期：2026-10-18。消费canvas-v1/assets-v1/navigation-v1；不改变ProjectV1、剧情节点、存档或输入坐标。当前木台、薄片、幕与灯均为原创空间示意，角色已用T10原创皮影风格设计稿，不能据此宣称正式美术或物理透射仿真。

## 页面入口与能力

shared/canvas-stage在完整二维幕面下挂载可展开的空间观察，默认不创建WebGL上下文，也不载入Three模块。用户点“展开戏台空间”后才动态导入renderers/three/renderer。只有src/renderers/three/可以导入three包；其他目录可以使用类型导入和受保护的动态模块入口。

app/capabilities的纯函数spatialCapability接收legacy/webgl2/width及可选deviceMemory/hardwareConcurrency/saveData/dpr，返回eligible/reason/budget。legacy或无WebGL2接口禁用空间入口，二维操作与知识仍完整。窄屏（<=700）、有效内存<=2GB、有效核心数<=2或省流提示采用低预算：DPR<=1、draw buffer宽<=512、每张纹理长边<=512；常规DPR<=1.5、宽和纹理长边<=1024。非法数值按函数明确规则处理；能力准入不代表初始化必然成功。

四机位workshop/front/backstage/exhibit分别为工坊近景/幕前/幕后/展台。原生按钮可聚焦，aria-pressed标记当前机位；直接切换，无补间、OrbitControls或额外RAF。展台附同一E01—E08展签链接，知识不依赖三维命中或漫游。操偶仍在原二维幕面进行，空间相机不改变投影、杆位置或剧情完成条件。

## Renderer

mountThreeStage(host,sourceCanvas,options,onStatus)返回canvas/update(frame):Promise<void>/setView(view)/resize/dispose。options为pixelRatio/maxWidth/textureSize；status为loading/ready/error/lost及真实message。调用方只在二维已ready后传当前纯CanvasFrame；sourceCanvas为该帧实际二维输出。Renderer复制并校验frame，不拥有Store、剧情命令、演出时钟或输入事件。

幕前隐藏实体影偶/灯，以实际二维Canvas经有界scratch拷贝成CanvasTexture。其他机位降低幕面透明度，展示同一模板的分件、着色、刻纹、附件、关节与三杆。模板局部变换与二维共用partTransform/attachmentTransform/rodPoint；root/scale/facing只应用一次。幕z=0附近、灯z=-1.2、角色z=-puppetDistance；相机只改变观察。场景层与成影仍来自二维幕面，空间薄片不另做投射。

每次update以最新帧代号拒绝迟到绘制，外观/附件/演员等资源范围改变时再重建纹理；仅姿态、灯位或透明度变化不重复加载资源。资源范围内共享未完成加载，持续演出帧不会反复取消同一批图片。ready只在实际绘制成功后发出；纹理准备或渲染失败发error，不把旧空间画面冒作新帧。

## 清理与失败

shared/spatial-stage拥有展开代号；加载中收起、离页、换作品或原幕清空后，迟到模块不能创建旧上下文。二维loading隐藏空间画面，原幕错误关闭空间并提示先重试幕面。WebGL初始化失败、图片错误、渲染异常或真实context lost均释放实例，回到仍可用的二维并显示原因；可手动重新展开。

动态JS模块加载失败会由浏览器缓存失败状态，同一文档的再次import不保证重新请求；此时二维可继续，刷新页面后可重新获取模块。图片/初始化/context lost重试创建新实例。不得把仅点击“重试”称作模块已经重新下载。

dispose幂等：失效加载代号，撤销resize/contextlost监听，清图像加载/部件缓存/纹理/scratch像素/geometry/material/renderLists，dispose renderer并主动丢失上下文，清零并移除canvas。页面先释放空间再释放二维源；新空间实例不继承旧相机对象、回调或GPU资源。相机选择仅当前面板内保留，不入存档。

PNG导出继续直接使用Canvas renderer，不创建空间面板或强制加载Three；编排重演等共享Canvas消费者可主动观察空间，但仍只沿用原有唯一时钟。实际IE、实体手机/Safari与真实性能由T11/T13验收，Chromium模拟窄屏及ES5语法检查不取代它们。
