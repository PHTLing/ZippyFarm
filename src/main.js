// --- Import các thư viện và module khác ---
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from 'rapier3d';

import { SceneManager } from './sceneManager.js';
import { TruckController } from './truckController.js';
import { PhysicsManager } from './physicsManager.js';
import { ObjectFactory } from './objectFactory.js';
import { SoundManager } from './soundManager.js';

// --- Biến toàn cục (nếu cần thiết cho việc truy cập từ bên ngoài) ---
let scene, camera, renderer, controls;
let physicsManager;
let truckController;
let soundManager;
let keyboardState = {};

// --- Cài đặt ban đầu của Three.js ---
function setupThreeJS(renderTarget) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(-20, 15, 30); 
    camera.lookAt(new THREE.Vector3(0, 0.5, 0));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    if (!renderTarget) {
        console.error("Lỗi: Không tìm thấy phần tử 'render-target'.");
        return;
    }
    renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
    renderTarget.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.update();
    controls.enabled = false; // Tắt điều khiển camera mặc định khi bắt đầu

    // Ánh sáng cơ bản
    const ambientLight = new THREE.AmbientLight(0x404040, 5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(5, 10, 7.5).normalize();
    scene.add(directionalLight);

    // Helpers (Bỏ comment để hiển thị, hoặc xóa để loại bỏ)
    // const axesHelper = new THREE.AxesHelper(5);
    // scene.add(axesHelper);
    // const gridHelper = new THREE.GridHelper(50, 50, 0x0000ff, 0x808080);
    // scene.add(gridHelper);

    // Xử lý thay đổi kích thước cửa sổ
    window.addEventListener('resize', () => {
        const newWidth = renderTarget.clientWidth;
        const newHeight = renderTarget.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
}

// --- Hàm khởi tạo chính của ứng dụng ---
async function init() {
    const renderTarget = document.getElementById('render-target');
    setupThreeJS(renderTarget);

    // Khởi tạo SoundManager và tải âm thanh
    soundManager = new SoundManager(camera);
    await soundManager.loadSounds(); // Chờ tất cả âm thanh được tải
    soundManager.playBackgroundMusic(); // Phát nhạc nền khi game bắt đầu

    // Khởi tạo PhysicsManager
    physicsManager = new PhysicsManager(RAPIER, soundManager);
    const groundDebugMesh = await physicsManager.setupWorld();
    scene.add(groundDebugMesh); 

    // Khởi tạo SceneManager và tải các mô hình GLTF
    const sceneManager = new SceneManager(scene, physicsManager);

    // Cập nhật cách nhận các giá trị trả về từ loadAssets
    const { 
        truckMesh, 
        gltfObjectsMap, 
        truckColliderHandle,
        frontWheelLGroup, 
        frontWheelRGroup, 
        wheelLMesh,       
        wheelRMesh,       
        backWheelsMesh    
    } = await sceneManager.loadAssets();
    physicsManager.setGltfObjectsMap(gltfObjectsMap);
    
    // Khởi tạo ObjectFactory để thêm các vật thể kiểm tra
    const objectFactory = new ObjectFactory(scene, physicsManager);
    objectFactory.createTestObjects(); // Tạo các khối, trụ, cầu

    // Khởi tạo TruckController
    // TRUYỀN THAM CHIẾU BÁNH XE VÀO TRUCKCONTROLLER
    truckController = new TruckController(
        truckMesh, 
        physicsManager.getTruckRigidBody(), 
        physicsManager.getTruckColliderHandle(), 
        physicsManager,
        frontWheelLGroup,
        frontWheelRGroup,
        wheelLMesh,
        wheelRMesh,
        backWheelsMesh,
        // soundManager
    );

    // Điều khiển xe bằng bàn phím
    window.addEventListener('keydown', (event) => {
        keyboardState[event.code] = true;
        if (event.key === 'p' || event.key === 'P') {
            sceneManager.toggleDebugMode();
        }
        if (event.code === 'KeyO') {
            controls.enabled = !controls.enabled;
            // Tắt điều khiển xe khi bật OrbitControls
            if (controls.enabled) {
                truckController.resetMovement();
            }
        }
        // Thêm logic phát còi
        if (event.code === 'KeyH') {
            soundManager.playHornClickSound();
            soundManager.playHornPressSound();
        }
        // Phát âm thanh phanh khi nhấn Space
        if (event.code === 'Space') {
            const currentLinVel = physicsManager.getTruckRigidBody().linvel();
            const currentSpeed = Math.sqrt(currentLinVel.x * currentLinVel.x + currentLinVel.z * currentLinVel.z);
            if (currentSpeed > 0.1) { // Chỉ phát phanh nếu xe đang có tốc độ
                soundManager.playBrakeSound();
            }
        }
    });
    window.addEventListener('keyup', (event) => {
        keyboardState[event.code] = false;

        if (event.code === 'KeyH') {
            soundManager.stopHornPressSound();
        }
    });

    // // Thêm listener cho sự kiện va chạm vật lý để phát âm thanh
    // physicsManager.eventQueue.drainCollisionEvents = (handle1, handle2, started) => {
    //     // Gọi hàm xử lý va chạm chính của PhysicsManager
    //     physicsManager.handleCollisionEventsInternal(handle1, handle2, started);

    //     // Phát âm thanh va chạm nếu va chạm bắt đầu và là giữa xe tải và một vật thể khác
    //     if (started) {
    //         const truckColliderHandle = physicsManager.getTruckColliderHandle();
    //         if (truckColliderHandle && (handle1 === truckColliderHandle || handle2 === truckColliderHandle)) {
    //             soundManager.playCollisionSound();
    //         }
    //     }
    // };

    // Bắt đầu vòng lặp render
    animate();
}


const smoothedTruckPos = new THREE.Vector3(); // Cho camera mượt mà
function animate() {
    requestAnimationFrame(animate);

    // Cập nhật vật lý
    physicsManager.updatePhysics();

    // Cập nhật vị trí các đối tượng 3D từ vật lý
    physicsManager.updateThreeJSObjects();

    // Xử lý di chuyển xe tải
    if (!controls.enabled) {
        truckController.handleMovement(keyboardState);

        // Lấy vận tốc hiện tại của xe tải
        const currentLinVel = physicsManager.getTruckRigidBody().linvel();
        const currentSpeed = Math.sqrt(currentLinVel.x * currentLinVel.x + currentLinVel.z * currentLinVel.z);
        const truckMaxSpeed = truckController.truckSpeed * (keyboardState['KeyB'] ? 1.5 : 1); // Lấy max speed hiện tại có boost

        // Điều khiển âm thanh động cơ
        const isMoving = Math.abs(currentSpeed) > 0.1; // Ngưỡng để xác định xe đang di chuyển
        const hasMovementInput = keyboardState['ArrowUp'] || keyboardState['KeyW'] || keyboardState['ArrowDown'] || keyboardState['KeyS'];

        let volumeBoostFactor = 1;
        if (keyboardState['KeyB']) {
            volumeBoostFactor = 1.5;
        }

        if (isMoving || hasMovementInput) {
            soundManager.playEngineSound();
            // Truyền volumeBoostFactor vào hàm updateEngineVolumeAndPitch
            soundManager.updateEngineVolumeAndPitch(currentSpeed, truckMaxSpeed, volumeBoostFactor); 
        } else {
            soundManager.stopEngineSound();
        }

        // Cập nhật vị trí camera theo xe tải
        const truckPosition = physicsManager.getTruckRigidBody().translation();
        const truckPos = new THREE.Vector3(truckPosition.x, truckPosition.y, truckPosition.z);
        const cameraOffset = new THREE.Vector3(-15, 10, 20);
        const desiredCameraPos = truckPos.clone().add(cameraOffset);

        camera.position.lerp(desiredCameraPos, 0.1);
        smoothedTruckPos.lerp(truckPos, 0.1);
        camera.lookAt(smoothedTruckPos);
    } else {
        controls.update(); // Cập nhật OrbitControls
        soundManager.stopEngineSound();
    }

    renderer.render(scene, camera);
}

// Gọi hàm khởi tạo khi cửa sổ đã tải
window.onload = init;