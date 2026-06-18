import { useEffect, useRef, type JSX } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { BzComputation, Mat3, Vec3 } from "../lib/types";
import { addVec3, lengthVec3 } from "../lib/math";

interface LatticeRelationViewerProps {
  computation: BzComputation | null;
  usePerspectiveProjection: boolean;
  viewResetToken: number;
}

type ViewerCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

const BASIS_COLORS = ["#ff8a3d", "#5ae6be", "#83b7ff"];
const CARTESIAN_COLORS = ["#ff5c78", "#9be36d", "#7ebeff"];
const VECTOR_HEAD_LENGTH = 14;
const VECTOR_HEAD_WIDTH = 6;
const ARROW_SHAFT_RADIUS = 0.016;
const WEBGL_LINE_WIDTH = 5;

function disposeObject(node: THREE.Object3D): void {
  if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Line) {
    node.geometry.dispose();
    if (Array.isArray(node.material)) {
      node.material.forEach((material: THREE.Material) => material.dispose());
    } else {
      node.material.dispose();
    }
  }

  if (node instanceof THREE.Sprite) {
    const material = node.material;
    material.map?.dispose();
    material.dispose();
  }

  if (node instanceof THREE.ArrowHelper) {
    node.line.geometry.dispose();
    (node.line.material as THREE.Material).dispose();
    node.cone.geometry.dispose();
    (node.cone.material as THREE.Material).dispose();
  }
}

function disposeGroupChildren(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse(disposeObject);
  }
}

function toVector3(vector: Vec3): THREE.Vector3 {
  return new THREE.Vector3(vector[0], vector[1], vector[2]);
}

function scaleVector(vector: Vec3, scale: number): Vec3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function basisExtent(basis: Mat3): number {
  const corners = buildCellCorners(basis);
  return Math.max(...corners.map((corner) => lengthVec3(corner)), 1);
}

function buildCellCorners([a, b, c]: Mat3): Vec3[] {
  const origin: Vec3 = [0, 0, 0];
  const ab = addVec3(a, b);
  const ac = addVec3(a, c);
  const bc = addVec3(b, c);
  return [origin, a, b, c, ab, ac, bc, addVec3(ab, c)];
}

function createCylinderBetweenPoints(
  start: Vec3,
  end: Vec3,
  radius: number,
  material: THREE.Material
): THREE.Mesh | null {
  const startVector = toVector3(start);
  const endVector = toVector3(end);
  const delta = new THREE.Vector3().subVectors(endVector, startVector);
  const length = delta.length();
  if (length <= 1e-8) {
    return null;
  }

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function createWebglLineSegments(
  points: Vec3[],
  color: string,
  opacity: number,
  renderer: THREE.WebGLRenderer | null
): LineSegments2 {
  const viewport = new THREE.Vector2(1, 1);
  renderer?.getSize(viewport);

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(points.flatMap((point) => point));

  const material = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: WEBGL_LINE_WIDTH,
    transparent: true,
    opacity,
    depthWrite: false,
    resolution: viewport
  });

  const lines = new LineSegments2(geometry, material);
  lines.renderOrder = 0;
  return lines;
}

function createCellFrame(basis: Mat3, renderer: THREE.WebGLRenderer | null): LineSegments2 {
  const [o, a, b, c, ab, ac, bc, abc] = buildCellCorners(basis);
  return createWebglLineSegments(
    [
      o, a,
      o, b,
      o, c,
      a, ab,
      a, ac,
      b, ab,
      b, bc,
      c, ac,
      c, bc,
      ab, abc,
      ac, abc,
      bc, abc
    ],
    "#f4f8ff",
    0.82,
    renderer
  );
}

function createLabelSprite(text: string, color: string, scale: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "700 38px Avenir Next, Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(5, 11, 18, 0.72)";
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(42, 22, 172, 52, 16);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
  );
  sprite.scale.set(scale * 0.42, scale * 0.16, 1);
  return sprite;
}

function addArrowWithLabel(
  group: THREE.Group,
  vector: Vec3,
  label: string,
  color: string,
  worldUnitsPerPixel: number,
  labelScale: number
): void {
  const direction = toVector3(vector);
  const length = direction.length();
  if (length <= 1e-8) {
    return;
  }

  const shaft = createCylinderBetweenPoints(
    [0, 0, 0],
    vector,
    Math.max(ARROW_SHAFT_RADIUS * labelScale, 2.6 * worldUnitsPerPixel),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.86,
      depthTest: false,
      depthWrite: false
    })
  );
  if (shaft) {
    shaft.renderOrder = 2;
    group.add(shaft);
  }

  const arrow = new THREE.ArrowHelper(
    direction.clone().normalize(),
    new THREE.Vector3(0, 0, 0),
    length,
    color,
    Math.max(VECTOR_HEAD_LENGTH * worldUnitsPerPixel, length * 0.08),
    Math.max(VECTOR_HEAD_WIDTH * worldUnitsPerPixel, length * 0.035)
  );
  for (const arrowPart of [arrow.line, arrow.cone]) {
    const materials = Array.isArray(arrowPart.material) ? arrowPart.material : [arrowPart.material];
    for (const material of materials) {
      material.transparent = true;
      material.depthTest = false;
      material.depthWrite = false;
    }
    arrowPart.renderOrder = 2;
  }
  group.add(arrow);

  const labelSprite = createLabelSprite(label, color, labelScale);
  labelSprite.position.copy(direction.multiplyScalar(1.08));
  labelSprite.renderOrder = 3;
  group.add(labelSprite);
}

