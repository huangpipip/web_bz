import { useEffect, useRef, type JSX } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BzComputation, BzPointType, KPathResolvedPoint } from "../lib/types";
import {
  buildBzEdgeSegments,
  buildBzFacePolygons,
  buildSpecialPointRenderData,
  getBzExtent
} from "../lib/viewerGeometry";

interface BzThreeViewerProps {
  computation: BzComputation | null;
  selectedPointId: string | null;
  kPath: KPathResolvedPoint[];
  onAddPointToKPath: (pointId: string) => void;
  onRemovePointFromKPath: (pointId: string) => void;
  onSelectPoint: (pointId: string | null) => void;
  showReciprocalVectors: boolean;
  viewResetToken: number;
}

const POINT_COLORS: Record<BzPointType, string> = {
  center: "#ff7a1a",
  edge: "#f2d06b",
  line: "#5fd3bc",
  poly: "#68a5ff"
};

const POINT_RADII: Record<BzPointType, number> = {
  center: 8.1,
  edge: 5.13,
  line: 4.455,
  poly: 5.13
};

const SELECTED_HALO_RADIUS = 11.475;
const K_PATH_POINT_RADIUS = 5.625;
const K_PATH_TUBE_RADIUS = 2.925;
const VECTOR_HEAD_LENGTH = 12;
const VECTOR_HEAD_WIDTH = 5;

function disposeGroupChildren(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          node.material.dispose();
        }
      }

      if (node instanceof THREE.LineSegments || node instanceof THREE.Line || node instanceof THREE.Points) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          node.material.dispose();
        }
      }

      if (node instanceof THREE.ArrowHelper) {
        node.line.geometry.dispose();
        (node.line.material as THREE.Material).dispose();
        node.cone.geometry.dispose();
        (node.cone.material as THREE.Material).dispose();
      }
    });
  }
}

function createFaceMesh(vertices: THREE.Vector3[], color: THREE.ColorRepresentation): THREE.Mesh {
  const triangleVertices: number[] = [];

  for (let index = 1; index < vertices.length - 1; index += 1) {
    const a = vertices[0];
    const b = vertices[index];
    const c = vertices[index + 1];
    triangleVertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(triangleVertices, 3));
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.9,
      side: THREE.DoubleSide
    })
  );
}

function formatPointType(type: BzPointType): string {
  switch (type) {
    case "center":
      return "Center";
    case "edge":
      return "Vertex";
    case "line":
      return "Edge midpoint";
    case "poly":
      return "Face center";
  }
}

function formatPointLabel(point: NonNullable<BzComputation["points"][number]>): string {
  return `${formatPointType(point.type)}  ${point.fractional
    .map((value) => value.toFixed(4))
    .join(", ")}`;
}

function getViewerMetrics(
  camera: THREE.PerspectiveCamera | null,
  renderer: THREE.WebGLRenderer | null,
  controls: OrbitControls | null
): { viewportHeight: number; worldUnitsPerPixel: number } {
  const viewport = new THREE.Vector2();
  renderer?.getSize(viewport);
  const viewportHeight = Math.max(1, viewport.y);
  const distance = camera && controls ? camera.position.distanceTo(controls.target) : 1;
  const fovRadians = THREE.MathUtils.degToRad(camera?.fov ?? 46);
  const worldUnitsPerPixel = (2 * distance * Math.tan(fovRadians / 2)) / viewportHeight;

  return {
    viewportHeight,
    worldUnitsPerPixel
  };
}

function createCylinderBetweenPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material
): THREE.Mesh | null {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length <= 1e-6) {
    return null;
  }

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

