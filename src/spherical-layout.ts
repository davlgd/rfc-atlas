import { Vector3 } from "three";
import { SPHERE_LAYOUT_CONFIG } from "./config";
import type { GraphArtifact } from "./types";

export function createPositions(artifact: GraphArtifact): Map<string, Vector3> {
  const result = new Map<string, Vector3>();
  const ordered = [...artifact.nodes].sort((a, b) => a.number - b.number);
  const count = ordered.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  ordered.forEach((node, index) => {
    // A Fibonacci sphere guarantees an even, unmistakably spherical cloud.
    // RFC number order makes the spiral chronological and deterministic.
    const vertical = count <= 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const angle = index * goldenAngle;
    const sphereX = Math.cos(angle) * horizontalRadius;
    const sphereY = vertical;
    const sphereZ = Math.sin(angle) * horizontalRadius;
    const time =
      (((node.year ?? artifact.meta.minYear) - artifact.meta.minYear) /
        Math.max(1, artifact.meta.maxYear - artifact.meta.minYear)) *
        2 -
      1;
    const radius =
      SPHERE_LAYOUT_CONFIG.baseRadius + time * SPHERE_LAYOUT_CONFIG.temporalRadiusSpread;
    result.set(node.id, new Vector3(sphereX * radius, sphereY * radius, sphereZ * radius));
  });
  return result;
}

export function appendSphericalArc(
  vertices: number[],
  colors: number[],
  start: Vector3,
  end: Vector3,
  color: { r: number; g: number; b: number },
  intensity: number,
  segments: number = SPHERE_LAYOUT_CONFIG.defaultArcSegments,
): void {
  const startDirection = start.clone().normalize();
  const endDirection = end.clone().normalize();
  const dot = Math.max(-1, Math.min(1, startDirection.dot(endDirection)));
  const angle = Math.acos(dot);
  let axis = startDirection.clone().cross(endDirection);
  if (axis.lengthSq() < SPHERE_LAYOUT_CONFIG.collinearityEpsilon) {
    axis = startDirection.clone().cross(new Vector3(0, 1, 0));
    if (axis.lengthSq() < SPHERE_LAYOUT_CONFIG.collinearityEpsilon)
      axis = startDirection.clone().cross(new Vector3(1, 0, 0));
  }
  axis.normalize();

  for (let segment = 0; segment < segments; segment += 1) {
    const t0 = segment / segments;
    const t1 = (segment + 1) / segments;
    const pointAt = (t: number) => {
      const radius =
        start.length() * (1 - t) +
        end.length() * t +
        Math.sin(Math.PI * t) * SPHERE_LAYOUT_CONFIG.arcHeight;
      return startDirection
        .clone()
        .applyAxisAngle(axis, angle * t)
        .multiplyScalar(radius);
    };
    const p0 = pointAt(t0);
    const p1 = pointAt(t1);
    vertices.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    colors.push(
      color.r * intensity,
      color.g * intensity,
      color.b * intensity,
      color.r * intensity,
      color.g * intensity,
      color.b * intensity,
    );
  }
}
