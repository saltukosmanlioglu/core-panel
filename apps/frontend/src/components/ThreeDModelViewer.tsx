'use client';

import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  modelUrl: string;
  fileName?: string;
}

interface ViewerState {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  initialCameraPosition: THREE.Vector3;
  initialTarget: THREE.Vector3;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

export function ThreeDModelViewer({ modelUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<ViewerState | null>(null);

  useEffect(() => {
    console.log('[ThreeDModelViewer] modelUrl:', modelUrl);
  }, [modelUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(5, 4, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 8, 6);
    scene.add(ambientLight, directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;

    let model: THREE.Object3D | null = null;
    let animationFrame = 0;
    let disposed = false;

    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();
    stateRef.current = { camera, controls, renderer, initialCameraPosition, initialTarget };

    const fitCameraToModel = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const distance = Math.abs(maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.8;

      camera.position.set(center.x + distance * 0.45, center.y + distance * 0.32, center.z + distance);
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      controls.target.copy(center);
      controls.update();

      const state = stateRef.current;
      if (state) {
        state.initialCameraPosition.copy(camera.position);
        state.initialTarget.copy(center);
      }
    };

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          return;
        }

        model = gltf.scene;
        scene.add(model);
        fitCameraToModel(model);
      },
      undefined,
      (error) => {
        console.error('[ThreeDModelViewer] GLB load failed', {
          modelUrl,
          error,
        });
      },
    );

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? container.clientWidth;
      const nextHeight = entry?.contentRect.height ?? container.clientHeight;

      if (nextWidth <= 0 || nextHeight <= 0) {
        return;
      }

      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    });
    resizeObserver.observe(container);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      if (model) {
        disposeObject(model);
      }
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [modelUrl]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: '100%',
        overflow: 'hidden',
        backgroundColor: '#1A1A2E',
        '& canvas': {
          display: 'block',
          width: '100% !important',
          height: '100% !important',
        },
      }}
    />
  );
}
