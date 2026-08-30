import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { EDGE_COLORS, GRAPH_CONFIG, statusColor } from "./config";
import type { EdgeIndex } from "./edge-index";
import type { GraphArtifact, GraphFilters, RelationKind } from "./types";
import { appendSphericalArc, createPositions } from "./spherical-layout";

const edgeColorCache = new Map<RelationKind, THREE.Color>();

function edgeColor(kind: RelationKind): THREE.Color {
  const cached = edgeColorCache.get(kind);
  if (cached) return cached;
  const color = new THREE.Color(EDGE_COLORS[kind]);
  edgeColorCache.set(kind, color);
  return color;
}

interface Graph3DViewProps {
  artifact: GraphArtifact;
  edgeIndex: EdgeIndex;
  filters: GraphFilters;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focusId: string | null;
}

interface SceneState {
  update: (filters: GraphFilters, selectedId: string | null) => void;
  focus: (id: string) => void;
}

const vertexShader = `
  attribute float aSize;
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    vColor = color;
    vVisible = step(${GRAPH_CONFIG.nodes.shader.visibleThreshold}, aSize);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = vVisible * clamp(aSize * (${GRAPH_CONFIG.nodes.shader.perspectiveScale.toFixed(1)} / max(1.0, -mvPosition.z)), ${GRAPH_CONFIG.nodes.shader.minPointSize.toFixed(1)}, ${GRAPH_CONFIG.nodes.shader.maxPointSize.toFixed(1)});
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    if (vVisible < ${GRAPH_CONFIG.nodes.shader.discardThreshold}) discard;
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > ${GRAPH_CONFIG.nodes.shader.discardThreshold}) discard;
    float core = smoothstep(${GRAPH_CONFIG.nodes.shader.discardThreshold}, ${GRAPH_CONFIG.nodes.shader.coreEdge}, d);
    float halo = smoothstep(${GRAPH_CONFIG.nodes.shader.discardThreshold}, ${GRAPH_CONFIG.nodes.shader.haloEdge}, d) * ${GRAPH_CONFIG.nodes.shader.haloStrength};
    gl_FragColor = vec4(vColor * (${GRAPH_CONFIG.nodes.shader.baseBrightness} + halo * ${GRAPH_CONFIG.nodes.shader.haloBrightness}), max(core, halo));
  }
`;