export default function BzThreeViewer({
  computation,
  selectedPointId,
  kPath,
  onAddPointToKPath,
  onRemovePointFromKPath,
  onSelectPoint,
  showReciprocalVectors,
  viewResetToken
}: BzThreeViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);
  const pointMeshesRef = useRef<THREE.Mesh[]>([]);
  const currentExtentRef = useRef(1);
  const previousResetTokenRef = useRef(viewResetToken);
  const previousComputationRef = useRef<BzComputation | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const interactionRef = useRef({ x: 0, y: 0, moved: false });

  const selectedPoint = computation?.points.find((point) => point.id === selectedPointId) ?? null;
  const selectedPointCount = kPath.filter((point) => point.sourcePointId === selectedPointId).length;

  const fitCamera = (extent: number): void => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    const distance = Math.max(extent * 4.6, 6);
    camera.position.set(distance * 0.95, distance * 0.72, distance * 1.08);
    camera.near = Math.max(0.01, extent / 50);
    camera.far = Math.max(400, distance * 25);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "viewer-three-canvas";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#051018", 10, 36);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = 1.5;
    controls.maxDistance = 80;

    const ambientLight = new THREE.AmbientLight("#d9ebff", 1.25);
    const keyLight = new THREE.DirectionalLight("#c7dcff", 1.6);
    keyLight.position.set(4, 7, 8);
    const rimLight = new THREE.DirectionalLight("#ffb56d", 1.05);
    rimLight.position.set(-6, -3, 5);
    const fillLight = new THREE.PointLight("#7ebeff", 18, 26, 2);
    fillLight.position.set(0, 0, 8);

    scene.add(ambientLight, keyLight, rimLight, fillLight);

    const contentGroup = new THREE.Group();
    scene.add(contentGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    contentGroupRef.current = contentGroup;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleResize = (): void => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
    };

    const handlePointerDown = (event: PointerEvent): void => {
      interactionRef.current = {
        x: event.clientX,
        y: event.clientY,
        moved: false
      };
    };

    const handlePointerMove = (event: PointerEvent): void => {
      interactionRef.current.moved =
        interactionRef.current.moved ||
        Math.abs(event.clientX - interactionRef.current.x) > 3 ||
        Math.abs(event.clientY - interactionRef.current.y) > 3;
    };

    const handleClick = (event: MouseEvent): void => {
      if (!computation || interactionRef.current.moved) {
        interactionRef.current.moved = false;
        return;
      }

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pointMeshesRef.current, false)[0];
      if (!hit) {
        onSelectPoint(null);
        return;
      }

      onSelectPoint((hit.object.userData.pointId as string) ?? null);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);
    handleResize();
    fitCamera(currentExtentRef.current);

    const renderFrame = (): void => {
      controls.update();
      renderer.render(scene, camera);
      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      disposeGroupChildren(contentGroup);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      contentGroupRef.current = null;
      pointMeshesRef.current = [];
    };
  }, [computation, onSelectPoint]);

  useEffect(() => {
    const group = contentGroupRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const controls = controlsRef.current;
    if (!group) {
      return;
    }

    disposeGroupChildren(group);
    pointMeshesRef.current = [];

    if (!computation) {
      previousComputationRef.current = null;
      return;
    }

    const faces = buildBzFacePolygons(computation);
    const edges = buildBzEdgeSegments(computation);
    const points = buildSpecialPointRenderData(computation);
    const extent = getBzExtent(computation);
    const { worldUnitsPerPixel } = getViewerMetrics(camera, renderer, controls);
    currentExtentRef.current = extent;

    for (const face of faces) {
      const vertices = face.vertices.map((vertex) => new THREE.Vector3(vertex[0], vertex[1], vertex[2]));
      group.add(createFaceMesh(vertices, "#5f89c7"));
    }

    const edgeVertices = edges.flatMap((edge) => [
      edge.start[0], edge.start[1], edge.start[2],
      edge.end[0], edge.end[1], edge.end[2]
    ]);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgeVertices, 3));
    group.add(
      new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({
          color: "#eef5ff",
          transparent: true,
          opacity: 0.82
        })
      )
    );

    const pointMeshes: THREE.Mesh[] = [];
    for (const point of points) {
      const pointRadius = Math.max(POINT_RADII[point.type] * worldUnitsPerPixel, 0.008);
      const geometry = new THREE.SphereGeometry(pointRadius, 24, 24);
      const material = new THREE.MeshStandardMaterial({
        color: POINT_COLORS[point.type],
        emissive: point.id === selectedPointId ? new THREE.Color("#ffffff") : new THREE.Color(POINT_COLORS[point.type]),
        emissiveIntensity: point.id === selectedPointId ? 0.55 : 0.12,
        roughness: 0.35,
        metalness: 0.08
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(point.cart[0], point.cart[1], point.cart[2]);
      mesh.userData.pointId = point.id;
      group.add(mesh);
      pointMeshes.push(mesh);

      if (point.id === selectedPointId) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(SELECTED_HALO_RADIUS * worldUnitsPerPixel, pointRadius * 1.2), 24, 24),
          new THREE.MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            opacity: 0.16
          })
        );
        halo.position.copy(mesh.position);
        group.add(halo);
      }
    }
    pointMeshesRef.current = pointMeshes;

    let activeSegment: THREE.Vector3[] = [];
    const pathPointRadius = Math.max(K_PATH_POINT_RADIUS * worldUnitsPerPixel, 0.008);
    const pathTubeRadius = Math.max(K_PATH_TUBE_RADIUS * worldUnitsPerPixel, 0.004);
    const pathMaterial = new THREE.MeshStandardMaterial({
      color: "#ff76be",
      emissive: new THREE.Color("#ff76be"),
      emissiveIntensity: 0.18,
      roughness: 0.26,
      metalness: 0.04
    });
    const pathNodeMaterial = new THREE.MeshStandardMaterial({
      color: "#ffd2e9",
      emissive: new THREE.Color("#ffd2e9"),
      emissiveIntensity: 0.14,
      roughness: 0.28,
      metalness: 0.04
    });

    const flushSegment = (): void => {
      if (activeSegment.length < 2) {
        activeSegment = [];
        return;
      }

      for (let index = 1; index < activeSegment.length; index += 1) {
        const segmentMesh = createCylinderBetweenPoints(
          activeSegment[index - 1],
          activeSegment[index],
          pathTubeRadius,
          pathMaterial.clone()
        );
        if (segmentMesh) {
          group.add(segmentMesh);
        }
      }

      activeSegment = [];
    };

    for (const point of kPath) {
      if (!point.cart) {
        flushSegment();
        continue;
      }

      const vector = new THREE.Vector3(point.cart[0], point.cart[1], point.cart[2]);
      activeSegment.push(vector);

      const nodeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(pathPointRadius, 20, 20),
        pathNodeMaterial.clone()
      );
      nodeMesh.position.copy(vector);
      group.add(nodeMesh);
    }
    flushSegment();

    if (showReciprocalVectors) {
      const colors = ["#ff8a3d", "#5ae6be", "#83b7ff"];
      computation.reciprocal.reciprocalBasis.forEach((basisVector, index) => {
        const direction = new THREE.Vector3(basisVector[0], basisVector[1], basisVector[2]);
        const length = direction.length();
        if (length <= 0) {
          return;
        }

        group.add(
          new THREE.ArrowHelper(
            direction.clone().normalize(),
            new THREE.Vector3(0, 0, 0),
            length,
            colors[index],
            Math.max(VECTOR_HEAD_LENGTH * worldUnitsPerPixel, length * 0.05),
            Math.max(VECTOR_HEAD_WIDTH * worldUnitsPerPixel, length * 0.02)
          )
        );
      });
    }

    if (previousComputationRef.current !== computation) {
      fitCamera(extent);
      previousComputationRef.current = computation;
    }
  }, [computation, kPath, selectedPointId, showReciprocalVectors]);

  useEffect(() => {
    if (viewResetToken === previousResetTokenRef.current) {
      return;
    }

    previousResetTokenRef.current = viewResetToken;
    fitCamera(currentExtentRef.current);
  }, [viewResetToken]);

  return (
    <div className="viewer-panel viewer-panel-three">
      <div className="viewer-canvas-shell viewer-three-shell">
        <div className="viewer-three-stage" ref={containerRef} />
        {!computation ? (
          <div className="viewer-empty">
            <p>Paste a POSCAR and render to build the first Brillouin zone.</p>
          </div>
        ) : null}
        {computation && selectedPoint ? (
          <div className="viewer-overlay-card">
            <div className="viewer-overlay-copy">
              <span className="viewer-overlay-eyebrow">{formatPointType(selectedPoint.type)}</span>
              <strong>{formatPointLabel(selectedPoint)}</strong>
            </div>
            <div className="viewer-overlay-actions">
              <button
                className="viewer-overlay-action viewer-overlay-action-remove"
                disabled={selectedPointCount === 0}
                type="button"
                onClick={() => onRemovePointFromKPath(selectedPoint.id)}
                aria-label="Remove selected point from K-path"
              >
                -
              </button>
              <button
                className="viewer-overlay-action viewer-overlay-action-add"
                type="button"
                onClick={() => onAddPointToKPath(selectedPoint.id)}
                aria-label="Add selected point to K-path"
              >
                +
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
