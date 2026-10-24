import type { Appearance, JointId, PatternId, Pose, StageConfig } from '../domain/types';

export type TemplateId = 'chenxiang-v1' | 'mother-v1' | 'guardian-v1';
export type ColorSlot = 'body' | 'sleeve' | 'hem' | 'fixed';
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export interface AssetEntry {
  id: string; type: 'part-color' | 'alpha-mask' | 'color-map' | 'prop' | 'carving-mask' | 'scene-layer';
  path: string; width: number; height: number; sha256: string;
  creator: string; sourceUrl: string; license: string; credit: string; usage: string;
  reviewStatus: 'draft' | 'reviewed' | 'rejected';
}
export interface AssetManifest {
  assetVersion: 1;
  provenance: { kind: string; generator: string; tool: string; intent: string; externalMedia: boolean; manualEdits: string; licenseNote: string };
  colorMapEncoding: { body: number[]; sleeve: number[]; hem: number[]; fixed: number[]; outside: string; fixedMeaning: string; sampling: string; recolor?: 'replace' | 'source-relative-rgb' };
  assets: AssetEntry[];
}
export interface PuppetPart {
  partId: string; parentJoint: JointId | null; pivot: [number, number]; bindAngleRad: number;
  bounds: Bounds; drawOrder: number; maskAssetId: string; colorAssetId: string; colorMapAssetId: string;
}
export interface PuppetJoint {
  jointId: JointId; parentJoint: JointId | null; anchor: [number, number]; restAngleRad: number;
  enabled: boolean; minRad: number; maxRad: number; defaultRad: number;
}
export interface PuppetTemplate {
  id: TemplateId; assetVersion: 1; label: string; control: 'user' | 'scripted'; defaultPaletteId: string;
  units: 'world'; nominalHeight: number; coordinateSystem: 'x-right-y-up'; root: 'torso-pivot';
  parts: PuppetPart[]; joints: PuppetJoint[];
  arms: { side: 'left' | 'right'; shoulder: JointId; elbow: JointId; handLocal: [number, number]; upperLength: number; lowerLength: number; bendSign: 1 | -1 }[];
  rods: { id: string; partId: string; point: [number, number] }[];
  bounds: Bounds; motionEnvelope: Bounds; boundsMeaning: string;
  motifPlacement: { partId: string; bounds: Bounds; source: string; segments: string } | null;
  attachments: { id: string; assetId: string; partId: string; anchor: [number, number]; pivot: [number, number]; bounds: Bounds; bindAngleRad: number; orientation?: 'follow-host' | 'upright'; gripMotion?: 'axe-wrist-v1'; drawOrder: number; defaultVisible: boolean }[];
  note: string;
}
// Consumer contract for T04/T16: fixed actors never acquire editable Appearance.
export type RenderActor =
  | { actorId: 'chenxiang'; templateId: 'chenxiang-v1'; appearance: Appearance; pose: Pose }
  | { actorId: 'mother'; templateId: 'mother-v1'; paletteId: 'mother-v1'; sharedMotif: PatternId; pose: Pose }
  | { actorId: 'guardian'; templateId: 'guardian-v1'; paletteId: 'guardian-v1'; pose: Pose };
export interface PatternDefinition { id: PatternId; label: string; operation: 'destination-out'; alphaMeaning: 'cut-away'; mapping: 'stretch-to-placement-bounds'; segments: [string, string, string]; note: string }
export interface Palette { id: string; label: string; editable: boolean; colors: [string, string, string, string, string] }
export interface SceneLayer { id: string; assetId: string; order: number; x: number; y: number; opacity: number; xRange: [number, number]; yRange: [number, number]; opacityRange: [number, number] }
export interface SceneDefinition { id: StageConfig['backgroundId']; label: string; background: string; layers: SceneLayer[] }
export interface AssetCatalog {
  manifest: AssetManifest; puppets: PuppetTemplate[];
  palettes: { assetVersion: 1; note: string; palettes: Palette[] };
  patterns: { assetVersion: 1; patterns: PatternDefinition[] };
  scenes: { assetVersion: 1; coordinates: string; actorOrder: number; layerOrder: string; scenes: SceneDefinition[]; note: string };
}
