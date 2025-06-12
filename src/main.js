// --- Import các thư viện và module khác ---
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as RAPIER from "rapier3d";

import { SceneManager } from "./sceneManager.js";
import { TruckController } from "./truckController.js";
import { PhysicsManager } from "./physicsManager.js";
import { ObjectFactory } from "./objectFactory.js";
import { SoundManager } from "./soundManager.js";

// --- Biến toàn cục ---
let scene, camera, renderer, controls;
let physicsManager, truckController, sceneManager, soundManager;
let keyboardState = {};
let animationFrameId = null;
const clock = new THREE.Clock();
const smoothedTruckPos = new THREE.Vector3();
let cameraMode = 0;

// Biến lưu trữ lựa chọn xe hiện tại để reset
let currentVehicleOptions = null;

// --- Cài đặt Three.js ---
function setupThreeJS(renderTarget) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(-20, 15, 30);
  camera.lookAt(new THREE.Vector3(0, 0.5, 0));
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
  renderTarget.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minPolarAngle = 0; // Góc thấp nhất là nhìn ngangAdd commentMore actions
  controls.maxPolarAngle = Math.PI * 0.49; // Giới hạn góc nhìn không cho nhìn xuống dưới xe
  controls.target.set(-80, 0.5, -80);
  controls.update();
  controls.enabled = false;
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Tăng cường độ & dùng màu trắng
  scene.add(ambientLight);

  // Thêm ánh sáng DirectionalLight
  const directionalLight = new THREE.DirectionalLight(0xfff3e0, 2); // màu ánh sáng hơi vàng ấm
  directionalLight.position.set(80, 100, 50);
  directionalLight.castShadow = true;

  // Đổ bóng mềm hơn, tránh tối gắt
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.bias = -0.0005;
  directionalLight.shadow.normalBias = 0.3;

  // Camera chiếu bóng rộng hơn nếu cần
  const d = 200;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 500;

  scene.add(directionalLight);

  // Them ánh sáng HemisphereLight
  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.6);
  scene.add(hemisphereLight);

  // Thêm nền ảo
  const infiniteGround = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({
        color: 0x6CBD07, // màu xanh dương
    })
  );
  infiniteGround.rotation.x = -Math.PI / 2;
  infiniteGround.position.y = -5; // thấp hơn map chính
  scene.add(infiniteGround);



  window.addEventListener("resize", () => {
    if (!renderer) return;
    const newWidth = renderTarget.clientWidth;
    const newHeight = renderTarget.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  });
}

// --- Logic Game ---
window.startGame = async function (vehicleOptions) {
  // Lưu lại lựa chọn xe để có thể reset
  currentVehicleOptions = vehicleOptions;

  const renderTarget = document.getElementById("render-target");
  if (!renderTarget) {
    console.error("Lỗi: Không tìm thấy 'render-target'.");
    return;
  }
  while (renderTarget.firstChild) {
    renderTarget.removeChild(renderTarget.firstChild);
  }
  setupThreeJS(renderTarget);
  soundManager = new SoundManager(camera);
  await soundManager.loadSounds();
  soundManager.playBackgroundMusic();
  physicsManager = new PhysicsManager(RAPIER, soundManager);
  const groundDebugMesh = await physicsManager.setupWorld();
  scene.add(groundDebugMesh);
  sceneManager = new SceneManager(scene, physicsManager);
  const {
    truckMesh,
    gltfObjectsMap,
    truckColliderHandle,
    frontWheelLGroup,
    frontWheelRGroup,
    wheelLMesh,
    wheelRMesh,
    backWheelsMesh,
  } = await sceneManager.loadAssets(vehicleOptions);
  physicsManager.setGltfObjectsMap(gltfObjectsMap);
  const objectFactory = new ObjectFactory(scene, physicsManager);
  objectFactory.createTestObjects();
  truckController = new TruckController(
    truckMesh,
    physicsManager.getTruckRigidBody(),
    truckColliderHandle,
    physicsManager,
    frontWheelLGroup,
    frontWheelRGroup,
    wheelLMesh,
    wheelRMesh,
    backWheelsMesh
  );

  // Xóa listener cũ trước khi thêm mới để tránh bị gọi nhiều lần
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  if (!animationFrameId) {
    animate();
  }
};

