# T04 姿态、投影与Canvas接口

日期：2026-10-17。消费ProjectV1/assets-v1/story-v1/navigation-v1，不改变存档版本。T10已换原创皮影风格设计稿，骨架/成影接口保持；图像仍待作者审看，投影不是精确光学模拟。

## 纯数学

projection.ts定义Point、Viewport与世界宽2/高1.5、灯深1.2。Project.pose的根x右/y下归一化，转换为世界`((x-.5)*2,(.5-y)*1.5)`；模板/世界的y向上。灯y=0，`t=D/(D-d)`，所有部件共享同一倍率；projectPoint/unprojectPoint互逆，localToWorld/worldToLocal只在根做一次facing/scale。projectLocalPoint/screenToLocalPoint组合两层变换。

fitViewport以4:3等比放入给定像素矩形，返回偏移/实际幕宽高/每世界单位像素数。worldToViewport/viewportToWorld处理幕面世界与容器像素；黑边外和无尺寸时反算返回null。调用方先扣除容器在页面中的位置，不能把整页clientX直接当幕面坐标。DPR是渲染层细节，输入仍用CSS像素。

pose.ts的constrainPose返回新Pose，夹取根位置、合法scale与各模板关节；禁用关节恒0。非有限运行态关节采用模板default，其余非法运行态数值使用明确默认，Project导入仍由严格validation拒绝。jointTransform/partTransform/attachmentTransform返回模板局部`{x,y,angle}`，遵守asset合同的anchor/rest/pivot/bind；rodPoint也为模板局部，画杆柄必须再用同一projectLocalPoint。

solveArm(template,pose,side,targetLocal)只求必要两骨链。它根据实际elbow anchor与forearm pivot/bind后的手杆偏移确定骨方向，弯曲符号固定；先把目标夹到可达圆环，最后夹关节限位。重合目标沿当前上臂方向处理，非法目标保留受约束Pose；限位后手部不承诺仍精确到达不可达目标。

actorLocalBounds/projectedPoseBounds取所有已变换部件与显式可见附件矩形角点的并集，不使用中性框代替实际姿态。constrainPoseToStage返回`{pose,bounds,fits}`：必要时缩小但不低于.6，再平移到幕内边距（默认.04世界单位）；仍装不下则尽量居中并明确fits=false。不得只取返回pose而忽略fits，或把受限结果默认为原目标已达成。

## Renderer输入与合成

mountCanvasRenderer(host,catalog,onStatus)返回canvas/update/resize/pause/reset/dispose。CanvasFrame为瞬时纯数据：actors最多2位、stage、可选sceneLayers、attachments和showRods。固定角色只用自己的色板；母亲只用传入sharedMotif，不读取当前编辑稿。frame验证模板、配色/纹样、场景白名单与参数范围、附件宿主，之后复制并夹关节；Renderer不会悄悄平移导演的入口构图。

T17新增可选actorOpacity，键只允许当前帧演员，值必须为有限0—1，验证后独立复制。它只在角色局部save/restore内作用于globalAlpha，不能改其他演员/场景透明度，也不写存档。透明演员仍加载全部部件，使渐显/退出不触发资源闪烁。

按清单加载当前演员、纹样、可见附件与场景层。TextureCache校验本地路径和真实解码尺寸；Image.onload/error都有清理，更新代号拒绝旧帧结果。T07增加hasAll快速路径：已加载齐全的姿态帧同步绘制，不逐帧清空/隐藏画布或标loading；资源变化仍走加载与代号检查。只保留当前帧资源；部件纹理按actor/part缓存，配色/色槽/相关纹样变化才重建，退出释放canvas像素。失败重试追加本页数字代次查询参数，避免同一文档的解码图片缓存继续提供已修复前的坏图。

PartCompositor读取精确RGB标签，body/sleeve/hem按色槽取色，fixed保留原图RGB；alpha取彩色图内嵌透明度（verify:assets逐像素验证与原遮罩及颜色区图完全一致；生产不再重复传输遮罩）。镂空只在独立部件Canvas用destination-out，再绘入舞台，因此不会擦掉背景或另一位演员。禁止Canvas.filter/OffscreenCanvas/Image.decode等必需依赖；支持精确半透明解码的现代浏览器可选用无损WebP+ImageBitmap，能力探针不通过或legacy入口仍用PNG，不作为必需依赖；当前没有半影模糊，暖色幕面与几何投影属于交互近似。

舞台先画背景与order<10层，再按actors数组顺序画角色，最后前景山片20/21与尘幕30。角色内部部件/附件按drawOrder排序。场景位移x右/y下按幕面宽高换算，不套模板y上坐标。PNG只在局部图像映射时翻转y一次。

渲染按update或resize绘制一次，没有独立RAF或演出计时器；pause目前无时钟可停。reset丢弃当前帧与加载，dispose再清resize监听、缓存、图像回调并移除/清零Canvas；晚到加载不能复活旧页。Canvas、资源或像素读取失败均清空画面、显示错误并允许重新加载，不标假ready。

## 产品消费者与剩余范围

shared/canvas-stage.ts拥有可读状态与重试、帧签名去重和生命周期；T07暴露canvas/screen/getStatus/subscribe，订阅立即给当前状态，工厂异常/空帧也通知，dispose清订阅。T16新增resize/retry供独立待显示stage准备与换入，单stage错误仍清空，不把旧资源错误画成ready。craft显示编辑沉香与母亲预览：已有本场时母亲袖纹来自castSnapshot.sharedMotif；未开演时仅预览候选共纹，不写冻结快照。light读取编辑稿的舞台/姿态，预览适配不回写Project；practice按[练习合同](practice-v1.md)接输入与POSE保存。story按[导演合同](director-v1.md)从节点entry字段及捕获外观播放，自动场面经guarded保存才推进；不写瞬时姿态。

T07已接独立三杆输入、五时间动作、唯一时钟与有限几何观察；T05已接分段刻纹、色槽/同纹、临时身杆试提、真实灯控和确认冻结，详见craft-v1.md。T16已复用时钟接导演和静态旧帧保留；T17验可达性与整场手动/协助；T18复用演示，T09输出成果。基础通过不表示后续任务、真实IE、正式美术或全剧SAVE/性能/时长验收完成。

T06在shared/canvas-stage下挂载默认收起的空间观察，每次二维ready之后把同一帧与实际源Canvas交给可选Three消费者。加载时隐藏空间旧帧、错误时关闭空间；收起/离页先释放空间GPU与监听，再释放二维。默认不创建WebGL、legacy不导入Three；原幕面的输入矩形及唯一时钟不变。直接调用Canvas renderer的PNG导出不带空间面板。机位、预算与失败清理见[空间合同](three-v1.md)。
