// src/vehiclePreviewManager.js

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

class VehiclePreviewManager {
  constructor() {
    this.isAttached = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(4, 2, 5);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
    this.controls = null;
    this.loader = new GLTFLoader();
    this.currentVehicle = null;
    this.animationFrameId = null;
    this.loadingModelName = null;
    this.animate();
  }

  attach(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    container.appendChild(this.renderer.domElement);

    // THAY ĐỔI: Cấu hình lại OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // 1. Bật tính năng zoom
    this.controls.enableZoom = true;

    // 2. Thêm quán tính để zoom/xoay mượt hơn
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // 3. Giới hạn khoảng cách zoom
    this.controls.minDistance = 2.5; // Gần nhất
    this.controls.maxDistance = 10; // Xa nhất

    // 4. Giữ lại tính năng tự xoay
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.0;

    this.isAttached = true;
  }

  detach() {
    if (!this.isAttached || !this.renderer.domElement.parentElement) return;
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    this.renderer.domElement.parentElement.removeChild(
      this.renderer.domElement
    );
    this.isAttached = false;
  }

  disposeCurrentVehicle() {
    if (this.currentVehicle) {
      this.scene.remove(this.currentVehicle);
      this.currentVehicle.traverse((object) => {
        if (object.isMesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      this.currentVehicle = null;
    }
  }

  loadVehicle(modelName, customization) {
    this.loadingModelName = modelName;

    const modelPath = `assets/models/${modelName}.glb`;
    this.loader.load(
      modelPath,
      (gltf) => {
        if (this.loadingModelName !== modelName) {
          return;
        }
        this.disposeCurrentVehicle();
        this.currentVehicle = gltf.scene;
        const box = new THREE.Box3().setFromObject(this.currentVehicle);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / maxDim;
        this.currentVehicle.scale.multiplyScalar(scale);
        this.currentVehicle.position.sub(center.multiplyScalar(scale));
        this.scene.add(this.currentVehicle);

        if (customization) {
          this.applyCustomization(customization);
        }
      },
      undefined,
      (error) => {
        console.error(`Error loading preview model: ${modelName}`, error);
      }
    );
  }

  applyCustomization(options) {
    if (!this.currentVehicle) return;
    const skinMesh = this.currentVehicle.getObjectByName("Skin");
    if (skinMesh && skinMesh.material) {
      const material = skinMesh.material;
      if (options.textureURL) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(options.textureURL, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        });
      } else if (options.color) {
        material.map = null;
        material.color.set(options.color);
        material.needsUpdate = true;
      }
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    if (this.isAttached && this.controls) {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  cleanup() {
    console.log("Cleaning up vehicle preview permanently...");
    this.detach();
    this.disposeCurrentVehicle();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
  }
}

window.VehiclePreviewManager = VehiclePreviewManager;