// --- Hàm dọn dẹp hoàn toàn tài nguyên game ---
function cleanupGame() {
  console.log("Bắt đầu dọn dẹp tài nguyên game...");
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);

  if (soundManager) {
    soundManager.stopAllSounds();
  }

  if (physicsManager && physicsManager.world) {
    physicsManager.world.free();
  }

  if (scene) {
    while (scene.children.length > 0) {
      const child = scene.children[0];
      scene.remove(child);
      // Dọn dẹp sâu hơn để giải phóng bộ nhớ
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  // Reset các biến quản lý về null
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  physicsManager = null;
  truckController = null;
  sceneManager = null;
  soundManager = null;
  keyboardState = {};
  console.log("Dọn dẹp hoàn tất.");
}

// --- Hàm thoát game ---
window.exitGame = function () {
  cleanupGame();
  const event = new CustomEvent("exitToMenu");
  window.dispatchEvent(event);
};

// --- Hàm tải lại game ---
function reloadGame() {
  console.log("Đang tải lại game...");
  cleanupGame();
  setTimeout(() => {
    window.startGame(currentVehicleOptions);
  }, 100);
}

// --- Xử lý sự kiện bàn phím ---
function handleKeyDown(event) {
  if (event.repeat) return;
  keyboardState[event.code] = true;
  if (event.key === "p" || event.key === "P")
    if (sceneManager) sceneManager.toggleDebugMode();
  if (event.code === "KeyO") {
    cameraMode = (cameraMode + 1) % 3;
    if (controls) controls.enabled = false;
  }
  if (event.code === 'KeyV') {
    controls.enabled = !controls.enabled;   
    if (controls.enabled) {
      truckController.resetMovement();
    }
  }
  if (event.code === "KeyR") {
    reloadGame();
  }
  if (event.code === "KeyH")
    if (soundManager) {
      soundManager.playHornClickSound();
      soundManager.playHornPressSound();
    }
  if (event.code === "Space") {
    if (physicsManager && soundManager && physicsManager.getTruckRigidBody()) {
      const currentLinVel = physicsManager.getTruckRigidBody().linvel();
      const currentSpeed = Math.sqrt(
        currentLinVel.x ** 2 + currentLinVel.z ** 2
      );
      if (currentSpeed > 0.1) soundManager.playBrakeSound();
    }
  }
  if (event.key === "Escape") window.exitGame();
}

function handleKeyUp(event) {
  keyboardState[event.code] = false;
  if (event.code === "KeyH")
    if (soundManager) soundManager.stopHornPressSound();
}

function updateCameraPosition() {
  if (!physicsManager || !physicsManager.getTruckRigidBody()) return;
  const truckRigidBody = physicsManager.getTruckRigidBody();
  const truckPos = new THREE.Vector3().copy(truckRigidBody.translation());
  const truckRot = truckRigidBody.rotation();
  const truckQuat = new THREE.Quaternion(
    truckRot.x,
    truckRot.y,
    truckRot.z,
    truckRot.w
  );
  switch (cameraMode) {
    case 0: {
      const offset = new THREE.Vector3(15, 10, 20);
      const desiredCameraPos = truckPos.clone().add(offset);
      camera.position.lerp(desiredCameraPos, 0.1);
      smoothedTruckPos.lerp(truckPos, 0.1);
      camera.lookAt(smoothedTruckPos);
      break;
    }
    case 1: {
      const offset = new THREE.Vector3(0, 4, 12).applyQuaternion(truckQuat);
      const desiredPos = truckPos.clone().add(offset);
      camera.position.lerp(desiredPos, 0.1);
      const lookAtPos = truckPos.clone().add(new THREE.Vector3(0, 2, 0));
      camera.lookAt(lookAtPos);
      break;
    }
    case 2: {
      const offset = new THREE.Vector3(0, 3.5, -10).applyQuaternion(truckQuat);
      const desiredPos = truckPos.clone().add(offset);
      camera.position.lerp(desiredPos, 0.1);
      const lookAtPos = truckPos.clone().add(new THREE.Vector3(0, 1.5, 0));
      camera.lookAt(lookAtPos);
      break;
    }
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!renderer) return;

  const delta = clock.getDelta();
  if (sceneManager) sceneManager.update(delta);
  if (physicsManager) {
    physicsManager.updatePhysics();
    physicsManager.updateThreeJSObjects();
  }
  if (truckController && controls && !controls.enabled) {
    truckController.handleMovement(keyboardState);
    if (physicsManager.getTruckRigidBody()) {
      const currentLinVel = physicsManager.getTruckRigidBody().linvel();
      const currentSpeed = Math.sqrt(
        currentLinVel.x ** 2 + currentLinVel.z ** 2
      );
      const truckMaxSpeed =
        truckController.truckSpeed * (keyboardState["KeyB"] ? 1.5 : 1);
      const isMoving = Math.abs(currentSpeed) > 0.1;
      const hasMovementInput =
        keyboardState["ArrowUp"] ||
        keyboardState["KeyW"] ||
        keyboardState["ArrowDown"] ||
        keyboardState["KeyS"];
      let volumeBoostFactor = 1;
      if (keyboardState["KeyB"]) volumeBoostFactor = 1.5;
      if (soundManager) {
        if (isMoving || hasMovementInput) {
          soundManager.playEngineSound();
          soundManager.updateEngineVolumeAndPitch(
            currentSpeed,
            truckMaxSpeed,
            volumeBoostFactor
          );
        } else {
          soundManager.stopEngineSound();
        }
      }
    }
    updateCameraPosition();
  } else if (controls) {
    controls.update();
    if (soundManager) soundManager.stopEngineSound();
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
