// Level-of-detail visibility toggles during orbit.
//
// While the user orbits/pans/zooms, we hide decorative groups and the heavy
// per-element solid groups (cylinders / extruded sections) so camera motion
// stays smooth on large models. The batched wireframe mesh stays visible —
// since Phase 2 it already collapses every element into a single draw call,
// so there is no need to swap it for a parallel proxy during orbit.
//
// Extracted as a pure function so the visibility contract can be asserted
// in unit tests — the inline version lived inside Svelte's onMount closure.

import type * as THREE from 'three';

export type RenderMode3D = 'wireframe' | 'solid' | 'sections';

/** Object-like shape — matches both THREE.Object3D and mock {visible} objects. */
export interface Visible {
  visible: boolean;
}

export interface LowDetailGroups {
  nodesParent: Visible | null;
  supportsParent: Visible | null;
  loadsParent: Visible | null;
  resultsParent: Visible | null;
  shellsParent: Visible | null;
  /** Parent of the local-axis triad group — decorative, stripped with the
   *  rest of the overlays in the heavy-model fallback. */
  localAxesParent: Visible | null;
  /** Parent of per-element groups (cylinders / extruded sections + picking).
   *  Hidden during orbit so heavy solid geometry doesn't render. */
  elementsParent: Visible | null;
  /** The shared batched LineSegments2 (ElementsBatched.mesh). Lives directly
   *  in the scene (outside elementsParent) so it renders whether or not
   *  elementsParent is visible. Forced on during orbit to act as the LOD
   *  stand-in for solid/sections modes. */
  elementsBatchedMesh: Visible | null;
  /** Current render mode — needed to restore `elementsBatchedMesh.visible`
   *  to its idle value when orbit ends. */
  renderMode: RenderMode3D;
}

/**
 * Apply the LOD visibility rules during orbit/pan/zoom.
 *
 * Default (professional inspection): keep nodes, supports, loads, shells,
 * results, and the current render mode (cylinders / extruded sections) VISIBLE
 * while the camera moves — moving the camera to inspect a result/load/section
 * must not collapse the model into naked lines.
 *
 * Heavy-model fallback (`opts.heavyModel === true`): only then revert to the
 * old aggressive behavior — hide decorative groups + the per-element solid
 * groups and force the batched wireframe on as a lightweight stand-in — so very
 * large models stay responsive during motion.
 *
 * `resultsParent` is never toggled. `elementsParent` AND `shellsParent` are
 * additionally kept visible in the heavy fallback when a result-coloring mode
 * (axialColor / colorMap / verification) is active: frame colors live on the
 * per-element meshes and the shell Von Mises heatmap is painted onto the shell
 * groups themselves (applyShellVertexColors) — hiding either would make the
 * visualization vanish exactly while the user inspects it.
 */
export function applyLowDetail(
  on: boolean,
  g: LowDetailGroups,
  opts?: {
    resultsColoringActive?: boolean;
    heavyModel?: boolean;
    /** Result colors are already mirrored into the one-draw-call batched lines. */
    batchedResultColors?: boolean;
    /** A shell stress contour still needs its original mesh while orbiting. */
    shellContourActive?: boolean;
  },
): void {
  const heavy = opts?.heavyModel === true;
  const keepElementsForResults = opts?.resultsColoringActive === true;
  // Only strip overlays/solids during motion in the heavy fallback. The
  // result-coloring exception (from the pr/5 review fixes) covers BOTH the
  // per-element meshes and the shell groups — the shell heatmap lives on the
  // shells themselves.
  const hideDecor = on && heavy;
  // During color-map inspection the batched line already carries each member's
  // result color; it can replace thousands of cylinders/sections *while moving*.
  // Only shell contours are excluded because their scalar field lives on the
  // original triangles, not the batched member centerlines.
  const canUseColoredBatch = opts?.batchedResultColors === true;
  const hideElements = hideDecor && (!keepElementsForResults || canUseColoredBatch);
  const hideShells = hideDecor && !(keepElementsForResults &&
    (!canUseColoredBatch || opts?.shellContourActive === true));

  if (g.nodesParent) g.nodesParent.visible = !hideDecor;
  if (g.localAxesParent) g.localAxesParent.visible = !hideDecor;
  if (g.supportsParent) g.supportsParent.visible = !hideDecor;
  if (g.loadsParent) g.loadsParent.visible = !hideDecor;
  if (g.shellsParent) g.shellsParent.visible = !hideShells;
  if (g.elementsParent) g.elementsParent.visible = !hideElements;

  if (g.elementsBatchedMesh) {
    // Force the batched wireframe on only when the per-element parent is hidden
    // (heavy fallback during motion); otherwise follow the idle render mode.
    g.elementsBatchedMesh.visible = hideElements ? true : g.renderMode === 'wireframe';
  }
}