export default function Graph3DView({
  artifact,
  edgeIndex,
  filters,
  selectedId,
  onSelect,
  focusId,
}: Graph3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<SceneState | null>(null);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  const nodeById = useMemo(
    () => new Map(artifact.nodes.map((node) => [node.id, node])),
    [artifact],
  );
  const positions = useMemo(() => createPositions(artifact), [artifact]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "WebGL 2 unavailable";
      const errorTimer = window.setTimeout(() => setError(message), 0);
      return () => window.clearTimeout(errorTimer);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, GRAPH_CONFIG.renderer.maxPixelRatio));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "graph-webgl";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(GRAPH_CONFIG.fog.color, GRAPH_CONFIG.fog.density);
    const camera = new THREE.PerspectiveCamera(
      GRAPH_CONFIG.camera.fieldOfView,
      container.clientWidth / container.clientHeight,
      GRAPH_CONFIG.camera.near,
      GRAPH_CONFIG.camera.far,
    );
    camera.position.set(...GRAPH_CONFIG.camera.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = GRAPH_CONFIG.controls.dampingFactor;
    controls.rotateSpeed = GRAPH_CONFIG.controls.rotateSpeed;
    controls.zoomSpeed = GRAPH_CONFIG.controls.zoomSpeed;
    controls.panSpeed = GRAPH_CONFIG.controls.panSpeed;
    controls.minDistance = GRAPH_CONFIG.controls.minDistance;
    controls.maxDistance = GRAPH_CONFIG.controls.maxDistance;
    controls.autoRotate = true;
    controls.autoRotateSpeed = GRAPH_CONFIG.controls.autoRotateSpeed;
    controls.zoomToCursor = true;

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: GRAPH_CONFIG.shell.color,
      wireframe: true,
      transparent: true,
      opacity: GRAPH_CONFIG.shell.outer.opacity,
      depthWrite: false,
    });
    const outerShell = new THREE.Mesh(
      new THREE.SphereGeometry(
        GRAPH_CONFIG.shell.outer.radius,
        GRAPH_CONFIG.shell.outer.widthSegments,
        GRAPH_CONFIG.shell.outer.heightSegments,
      ),
      shellMaterial,
    );
    graphGroup.add(outerShell);
    const innerShell = new THREE.Mesh(
      new THREE.SphereGeometry(
        GRAPH_CONFIG.shell.inner.radius,
        GRAPH_CONFIG.shell.inner.widthSegments,
        GRAPH_CONFIG.shell.inner.heightSegments,
      ),
      shellMaterial.clone(),
    );
    innerShell.material.opacity = GRAPH_CONFIG.shell.inner.opacity;
    innerShell.rotation.set(...GRAPH_CONFIG.shell.inner.rotation);
    graphGroup.add(innerShell);

    const nodeOrder = artifact.nodes.map((node) => node.id);
    const positionArray = new Float32Array(nodeOrder.length * 3);
    const colorArray = new Float32Array(nodeOrder.length * 3);
    const sizeArray = new Float32Array(nodeOrder.length);
    artifact.nodes.forEach((node, index) => {
      const position = positions.get(node.id)!;
      positionArray.set([position.x, position.y, position.z], index * 3);
      const color = new THREE.Color(statusColor(node.status));
      colorArray.set([color.r, color.g, color.b], index * 3);
      sizeArray[index] =
        GRAPH_CONFIG.nodes.baseSize +
        Math.min(
          GRAPH_CONFIG.nodes.maxCitationBonus,
          Math.log2(node.inDegree + 1) * GRAPH_CONFIG.nodes.citationScale,
        );
    });
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
    nodeGeometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
    nodeGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizeArray, 1));
    const nodeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    graphGroup.add(nodePoints);

    const edgeLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: GRAPH_CONFIG.edges.contextOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    graphGroup.add(edgeLines);

    const activeEdgeMaterial = new LineMaterial({
      vertexColors: true,
      transparent: true,
      opacity: GRAPH_CONFIG.edges.activeOpacity,
      linewidth: GRAPH_CONFIG.edges.activeWidth,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const activeEdgeLines = new LineSegments2(new LineSegmentsGeometry(), activeEdgeMaterial);
    activeEdgeLines.visible = false;
    activeEdgeLines.renderOrder = GRAPH_CONFIG.edges.activeRenderOrder;
    graphGroup.add(activeEdgeLines);

    const rebuildEdges = (
      currentFilters: GraphFilters,
      currentSelected: string | null,
      visibleNodes: Set<string>,
    ) => {
      const contextVertices: number[] = [];
      const contextColors: number[] = [];
      const activeVertices: number[] = [];
      const activeColors: number[] = [];
      for (const edge of artifact.edges) {
        if (
          !currentFilters.relations.has(edge.kind) ||
          !visibleNodes.has(edge.source) ||
          !visibleNodes.has(edge.target)
        )
          continue;
        const incident = Boolean(
          currentSelected && (edge.source === currentSelected || edge.target === currentSelected),
        );
        if (
          !incident &&
          edge.kind.startsWith("reference-") &&
          (nodeById.get(edge.target)?.inDegree ?? 0) < GRAPH_CONFIG.edges.contextCitationThreshold
        )
          continue;
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) continue;
        const color = edgeColor(edge.kind);
        if (incident) {
          appendSphericalArc(
            activeVertices,
            activeColors,
            source,
            target,
            color,
            GRAPH_CONFIG.edges.activeIntensity,
            GRAPH_CONFIG.edges.activeArcSegments,
          );
        } else {
          appendSphericalArc(
            contextVertices,
            contextColors,
            source,
            target,
            color,
            currentSelected
              ? GRAPH_CONFIG.edges.selectedContextIntensity
              : GRAPH_CONFIG.edges.globalIntensity,
            GRAPH_CONFIG.edges.contextArcSegments,
          );
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(contextVertices, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(contextColors, 3));
      edgeLines.geometry.dispose();
      edgeLines.geometry = geometry;
      edgeLines.material.opacity = currentSelected
        ? GRAPH_CONFIG.edges.selectedContextOpacity
        : GRAPH_CONFIG.edges.contextOpacity;

      const activeGeometry = new LineSegmentsGeometry();
      activeGeometry.setPositions(activeVertices);
      activeGeometry.setColors(activeColors);
      activeEdgeLines.geometry.dispose();
      activeEdgeLines.geometry = activeGeometry;
      activeEdgeLines.visible = activeVertices.length > 0;
    };

    const update = (currentFilters: GraphFilters, currentSelected: string | null) => {
      const visibleNodes = new Set(
        artifact.nodes
          .filter(
            (node) =>
              (node.year ?? currentFilters.startYear) >= currentFilters.startYear &&
              (node.year ?? currentFilters.endYear) <= currentFilters.endYear &&
              (currentFilters.status === "ALL" || node.status === currentFilters.status) &&
              (currentFilters.stream === "ALL" || node.stream === currentFilters.stream),
          )
          .map((node) => node.id),
      );
      const selectedNeighbors = new Set<string>();
      if (currentSelected) {
        selectedNeighbors.add(currentSelected);
        for (const edge of edgeIndex.outgoing.get(currentSelected) ?? [])
          selectedNeighbors.add(edge.target);
        for (const edge of edgeIndex.incoming.get(currentSelected) ?? [])
          selectedNeighbors.add(edge.source);
      }
      artifact.nodes.forEach((node, index) => {
        if (!visibleNodes.has(node.id)) {
          sizeArray[index] = 0;
          return;
        }
        const base =
          GRAPH_CONFIG.nodes.baseSize +
          Math.min(
            GRAPH_CONFIG.nodes.maxCitationBonus,
            Math.log2(node.inDegree + 1) * GRAPH_CONFIG.nodes.citationScale,
          );
        sizeArray[index] = currentSelected
          ? node.id === currentSelected
            ? base * GRAPH_CONFIG.nodes.selectedScale
            : selectedNeighbors.has(node.id)
              ? base * GRAPH_CONFIG.nodes.neighborScale
              : base * GRAPH_CONFIG.nodes.contextScale
          : base;
      });
      (nodeGeometry.getAttribute("aSize") as THREE.BufferAttribute).needsUpdate = true;
      rebuildEdges(currentFilters, currentSelected, visibleNodes);
    };

    let focusAnimation = 0;
    const focus = (id: string) => {
      const target = positions.get(id);
      if (!target) return;
      cancelAnimationFrame(focusAnimation);
      const fromCamera = camera.position.clone();
      const fromTarget = controls.target.clone();
      const fromDirection = fromCamera.clone().normalize();
      const toDirection = target.clone().normalize();
      const rotation = new THREE.Quaternion().setFromUnitVectors(fromDirection, toDirection);
      const identity = new THREE.Quaternion();
      const distance = Math.max(GRAPH_CONFIG.focus.minimumDistance, fromCamera.length());
      const started = performance.now();
      const animateFocus = (now: number) => {
        const raw = Math.min(1, (now - started) / GRAPH_CONFIG.focus.durationMs);
        const eased = 1 - Math.pow(1 - raw, GRAPH_CONFIG.focus.easingPower);
        const currentRotation = identity.clone().slerp(rotation, eased);
        camera.position.copy(
          fromDirection.clone().applyQuaternion(currentRotation).multiplyScalar(distance),
        );
        controls.target.lerpVectors(fromTarget, new THREE.Vector3(), eased);
        if (raw < 1) focusAnimation = requestAnimationFrame(animateFocus);
      };
      focusAnimation = requestAnimationFrame(animateFocus);
    };
    sceneStateRef.current = { update, focus };

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = GRAPH_CONFIG.interaction.pointThreshold;
    const pointer = new THREE.Vector2();
    let hoveredIndex: number | null = null;
    let pointerFrame = 0;
    let downX = 0;
    let downY = 0;

    const pick = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersection = raycaster.intersectObject(nodePoints, false)[0];
      hoveredIndex = intersection?.index ?? null;
      renderer.domElement.style.cursor = hoveredIndex == null ? "grab" : "pointer";
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      if (hoveredIndex == null || sizeArray[hoveredIndex] === 0) {
        tooltip.classList.remove("visible");
        return;
      }
      const node = nodeById.get(nodeOrder[hoveredIndex]);
      if (!node) return;
      const number = document.createElement("strong");
      const title = document.createElement("span");
      number.textContent = `RFC ${node.number}`;
      title.textContent = node.title;
      tooltip.replaceChildren(number, title);
      tooltip.style.left = `${event.clientX - bounds.left + GRAPH_CONFIG.interaction.tooltipOffset}px`;
      tooltip.style.top = `${event.clientY - bounds.top + GRAPH_CONFIG.interaction.tooltipOffset}px`;
      tooltip.classList.add("visible");
    };
    const onPointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => pick(event));
    };
    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (
        Math.hypot(event.clientX - downX, event.clientY - downY) >
        GRAPH_CONFIG.interaction.maximumClickTravel
      )
        return;
      if (hoveredIndex != null && sizeArray[hoveredIndex] > 0)
        onSelectRef.current(nodeOrder[hoveredIndex]);
      else onSelectRef.current(null);
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let resumeTimer = 0;
    const pauseRotation = () => {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer);
    };
    const resumeRotation = () => {
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, GRAPH_CONFIG.controls.resumeDelayMs);
    };
    controls.addEventListener("start", pauseRotation);
    controls.addEventListener("end", resumeRotation);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      controls.update(clock.getDelta());
      outerShell.rotation.y += GRAPH_CONFIG.shell.outerRotationSpeed;
      innerShell.rotation.y += GRAPH_CONFIG.shell.innerRotationSpeed;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(focusAnimation);
      window.clearTimeout(resumeTimer);
      observer.disconnect();
      controls.removeEventListener("start", pauseRotation);
      controls.removeEventListener("end", resumeRotation);
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      edgeLines.geometry.dispose();
      edgeLines.material.dispose();
      activeEdgeLines.geometry.dispose();
      activeEdgeMaterial.dispose();
      outerShell.geometry.dispose();
      shellMaterial.dispose();
      innerShell.geometry.dispose();
      innerShell.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneStateRef.current = null;
    };
  }, [artifact, edgeIndex, nodeById, positions]);

  useEffect(() => {
    sceneStateRef.current?.update(filters, selectedId);
  }, [filters, selectedId]);
  useEffect(() => {
    if (focusId) sceneStateRef.current?.focus(focusId);
  }, [focusId]);

  return (
    <div
      className="graph-canvas graph-3d"
      ref={containerRef}
      aria-label="Interactive three-dimensional RFC graph"
    >
      <div className="depth-axis">
        <span>{artifact.meta.minYear}</span>
        <i />
        <strong>TEMPORAL DEPTH</strong>
        <i />
        <span>{artifact.meta.maxYear}</span>
      </div>
      <div className="graph-tooltip" ref={tooltipRef} />
      {error && (
        <div className="webgl-error">
          <strong>WebGL 2 unavailable</strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
