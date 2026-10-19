# T10 精细道具方向图与生成提示

2026-10-18，按作者对斧、灯风格与细节的修改意见，使用内置 image_gen，参考本项目 `t10-art-direction.png`（SHA256 `a518985ab1ee8951c9e1eba372c95c10a135114da77da315b913615899056df6`），两次均请求透明背景。不重新生成三个人物或场景。

产物为 `t10-prop-direction-v2.png`（1536×1024，左斧右灯）及 `t10-staff-direction-v2.png`（1024×1536，守关兵器）。实际像素和 SHA 随仓库保留。`scripts/art/reference-props.mjs` 记录裁框、握持点及确定性适配；低 alpha 外溢微光被清理，镂空仍透明。斧与兵器保留旧世界 bounds，新增提灯有独立 ID 和原点握持绑定。审看册原来将守关兵器误标为灯，现已更正并为举灯节点实际补入提灯。

## 斧与灯：实际发送的完整提示

```text
Use case: style-transfer. Asset type: TWO transparent cutout sprite props for the existing articulated shadow-puppet web theatre shown in the reference. Primary request: Create one exquisitely detailed original theatre axe on the LEFT and one small hanging Chinese lantern on the RIGHT, isolated far apart on a genuinely transparent background, no characters, no ground, no frame, no text. Match the reference exactly in flat 2D leather-shadow-puppet illustration style: crisp dark brown ink contours, antique ochre-gold fine tracery, tiny pierced cloud and flower motifs, vermilion and muted indigo/celadon insets, delicately weathered hand-painted leather, luminous amber edges. Rich filigree matching the puppets rather than coarse geometric icons. Composition: landscape sheet, each prop in its own tall half, generous transparent margin separating them. Both props oriented upright and strictly front/profile orthographic, NOT realistic 3D, no perspective. Axe: slim long vertical reddish brown wooden shaft extending almost full height; handle center lies about 35% of the object's width from its left edge; ornate single broad crescent axe blade projects to the RIGHT at the TOP, scalloped bronze edge and indigo pierced cloud motifs, small red tie below blade, elegantly tapered shaft, no monstrous fantasy forms. Lantern: small gold ring at TOP centered horizontally, short slender hanging stem; delicate oval vermilion-and-amber paper body in lower two thirds, gold bamboo ribs, intricate floral cutwork bands and tiny leaf patterns, small dark cap and base, fine long red tassels, strictly flat painted silhouette. Keep their size balanced in the sheet, full objects uncut, no cast shadow or glow outside actual silhouette, no checkerboard painted into image. These will be independently cropped and attached to actual hand pivots; edges and negative-space holes must use real transparency. Preserve the supplied reference as the style guide only; do not redraw any people or backgrounds.
```

## 守关兵器：实际发送的完整提示

```text
Use case: style-transfer. Asset type: one transparent sprite of the guardian's elegant three-pointed ceremonial spear for the Chinese leather shadow-puppet theatre in the supplied style reference. Create ONLY one full upright long slender ceremonial weapon, no character, no hands, no scene, no text. Strictly flat 2D orthographic, crisp dark brown ink contour, antique ochre and gold filigree, muted indigo and vermilion inlaid leaf/cloud cutwork matching the detailed robes and crown of the reference guardian. Long reddish-brown lacquered thin shaft centered at x=45% of object width, from near top beneath the spearhead all the way to bottom. At TOP, three gracefully curved pointed blades: one taller narrow central point and two smaller outward crescent side points, gold scalloped borders and delicate blue-gold pierced cloud/floral scrollwork; small red silk knot and two slender patterned tassels beneath the head. Detailed fine leather engraving, hand-painted leather texture and tiny brass details, not a coarse geometric trident icon, not a realistic metal 3D weapon. Tall object with generous empty transparency all round. Genuine transparent background and holes. No paper, no vignette, no atmospheric haze, no black background, no glow, no cast shadow, no checkerboard pixels. Entire spear uncut and centered.
```

这些是本项目 AI 辅助的皮影风格原创道具设计，不声称复原特定地方传统兵器。作者艺术审看仍 pending。

- t10-prop-direction-v2.png SHA256 `58b0c1c60db78d4aeb32b49f257a6badbad65db0f47a1c4fbad5b2f326291530`

- t10-staff-direction-v2.png SHA256 `d9d2e62bd9f9a5531998a50f5830331ab6912d4c58b763d35d5837c3d1181fbe`
