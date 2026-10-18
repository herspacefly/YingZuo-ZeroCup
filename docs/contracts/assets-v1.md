# T01 资产版本 1 合同

本合同与主方案 7.1/7.4、叙事稿一起约束 T04/T05/T10/T15/T16 的消费者。`asset-types.ts` 提供编译期接口，`asset-contract.ts` 与 `verify:assets` 校验实际 JSON/PNG；不是用户存档导入格式。ProjectV1 的含义未改变。

## 交付与状态

- 80 张原创设计 PNG：20 个角色部件 × 彩色/alpha/颜色区三图，2 个手持附件，9 个镂空分段，9 个场景图层。T10设计稿以侧脸、冠髻、衣纹、金边、铆点和局部镂空替换几何占位；角色图2倍旧分辨率，场景1536×1152，骨架/bounds/杆/手点/附件锚点与资源ID不变。
- 沉香十部件九活动关节，母亲六部件五活动关节，二郎神四部件三活动关节。后两者按脚本控制，不附加可编辑 Appearance。
- `manifest.json` 与 `docs/assets.csv` 对每个本地文件登记作者、来源、用途、许可、审定状态及 SHA-256。全部为 draft / unknown，不表示正式美术、文化或发布许可已审定。
- `sources.json` 的 C1—C7 只登记资料与证据边界。可读正文、仅核对官方索引、受验证拦截分别记录；没有下载或复用页面媒体。

## 统一坐标与变换

世界平面宽 W=2、高 H=1.5；局部 x 向右、y 向上，角度为弧度，正值逆时针。模板原点是 torso 主杆 pivot，中性框高 0.9。Pose.x/y 仍为主方案的归一化舞台坐标；T04 再负责根缩放、投影和命中反算。

关节为有向无环层级，parentJoint=null 表示模板根。关节的 `anchor` 在父关节局部坐标中；
`J = parentJ * Translate(anchor) * Rotate(restAngleRad + pose.joints[id])`。中性检查使用 defaultRad。

部件 `bounds` 是其 PNG 对应的局部矩形。`pivot` 是图内对应所属关节的点，`partToJoint = Rotate(bindAngleRad) * Translate(-pivot)`；再左乘 J。PNG 顶点的映射为 `x=minX+u*(maxX-minX), y=maxY-v*(maxY-minY)`，u/v∈[0,1]，v向下。旋转轴不按图片中心猜测。facing 只在根镜像一次，不改关节值或弯曲符号。

手持附件的 `anchor` 位于宿主部件局部坐标，`pivot` 位于附件图中：`host * Translate(anchor) * Rotate(bindAngleRad) * Translate(-pivot)`。杆连接 `point` 同样处在宿主部件局部坐标。drawOrder 从小到大；附件可与部件排序合并，defaultVisible=false，节点显式打开。

`bounds` 为中性图像矩形并集的包围框（允许左右留白）；`motionEnvelope` 为动作的保守范围，附件框单独变换后并入。T04 不能把中性框当所有动作的实时投影范围。初始图像包括帽、裙、靴；附件不藏在框外。运行时对关节逐项按模板夹取；全部九个 JointId 仍须存在，enabled=false 的关节四个角度字段均为0，Pose中也恒为0。

手臂 upperLength/lowerLength 与 shoulder/elbow/handLocal 对应；左 elbow 的 bendSign=-1，右=+1，facing 不改变本地分支。母亲未分腿，二郎神左臂与腿合入身片；没有给固定角色增设用户操纵范围。

## 遮罩、颜色和共同纹样

三图尺寸与 alpha 覆盖逐像素一致。alpha-mask 的白色 alpha 表示保留；PNG透明处为外部。color-map 的非透明 RGB 是精确标签：body=(255,0,0)，sleeve=(0,255,0)，hem=(0,0,255)，fixed=(255,255,0)。以 nearest 采样；fixed 保留彩色原图像素，其余按外观的 colorSlots 或固定角色配置选色。不要把标签本身当成影色。固定角色默认 body/sleeve/hem 分别取色板索引0/1/2。

三种原创纹样各有三个完整尺寸的分段 alpha PNG；白色 alpha 的含义是**刻去**，先缩放到 motifPlacement.bounds，在独立部件层用 destination-out，再绘入场面。不能直接擦掉已经画好的母亲、另一演员或背景。每段占不同条带，可组合；沉香读 appearance.patternId/carvedSegments。母亲只读 castSnapshot.sharedMotif，在右上臂袖口显示完整三段；不得随当前编辑稿变化。guardian 不带该纹样。

三套可编辑五色板沿用主方案固定值；mother-v1/guardian-v1 为本作固定设计色，不声称是传统统一配色。

## 场景层

所有 StageConfig.backgroundId 均可解析；plain-v1 为纯色空层。home/road/mountain 是三组场景，guardian 使用 road。公共山片只存一份，home 可在分离时打开隐藏山片。

层的 x/y 为归一化屏幕位移（x右y下）；整图铺满幕面，opacity∈[0,1]，都受 xRange/yRange/opacityRange 约束。按 order 升序渲染，演员整体位于10；山片20/21位于母亲之前，尘幕30最前。左山开合范围[-.55,0]，右山[0,.55]；初始合拢。导演只能传白名单层ID和有限数值，不能传函数或任意 URL。节点初值由T15/T16显式配置，本轮不保存动画过程。

## 复现与检查

当前使用`node scripts/generate-designed-assets.mjs`，来源为scripts/art/的可读原创Canvas路径；生成同一80张图，统一三图alpha与精确色区并更新清单/CSV/哈希，不重新生成骨架。docs/art/t10-art-direction.png为内置image_gen艺术方向参考，提示与用途同步登记；运行时未直接切割该图。provenance.kind支持original-vector-design，设计审看与许可仍为draft/unknown。旧generate-placeholder-assets.mjs检测到设计版会拒绝覆盖，不能用旧几何生成器还原当前素材。

`npm run verify:assets` 解码 PNG、检查 alpha/颜色编码、白名单引用、路径、尺寸、CSV和哈希，草稿结构有效时退出0。`npm run verify:assets -- --release`还检查docs/reviews/t10-review.json逐项当前内容SHA、作者审看/权利及证据文件SHA，草稿或证据欠缺时退出2（NOT_READY）；文件/契约错误退出1。不能用任意许可字符串或旧版审定通过；结构通过不是发布批准。

`assets.html` 是单角色中性组装和场景检查页。没有 RAF、剧情推进、IK 或灯影投影；缺资源/Canvas时明确失败、清空组装画布并允许重试，离开清除加载回调和事件。T04 的生产渲染器不能直接以本页代替。
