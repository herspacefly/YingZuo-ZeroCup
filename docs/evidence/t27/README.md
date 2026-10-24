# T27 灯影与操偶验证

源检查点 cb1a177：typecheck、42文件473单元、81PNG资产检查通过。随后86a7c64修复真实浏览器发现的SVG残留与缩放/翻向；typecheck、39相关单元再验通过。

1440×1000及390×844使用真实鼠标拖动灯具，灯x/depth均改变；软件GPU512画布58draw calls，不作实体GPU帧率声明。两尺寸直接拖手后柔线弯曲、松开850ms直线通过；唯一page clock，未替换RAF。独立棕色影子、织幕、固定彩色影偶及台面截图已目检。

无WebGL自动二维、加载模块失败二维、合成webglcontextlost清理并重试（0→1 Three canvas）、二维按钮输入通过。合成事件不等同真实驱动上下文丢失。native-checks.json保留首轮失败前的局部记录，不能当通过证据；实际最终记录分别见native-lamp/native-cables/failure-and-cleanup.json。

当前工坊会在root集成时显式使用original-texture；本树仍含旧纹样策略。正式审看、触屏、实体IE/手机、真GPU性能未在本子任务完成。
