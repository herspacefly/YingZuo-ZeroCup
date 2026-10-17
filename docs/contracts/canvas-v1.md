# T04 姿态、投影与Canvas接口

日期：2026-10-17。消费ProjectV1/assets-v1/story-v1/navigation-v1，不改变存档版本。当前是几何排演资源的真实渲染基础，图像不表示正式原画或精确光学模拟。

## 纯数学

projection.ts定义Point、Viewport与世界宽2/高1.5、灯深1.2。Project.pose的根x右/y下归一化，转换为世界`((x-.5)*2,(.5-y)*1.5)`；模板/世界的y向上。灯y=0，`t=D/(D-d)`，所有部件共享同一倍率；projectPoint/unprojectPoint互逆，localToWorld/worldToLocal只在根做一次facing/scale。projectLocalPoint/screenToLocalPoint组合两层变换。

fitViewport以4:3等比放入给定像素矩形，返回偏移/实际幕宽高/每世界单位像素数。worldToViewport/viewportToWorld处理幕面世界与容器像素；黑边外和无尺寸时反算返回null。调用方先扣除容器在页面中的位置，不能把整页clientX直接当幕面坐标。DPR是渲染层细节，输入仍用CSS像素。

pose.ts的constrainPose返回新Pose，夹取根位置、合法scale与各模板关节；禁用关节恒0。非有限运行态关节采用模板default，其余非法运行态数值使用明确默认，Project导入仍由严格validation拒绝。jointTransform/partTransform/attachmentTransform返回模板局部`{x,y,angle}`，遵守asset合同的anchor/rest/pivot/bind；rodPoint也为模板局部，画杆柄必须再用同一projectLocalPoint。

solveArm(template,pose,side,targetLocal)只求必要两骨链。它根据实际elbow anchor与forearm pivot/bind后的手杆偏移确定骨方向，弯曲符号固定；先把目标夹到可达圆环，最后夹关节限位。重合目标沿当前上臂方向处理，非法目标保留受约束Pose；限位后手部不承诺仍精确到达不可达目标。

actorLocalBounds/projectedPoseBounds取所有已变换部件与显式可见附件矩形角点的并集，不使用中性框代替实际姿态。constrainPoseToStage返回`{pose,bounds,fits}`：必要时缩小但不低于.6，再平移到幕内边距（默认.04世界单位）；仍装不下则尽量居中并明确fits=false。不得只取返回pose而忽略fits，或把受限结果默认为原目标已达成。

## Renderer输入与合成

mountCanvasRenderer(host,catalog,onStatus)返回canvas/update/resize/pause/reset/dispose。CanvasFrame为瞬时纯数据：actors最多2位、stage、可选sceneLayers、attachments和showRods。固定角色只用自己的色板；母亲只用传入sharedMotif，不读取当前编辑稿。frame验证模板、配色/纹样、场景白名单与参数范围、附件宿主，之后复制并夹关节；Renderer不会悄悄平移导演的入口构图。

按清单加载当前演员、纹样、可见附件与场景层。TextureCache校验本地路径和真实解码尺寸；Image.onload/error都有清理，更新代号拒绝旧帧结果。只保留当前帧资源；部件纹理按actor/part缓存，配色/色槽/相关纹样变化才重建，退出释放canvas像素。失败重试追加本页数字代次查询参数，避免同一文档的解码图片缓存继续提供已修复前的坏图。

PartCompositor读取精确RGB标签，body/sleeve/hem按色槽取色，fixed保留原图RGB；alpha取原遮罩。镂空只在独立部件Canvas用destination-out，再绘入舞台，因此不会擦掉背景或另一位演员。禁止Canvas.filter/OffscreenCanvas/Image.decode等必需依赖；当前没有半影模糊，暖色幕面与几何投影属于交互近似。

舞台先画背景与order<10层，再按actors数组顺序画角色，最后前景山片20/21与尘幕30。角色内部部件/附件按drawOrder排序。场景位移x右/y下按幕面宽高换算，不套模板y上坐标。PNG只在局部图像映射时翻转y一次。

渲染按update或resize绘制一次，没有独立RAF或演出计时器；pause目前无时钟可停。reset丢弃当前帧与加载，dispose再清resize监听、缓存、图像回调并移除/清零Canvas；晚到加载不能复活旧页。Canvas、资源或像素读取失败均清空画面、显示错误并允许重新加载，不标假ready。

## 产品消费者与剩余范围

shared/canvas-stage.ts拥有可读状态与重试、帧签名去重和生命周期。craft显示编辑沉香与母亲预览：已有本场时母亲袖纹来自castSnapshot.sharedMotif；未开演时仅预览候选共纹，不写冻结快照。light/practice读取编辑稿的舞台/姿态，预览可适配边界但不回写Project。story只显示已保存节点entryPoses/entryStage/entrySceneLayers/entryAttachments，外观优先本场冻结快照；保持暂停，不自动推进或写姿态。

T05接分段刻纹、真实灯控和确认冻结；T07接输入、命中和时间动作；T16接唯一时钟与导演；T17验可达性与整场手动/协助；T18复用演示，T09输出成果。当前基础通过不表示这些任务、真实IE、正式美术或全剧SAVE/性能/时长验收完成。
