# T05 制偶、灯影与开演合同

日期：2026-10-17。沿用ProjectV1、assets-v1、story-v1、canvas-v1；不改存档版本或冻结含义。

## 字段编辑与可见结果

craft使用同一双角色Canvas。三段按钮可刻去/还原，完成下一段在执行时寻找首个未刻段；颜色和镂空都在独立部件遮罩中合成，不擦掉背景或母亲。衣身/袖/下摆分别选五色索引，采用整套配色可恢复该套的默认色槽。三种纹样和颜色没有剧情能力或结局差异，资源仍为原创几何排演。

新增EditorCommand：CARVE_SEGMENT(index 0/1/2, carved boolean)、CARVE_NEXT、COLOR_SLOT(slot body/sleeve/hem, colorIndex 0..4)、APPLY_PALETTE(paletteId)、LAMP_X(lampX)、PUPPET_DISTANCE(puppetDistance)。命令在Store队列执行时修改最新字段，不能捕获整份旧APPEARANCE/STAGE覆盖其他编辑。APPLY_PALETTE同时复位colorSlots为0/1/2，既有PALETTE只换色板。坏索引/部位/布尔/数值明确拒绝。

未冻结时母亲袖口预览当前候选纹样；有castSnapshot时只用其sharedMotif。外观控件读取getExportProject，失败候选之后的编辑可排队；候选造型与实际已应用造型有明确文案，后续编辑不修改候选冻结快照。

## 身杆试提与灯影

craft/body-rod只操作双人预览里的临时Pose，不读写Store、practice保存Pose或剧情。一个48px握柄与实际身杆投影连线，保留抓取偏移，调用T07逆投影/bbox；鼠标、Pointer与Touch回退只跟踪当前标识。方向键逐次试提、方向按钮与重置等价。释放、失焦、隐藏、禁用、页面dispose清指针、事件/resize；无新RAF。重新进入会回到初始试提构图，实际演出按节点entryPose开始。

light的原生range/方向键/逐步按钮控制lampX[-.8,.8]和puppetDistance[.05,.4]，几何倍率D/(D-d)，D=1.2。显示百分比是控件行程，不是物理长度单位；重置仅复位灯位0/距离.2，不改背景。预览按实际bbox临时适配，不回写Pose；剧情entryStage完全独立。

普通字段经Store 500ms防抖/最长2秒保存，不额外flush或另开计时器。memory/error状态保留内存和导出，不因input/change/步进/重置自动重试写盘；保存按钮是明确写盘请求。根isBusy期间禁用输入；待提交外观/灯影仍按已有队列合同处理。Canvas故障保留可编辑字段和真实报错，禁止不可见的试提/冻结操作。

## 确认与新场

app/craft-commands.confirmCraft接固定request：runId/mode/presetAppearanceUsed/guard/now。guard在点击时捕获，候选在Store.commit排队执行时读取最新外观。直接访问craft且无run时，明确开演会在一个候选中beginStory、用户跳过intro、用户craft确认，再存memory-wave；只写最终候选，不落盘中间节点。已有intro/craft用原run和mode；旧guard或已冻结节点返回null，不重新冻结。

默认影偶通过既有craft evidence设置presetAppearanceUsed=true，只冻结defaultAppearance，不擦掉编辑稿。按钮不把三段刻完或试提冒充已完成剧情；制作可跳过。保存成功后导航story且默认暂停，图形导演仍由T16/T17接入。

失败时旧实际节点不变，导出包含原冻结候选和后续排队编辑；重试使用同一候选，取消后保留编辑，明确内存继续持续标未保存。全局重试成功后可用本页“继续已冻结演出”进入剧情，不因重试再创建run。

已有冻结场的archiveForRehearsal先flush串行队列最新编辑，再用newProject原子归档旧项目/建立保留编辑appearance/stage/pose/title的新项目；清story/museum/performance/partialRecording，等待用户确认新run。新的projectId由Store生成，runId在下一次明确开演时才生成。已有上一归档时拒绝静默替换，沿用明确确认/原候选重试/取消。失败不切页、旧场不变。

SAVE-01包括制偶段/颜色/纹样和编辑灯影的保存刷新、立即确认冻结最新稿，以及旧演出/母亲共纹/节点灯位不随编辑变化。它不等于T11完整图形SAVE-01—07、真实IE或正式美术验收。