function getViewerMetrics(
  camera: ViewerCamera | null,
  renderer: THREE.WebGLRenderer | null,
  controls: OrbitControls | null
): { worldUnitsPerPixel: number } {
  const viewport = new THREE.Vector2();
  renderer?.getSize(viewport);
  const viewportHeight = Math.max(1, viewport.y);
  let worldUnitsPerPixel = 1 / viewportHeight;
  if (camera instanceof THREE.OrthographicCamera) {
    worldUnitsPerPixel = (camera.top - camera.bottom) / (camera.zoom * viewportHeight);
  } else if (camera && controls) {
    const distance = camera.position.distanceTo(controls.target);
    const fovRadians = THREE.MathUtils.degToRad(camera.fov);
    worldUnitsPerPixel = (2 * distance * Math.tan(fovRadians / 2)) / viewportHeight;
  }
  return {
    worldUnitsPerPixel
  };
}

export default function LatticeRelationViewer({
  computation,
  usePerspectiveProjection,
  viewResetToken
}: LatticeRelationViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<ViewerCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);
  const currentExtentRef = useRef(1);
  const previousResetTokenRef = useRef(viewResetToken);
  const animationFrameRef = useRef<number | null>(null);

  const fitCamera = (extent: number): void => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    const distance = Math.max(extent * 1.85, 3.2);
    camera.position.set(distance * 0.92, distance * 0.78, distance * 1.06);
    camera.near = Math.max(0.01, extent / 80);
    camera.far = Math.max(300, distance * 24);
    if (camera instanceof THREE.OrthographicCamera) {
      const viewport = new THREE.Vector2(1, 1);
      rendererRef.current?.getSize(viewport);
      const aspect = viewport.x / Math.max(1, viewport.y);
      const halfHeight = Math.max(extent * 1.3, 1.5);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.zoom = 1;
    }
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

    const camera: ViewerCamera = usePerspectiveProjection
      ? new THREE.PerspectiveCamera(46, 1, 0.1, 500)
      : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 120;

    const contentGroup = new THREE.Group();
    scene.add(contentGroup);
    scene.add(
      new THREE.AmbientLight("#d9ebff", 1.15),
      new THREE.DirectionalLight("#d7e7ff", 1.35),
      new THREE.HemisphereLight("#91c6ff", "#ffb56d", 0.55)
    );

    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    contentGroupRef.current = contentGroup;

    const handleResize = (): void => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      renderer.setSize(bounds.width, bounds.height, false);
      const aspect = bounds.width / bounds.height;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = aspect;
      } else {
        const halfHeight = Math.max(currentExtentRef.current * 1.3, 1.5);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
      }
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
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
      controls.dispose();
      disposeGroupChildren(contentGroup);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      contentGroupRef.current = null;
    };
  }, [usePerspectiveProjection]);

  useEffect(() => {
    const group = contentGroupRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const controls = controlsRef.current;
    if (!group) {
      return;
    }

    disposeGroupChildren(group);
    if (!computation) {
      return;
    }

    const basis = computation.parsed.lattice;
    const extent = basisExtent(basis);
    const axisLength = extent * 1.18;
    const { worldUnitsPerPixel } = getViewerMetrics(camera, renderer, controls);
    const labelScale = Math.max(extent * 0.28, 0.5);
    currentExtentRef.current = extent;

    group.add(createCellFrame(basis, renderer));
    group.add(
      createWebglLineSegments(
        [
          scaleVector([1, 0, 0], -axisLength * 0.12), scaleVector([1, 0, 0], axisLength),
          scaleVector([0, 1, 0], -axisLength * 0.12), scaleVector([0, 1, 0], axisLength),
          scaleVector([0, 0, 1], -axisLength * 0.12), scaleVector([0, 0, 1], axisLength)
        ],
        "#7d8aa2",
        0.48,
        renderer
      )
    );

    const cartesianAxes: Array<[string, Vec3]> = [
      ["x", [axisLength, 0, 0] as Vec3],
      ["y", [0, axisLength, 0] as Vec3],
      ["z", [0, 0, axisLength] as Vec3]
    ];
    cartesianAxes.forEach(([label, vector], index) => {
      addArrowWithLabel(group, vector, label, CARTESIAN_COLORS[index], worldUnitsPerPixel, labelScale);
    });

    const labels = ["a1", "a2", "a3"];
    basis.forEach((basisVector, index) => {
      addArrowWithLabel(group, basisVector, labels[index], BASIS_COLORS[index], worldUnitsPerPixel, labelScale);
    });

    const origin = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(5.5 * worldUnitsPerPixel, extent * 0.012), 24, 24),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#ffffff",
        emissiveIntensity: 0.18,
        roughness: 0.3
      })
    );
    group.add(origin);
    fitCamera(extent);
  }, [computation, usePerspectiveProjection]);

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
            <p>Paste a POSCAR and render to inspect lattice basis vectors.</p>
          </div>
        ) : (
          <div className="lattice-overlay-card">
            <div className="lattice-overlay-copy">
              <span className="viewer-overlay-eyebrow">Lattice frame</span>
              <strong>Direct basis</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