/** Heavy-model thresholds for the orbit LOD fallback. Sections mode renders
 *  an extrusion + an edges outline (≈2 draw calls + 2 materials) per element,
 *  roughly doubling the per-element cost vs wireframe/solid — so it falls back
 *  much earlier. Shells count toward the budget: a slab/wall model with few
 *  frame elements but thousands of shell faces is just as heavy during orbit. */
/**
 * Draw-call-aware thresholds calibrated against actual checked-in models:
 * - pro-edificio-7p: 203 frames + 77 shells + 196 loads
 * - rc-design-frame: 408 frames + 656 loads
 * - la-bombonera: 2476 frames + 120 shells + 514 loads
 *
 * The former 3000/1200 thresholds did not trigger on the user's 7-floor
 * Professional model even though sections create ≈2 draw calls/member.
 * These are heuristics, NOT measured FPS targets; the viewport HUD reports
 * actual GPU draw calls and frame times for tuning on the user's machine.
 */
export const HEAVY_MODEL_VISUALS = 1200;
export const HEAVY_MODEL_VISUALS_SOLID = 380;
export const HEAVY_MODEL_VISUALS_SECTIONS = 180;
export type ViewQuality3D = 'auto' | 'performance' | 'detail';

export interface ModelVisualCounts {
  elements: number;
  shells?: number;
  loads?: number;
}

export function weightedVisualCount(counts: ModelVisualCounts): number {
  return Math.max(0, counts.elements)
    + Math.max(0, counts.shells ?? 0) * 2
    + Math.max(0, counts.loads ?? 0) * 0.5;
}

export function isHeavyModel(
  counts: ModelVisualCounts,
  renderMode: RenderMode3D,
): boolean {
  const threshold = renderMode === 'sections'
    ? HEAVY_MODEL_VISUALS_SECTIONS
    : renderMode === 'solid'
      ? HEAVY_MODEL_VISUALS_SOLID
      : HEAVY_MODEL_VISUALS;
  return weightedVisualCount(counts) > threshold;
}

/** Detail preference changes visual quality only, never FEM geometry/values. */
export function shouldUseFastOrbitLOD(
  quality: ViewQuality3D,
  counts: ModelVisualCounts,
  mode: RenderMode3D,
  diagramType = 'none',
): boolean {
  if (diagramType === 'despiece') return false;
  if (quality === 'detail') return false;
  return quality === 'performance' || isHeavyModel(counts, mode);
}

/** Clamp Retina/4K render resolution to avoid quadratic WebGL fill pressure. */
export function idlePixelRatio(deviceRatio: number, quality: ViewQuality3D): number {
  const safeRatio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const limit = quality === 'performance' ? 1.25 : quality === 'detail' ? 2 : 1.5;
  return Math.min(safeRatio, limit);
}

/** Convenience re-export type for callers that want to pass a real scene. */
export type LowDetailGroupsFor<T extends THREE.Object3D> = {
  [K in keyof LowDetailGroups as K extends 'renderMode' ? never : K]: T | null;
} & { renderMode: RenderMode3D };
