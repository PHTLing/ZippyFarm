// --- Import các thư viện ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from 'rapier3d';

// --- Cài đặt cơ bản của Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });

const renderTarget = document.getElementById('render-target');
if (!renderTarget) {
    console.error("Lỗi: Không tìm thấy phần tử 'render-target'.");
} else {
    renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
    renderTarget.appendChild(renderer.domElement);
}

// Bật OrbitControls để gỡ lỗi hiển thị xe
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.update();
controls.enabled = true;

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0x404040, 5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(5, 10, 7.5).normalize();
scene.add(directionalLight);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

const gridHelper = new THREE.GridHelper(50, 50, 0x0000ff, 0x808080);
scene.add(gridHelper);

const debugVisuals = [];

// Khai báo truckMesh và truckRigidBody ở phạm vi global
let truckMesh;
let truckRigidBody;
let truckDebugMesh;
let truckColliderHandle = null;

const wallBlocks = [];
const cylinders = [];
const spheres = [];

// Các hằng số định nghĩa loại đối tượng trong Farm_N.glb
const TRIMESH_PARENT_NAMES = [
    'Nui_01', 'Cay01', 'Cay_02', 'Cay_03', 'CotDen'
];
const FALLABLE_OBJECT_NAMES = ['Cay01', 'Cay_02', 'Cay_03', 'CotDen'];
const STATIC_TRIMESH_NAMES = ['Nui_01'];

// Map để lưu trữ tất cả các đối tượng GLTF từ Farm_N.glb và thông tin vật lý của chúng
let gltfObjectsMap = new Map(); // Map<rigidBody.handle, {mesh: Three.js Object3D, rigidBody: RAPIER.RigidBody, debugMesh: THREE.Mesh, type: 'fallable' | 'static_trimesh' | 'static_cuboid'}>


// --- Cài đặt Rapier.js (Thư viện vật lý) ---
let world;
let eventQueue;

async function setupRapier() {
    await RAPIER.init();

    const gravity = { x: 0.0, y: -9.82, z: 0.0 };
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);

    // Mặt phẳng nền (Ground)
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(100, 0.05, 100)
                                            .setTranslation(0, -0.05, 0)
                                            .setFriction(0.9) // TĂNG MA SÁT CHO MẶT ĐẤT
                                            .setRestitution(0.2) // THÊM ĐỘ NẢY CHO MẶT ĐẤT
                                            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const groundCollider = world.createCollider(groundColliderDesc);

    // Debug visual cho mặt đất
    const groundDebug = new THREE.Mesh(
        new THREE.BoxGeometry(200, 0.1, 200),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 1.0 })
    );
    groundDebug.position.y = -0.05;
    scene.add(groundDebug);
    debugVisuals.push({
        type: 'groundDebug',
        collider: groundCollider,
        debugObject: groundDebug
    });

    // Thêm một quả cầu kiểm tra
    const testSphereRadius = 0.5;
    const testSphereGeometry = new THREE.SphereGeometry(testSphereRadius, 16, 16);
    const testSphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const testSphereMesh = new THREE.Mesh(testSphereGeometry, testSphereMaterial);
    testSphereMesh.position.set(-20, 10, 5);
    scene.add(testSphereMesh);

    const testSphereRigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                                                    .setTranslation(testSphereMesh.position.x, testSphereMesh.position.y, testSphereMesh.position.z);
    const testSphereRigidBody = world.createRigidBody(testSphereRigidBodyDesc);
    const testSphereColliderDesc = RAPIER.ColliderDesc.ball(testSphereRadius)
                                            .setFriction(0.9)
                                            .setRestitution(0.5)
                                            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(testSphereColliderDesc, testSphereRigidBody);

    debugVisuals.push({
        type: 'testSphereDebug',
        rigidBody: testSphereRigidBody,
        debugObject: testSphereMesh
    });

    // Thêm một hình cầu đỏ nhỏ tại vị trí ban đầu dự kiến của xe tải
    const helperGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const helperMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
    helperMesh.position.set(-5, 0.5, -5);
    scene.add(helperMesh);

    // --- Các đối tượng phụ trợ (khối block, trụ, cầu) ---
    const blockSize = 1;
    const wallRows = 5;
    const wallCols = 5;
    const wallStartX = -(wallCols * blockSize) / 2 - 10;
    const wallStartY = blockSize / 2;
    const wallStartZ = 30;

    for (let i = 0; i < wallRows; i++) {
        for (let j = 0; j < wallCols; j++) {
            const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            const mesh = new THREE.Mesh(geometry, material);
            const x = wallStartX + j * blockSize + blockSize / 2;
            const y = wallStartY + i * blockSize;
            const z = wallStartZ;
            mesh.position.set(x, y, z);
            scene.add(mesh);

            const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
            const rigidBody = world.createRigidBody(rigidBodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.cuboid(blockSize / 2, blockSize / 2, blockSize / 2)
                                                .setFriction(0.9) // THÊM MA SÁT
                                                .setRestitution(0.5) // THÊM ĐỘ NẢY
                                                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
            world.createCollider(colliderDesc, rigidBody);

            wallBlocks.push({ mesh, rigidBody });
        }
    }

    const objectCount = 5;

    for (let i = 0; i < objectCount; i++) {
        const radiusTop = 0.5;
        const radiusBottom = 0.5;
        const height = 1;
        const radialSegments = 16;
        const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
        const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        const mesh = new THREE.Mesh(geometry, material);
        const x = -10;
        const y = 2 + i * 1.2;
        const z = 5;
        mesh.position.set(x, y, z);
        scene.add(mesh);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
        const rigidBody = world.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radiusTop)
                                                .setFriction(0.9) // THÊM MA SÁT
                                                .setRestitution(0.5) // THÊM ĐỘ NẢY
                                                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.createCollider(colliderDesc, rigidBody);

        cylinders.push({ mesh, rigidBody });
    }

    for (let i = 0; i < objectCount; i++) {
        const radius = 0.5;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x0099ff });
        const mesh = new THREE.Mesh(geometry, material);
        const x = 20;
        const y = 2 + i * 1.2;
        const z = 5;
        mesh.position.set(x, y, z);
        scene.add(mesh);

        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
        const rigidBody = world.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                                                .setFriction(0.9) // THÊM MA SÁT
                                                .setRestitution(0.5) // THÊM ĐỘ NẢY
                                                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.createCollider(colliderDesc, rigidBody);

        spheres.push({ mesh, rigidBody });
    }

    const loader = new GLTFLoader();

    const truckLoadPromise = new Promise((resolve, reject) => {
        loader.load('assets/Truck.glb', function (gltf) {
            truckMesh = gltf.scene;
            truckMesh.scale.set(1, 1, 1);
            truckMesh.position.set(-5, 0.5, -5);
            scene.add(truckMesh);

            if (isNaN(truckMesh.quaternion.x) || isNaN(truckMesh.quaternion.y) || isNaN(truckMesh.quaternion.z) || isNaN(truckMesh.quaternion.w)) {
                console.error("Lỗi nghiêm trọng: truckMesh.quaternion là NaN, đặt lại về quaternion đơn vị.");
                truckMesh.quaternion.set(0, 0, 0, 1);
            }
            truckMesh.quaternion.normalize();

            const truckHalfExtents = new RAPIER.Vector3(1, 1, 2.6);
            const truckColliderDesc = RAPIER.ColliderDesc.cuboid(truckHalfExtents.x, truckHalfExtents.y, truckHalfExtents.z)
                                                            .setFriction(1) // TĂNG MA SÁT CHO XE TẢI
                                                            .setRestitution(0.5) // THÊM ĐỘ NẢY CHO XE TẢI
                                                            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

            const truckRigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                                                            .setTranslation(truckMesh.position.x, truckMesh.position.y, truckMesh.position.z)
                                                            .setRotation(new RAPIER.Quaternion(truckMesh.quaternion.x, truckMesh.quaternion.y, truckMesh.quaternion.z, truckMesh.quaternion.w))
                                                            .setLinearDamping(0.05) // GIỮ linearDamping THẤP để xe nảy rõ hơn
                                                            .setAngularDamping(0.2); 

            truckRigidBody = world.createRigidBody(truckRigidBodyDesc);
            const truckCollider = world.createCollider(truckColliderDesc, truckRigidBody);
            truckColliderHandle = truckCollider.handle;

            const truckDebugGeometry = new THREE.BoxGeometry(truckHalfExtents.x * 2, truckHalfExtents.y * 2, truckHalfExtents.z * 2);
            const truckDebugMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, transparent: true, opacity: 1.0 });
            truckDebugMesh = new THREE.Mesh(truckDebugGeometry, truckDebugMaterial);
            scene.add(truckDebugMesh);
            debugVisuals.push({
                type: 'truckDebug',
                rigidBody: truckRigidBody,
                collider: truckCollider,
                debugObject: truckDebugMesh
            });
            resolve();
        }, undefined, function(error) {
            console.error('Lỗi khi tải mô hình xe tải:', error);
            reject(error);
        });
    });

    const farmLoadPromise = new Promise((resolve, reject) => {
        loader.load('assets/Farm_N.glb', function (gltf) {
            const farmScene = gltf.scene;
            farmScene.position.set(0, 0, 0);
            farmScene.updateMatrixWorld(true);

            scene.add(farmScene);

            farmScene.children.forEach((parentObject) => {
                parentObject.traverse((obj) => {
                    if (obj.isMesh) {
                        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                        materials.forEach(mat => {
                            if (mat) {
                                mat.transparent = true;
                                mat.opacity = 0.4;
                                mat.needsUpdate = true;
                            }
                        });
                    }
                });

                let colliderDesc;
                let debugGeometry;
                const debugMaterial = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    transparent: true,
                    opacity: 1.0
                });

                const isTrimeshObject = TRIMESH_PARENT_NAMES.includes(parentObject.name);
                let rigidBody;
                let objectType;

                const initialWorldPosition = new THREE.Vector3();
                const initialWorldQuaternion = new THREE.Quaternion();
                parentObject.getWorldPosition(initialWorldPosition);
                parentObject.getWorldQuaternion(initialWorldQuaternion);

                if (isTrimeshObject) {
                    const meshesInGroup = [];
                    parentObject.traverse((child) => {
                        if (child.isMesh) {
                            meshesInGroup.push(child);
                        }
                    });

                    if (meshesInGroup.length === 0) {
                        console.warn(`Đối tượng cha '${parentObject.name}' là Trimesh nhưng không có mesh con nào. Bỏ qua.`);
                        return;
                    }

                    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(initialWorldPosition.x, initialWorldPosition.y, initialWorldPosition.z)
                        .setRotation(new RAPIER.Quaternion(initialWorldQuaternion.x, initialWorldQuaternion.y, initialWorldQuaternion.z, initialWorldQuaternion.w));
                    rigidBody = world.createRigidBody(rigidBodyDesc);

                    const collidersForCompound = [];
                    let combinedDebugVertices = [];
                    let combinedDebugIndices = [];
                    let debugVertexOffset = 0;

                    const rigidBodyInverseWorldMatrix = new THREE.Matrix4().compose(
                        initialWorldPosition,
                        initialWorldQuaternion,
                        new THREE.Vector3(1, 1, 1)
                    ).invert();

                    meshesInGroup.forEach(meshChild => {
                        if (!meshChild.geometry.attributes.position || !meshChild.geometry.index) {
                            return;
                        }
                        const positions = meshChild.geometry.attributes.position.array;
                        const indices = meshChild.geometry.index.array;

                        const tempPos = new THREE.Vector3();
                        const transformedLocalVertices = [];

                        for (let i = 0; i < positions.length; i += 3) {
                            tempPos.set(positions[i], positions[i + 1], positions[i + 2]);
                            tempPos.applyMatrix4(meshChild.matrixWorld);
                            tempPos.applyMatrix4(rigidBodyInverseWorldMatrix);
                            transformedLocalVertices.push(tempPos.x, tempPos.y, tempPos.z);

                            combinedDebugVertices.push(tempPos.x, tempPos.y, tempPos.z);
                        }

                        const trimeshColliderDesc = RAPIER.ColliderDesc.trimesh(
                            new Float32Array(transformedLocalVertices),
                            new Uint32Array(indices)
                        )
                        .setFriction(0.9) // TĂNG MA SÁT CHO TRIMESH
                        .setRestitution(0.2) // THÊM ĐỘ NẢY CHO TRIMESH
                        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
                        collidersForCompound.push(trimeshColliderDesc);

                        for(let i = 0; i < indices.length; i++) {
                            combinedDebugIndices.push(indices[i] + debugVertexOffset);
                        }
                        debugVertexOffset += positions.length / 3;
                    });
                    
                    collidersForCompound.forEach(cDesc => world.createCollider(cDesc, rigidBody));

                    debugGeometry = new THREE.BufferGeometry();
                    debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(combinedDebugVertices), 3));
                    debugGeometry.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(combinedDebugIndices), 1));
                    debugMaterial.color = new THREE.Color(0xffa500);
                    
                    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
                    debugMesh.position.copy(initialWorldPosition);
                    debugMesh.quaternion.copy(initialWorldQuaternion);
                    scene.add(debugMesh);
                    debugVisuals.push({
                        type: 'physicsDebug',
                        rigidBody: rigidBody,
                        collider: null, // No single collider reference for compound
                        debugObject: debugMesh
                    });

                    if (FALLABLE_OBJECT_NAMES.includes(parentObject.name)) {
                        objectType = 'fallable';
                    } else if (STATIC_TRIMESH_NAMES.includes(parentObject.name)) {
                        objectType = 'static_trimesh';
                    } else {
                        objectType = 'unknown_trimesh_static';
                    }
                    gltfObjectsMap.set(rigidBody.handle, {
                        mesh: parentObject,
                        rigidBody: rigidBody,
                        debugMesh: debugMesh,
                        type: objectType
                    });

                } else { // Đây là một đối tượng cuboid (box)
                    const boundingBox = new THREE.Box3().setFromObject(parentObject, true);
                    const size = new THREE.Vector3();
                    boundingBox.getSize(size);

                    const center = new THREE.Vector3();
                    boundingBox.getCenter(center);

                    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(center.x, center.y, center.z)
                        .setRotation(new RAPIER.Quaternion(initialWorldQuaternion.x, initialWorldQuaternion.y, initialWorldQuaternion.z, initialWorldQuaternion.w));
                    rigidBody = world.createRigidBody(rigidBodyDesc);

                    colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
                                                    .setFriction(0.9) // THÊM MA SÁT CHO CUBOID
                                                    .setRestitution(0.2) // THÊM ĐỘ NẢY CHO CUBOID
                                                    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
                    const collider = world.createCollider(colliderDesc, rigidBody);

                    debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                    debugMaterial.color = new THREE.Color(0x00ff00);
                    
                    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
                    debugMesh.position.copy(center);
                    debugMesh.quaternion.copy(initialWorldQuaternion);
                    scene.add(debugMesh);
                    debugVisuals.push({
                        type: 'physicsDebug',
                        rigidBody: rigidBody,
                        collider: collider,
                        debugObject: debugMesh
                    });

                    gltfObjectsMap.set(rigidBody.handle, {
                        mesh: parentObject,
                        rigidBody: rigidBody,
                        debugMesh: debugMesh,
                        type: 'static_cuboid'
                    });
                }
            });
            resolve();
        }, undefined, function(error) {
            console.error('Lỗi khi tải mô hình Farm_N.glb:', error);
            reject(error);
        });
    });

    try {
        await Promise.all([truckLoadPromise, farmLoadPromise]);
        controls.enabled = false;
        animate();
    } catch (error) {
        console.error("Lỗi khi tải một hoặc nhiều mô hình GLTF:", error);
    }
}

// Điều khiển xe bằng bàn phím
const keyboardState = {};
window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;
    if (event.code === 'KeyF') {
        controls.enabled = !controls.enabled;
    }
});
window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

const truckSpeed = 10;
const truckRotationSpeed = 2;
const bounceStrength = 250; // Độ mạnh của lực văng

const smoothedTruckPos = new THREE.Vector3();

// Temporary objects for calculations in animate loop to avoid re-creation
const tempMatrix4 = new THREE.Matrix4();
const tempVector3 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler(); // Thêm Euler để xử lý góc quay

// Đảm bảo hàm handleTruckMovement được định nghĩa trước khi animate gọi nó
function handleTruckMovement() {
    if (!truckRigidBody) {
        return;
    }

    const currentRotation = truckRigidBody.rotation();
    const currentQuaternion = new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuaternion);

    const currentLinVel = truckRigidBody.linvel(); // Lấy vận tốc tuyến tính hiện tại
    let newLinVelX = currentLinVel.x;
    let newLinVelZ = currentLinVel.z;
    let angVelY = 0;

    if (keyboardState['ArrowUp'] || keyboardState['KeyW']) {
        newLinVelX = -forwardVector.x * truckSpeed;
        newLinVelZ = -forwardVector.z * truckSpeed;
    } else if (keyboardState['ArrowDown'] || keyboardState['KeyS']) {
        newLinVelX = forwardVector.x * truckSpeed;
        newLinVelZ = forwardVector.z * truckSpeed;
    } else { // Nếu không có đầu vào tiến/lùi, giảm dần vận tốc ngang
        newLinVelX = currentLinVel.x * 0.9;
        newLinVelZ = currentLinVel.z * 0.9;
    }

    if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
        angVelY = truckRotationSpeed;
    } else if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
        angVelY = -truckRotationSpeed;
    }

    // Đặt vận tốc tuyến tính, GIỮ NGUYÊN vận tốc trục Y để trọng lực hoạt động
    truckRigidBody.setLinvel({ x: newLinVelX, y: currentLinVel.y, z: newLinVelZ }, true);
    truckRigidBody.setAngvel({ x: 0, y: angVelY, z: 0 }, true);

    // KỸ THUẬT CHỐNG NGHIÊNG: Buộc xe tải luôn thẳng đứng
    const truckQuat = truckRigidBody.rotation();
    tempQuaternion.set(truckQuat.x, truckQuat.y, truckQuat.z, truckQuat.w);

    tempEuler.setFromQuaternion(tempQuaternion, 'YXZ'); // YXZ để đảm bảo Yaw là trục chính
    const yaw = tempEuler.y;

    tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    truckRigidBody.setRotation(new RAPIER.Quaternion(tempQuaternion.x, tempQuaternion.y, tempQuaternion.z, tempQuaternion.w), true);
}


// --- Vòng lặp Render ---
function animate() {
    requestAnimationFrame(animate);

    if (!world) return;

    if (!controls.enabled) {
        handleTruckMovement();
    } else {
        if (truckRigidBody) {
             truckRigidBody.setLinvel(new RAPIER.Vector3(0,0,0), true);
             truckRigidBody.setAngvel(new RAPIER.Vector3(0,0,0), true);
        }
    }

    world.step(eventQueue);

    // Xử lý sự kiện va chạm
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (!started) return;

        let truckIsColliding = false;
        let otherColliderHandle = null;

        if (truckColliderHandle && (handle1 === truckColliderHandle || handle2 === truckColliderHandle)) {
            truckIsColliding = true;
            otherColliderHandle = (handle1 === truckColliderHandle) ? handle2 : handle1;
        }

        if (truckIsColliding && otherColliderHandle !== null) {
            const otherCollider = world.getCollider(otherColliderHandle);
            const otherRigidBody = otherCollider.parent(); // Lấy rigid body từ collider

            const objectInfo = gltfObjectsMap.get(otherRigidBody.handle); // Tra cứu theo rigidBody handle

            if (objectInfo) {
                const objectName = objectInfo.mesh.name;

                if (objectInfo.type === 'fallable' && otherRigidBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                    console.log(`VA CHẠM: Xe tải đâm vào '${objectName}'. Chuyển vật thể từ TĨNH sang ĐỘNG.`);
                    otherRigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                    objectInfo.debugMesh.material.color.set(0xff0000); // Đổi màu debug sang đỏ

                } else if (objectInfo.type === 'static_trimesh' || objectInfo.type === 'static_cuboid') {
                    console.log(`VA CHẠM: Xe tải đâm vào vật thể TĨNH LỚN '${objectName}'. Áp dụng lực văng.`);
                    const truckPosition = truckRigidBody.translation();
                    const otherObjectPosition = otherRigidBody.translation();

                    const bounceDirection = new RAPIER.Vector3(
                        truckPosition.x - otherObjectPosition.x,
                        0, // Bỏ qua trục Y để chỉ văng ngang
                        truckPosition.z - otherObjectPosition.z
                    );
                    bounceDirection.normalize();

                    const impulse = new RAPIER.Vector3(
                        bounceDirection.x * bounceStrength,
                        0,
                        bounceDirection.z * bounceStrength
                    );
                    truckRigidBody.applyImpulse(impulse, true);
                }
            }
        }
    });

    if (truckMesh && truckRigidBody) {
        const position = truckRigidBody.translation();
        const rotation = truckRigidBody.rotation();

        truckMesh.position.set(position.x, position.y, position.z);
        truckMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

        if (truckDebugMesh) {
            truckDebugMesh.position.copy(truckMesh.position);
            truckDebugMesh.quaternion.copy(truckMesh.quaternion);
        }

        const truckPos = new THREE.Vector3(position.x, position.y, position.z);
        const cameraOffset = new THREE.Vector3(-15, 10, 20);
        const desiredCameraPos = truckPos.clone().add(cameraOffset);

        if (!controls.enabled) {
            camera.position.lerp(desiredCameraPos, 0.1);
            smoothedTruckPos.lerp(truckPos, 0.1);
            camera.lookAt(smoothedTruckPos);
        } else {
            controls.update();
        }
    }

    // Đồng bộ vị trí và góc quay của TẤT CẢ debug meshes
    debugVisuals.forEach(item => {
        if (item.rigidBody) {
            const position = item.rigidBody.translation();
            const rotation = item.rigidBody.rotation();
            item.debugObject.position.set(position.x, position.y, position.z);
            item.debugObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        } else if (item.collider) { 
            const position = item.collider.translation();
            const rotation = item.collider.rotation();
            item.debugObject.position.set(position.x, position.y, position.z);
            item.debugObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    });

    // Cập nhật vị trí và góc quay cho các khối tường, trụ, cầu (luôn là dynamic)
    wallBlocks.forEach(block => {
        const position = block.rigidBody.translation();
        const rotation = block.rigidBody.rotation();
        block.mesh.position.set(position.x, position.y, position.z);
        block.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    cylinders.forEach(obj => {
        const position = obj.rigidBody.translation();
        const rotation = obj.rigidBody.rotation();
        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    spheres.forEach(obj => {
        const position = obj.rigidBody.translation();
        const rotation = obj.rigidBody.rotation();
        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    // QUAN TRỌNG: Đồng bộ vị trí và góc quay cho các ĐỐI TƯỢNG 3D GLTF thực tế
    gltfObjectsMap.forEach(item => {
        // CHỈ cập nhật mesh nếu rigid body là DYNAMIC
        if (item.rigidBody.bodyType() === RAPIER.RigidBodyType.Dynamic) {
            const rigidBodyWorldPosition = item.rigidBody.translation();
            const rigidBodyWorldQuaternion = new THREE.Quaternion(
                item.rigidBody.rotation().x,
                item.rigidBody.rotation().y,
                item.rigidBody.rotation().z,
                item.rigidBody.rotation().w
            );

            const parent = item.mesh.parent;
            parent.updateMatrixWorld(true);
            
            tempMatrix4.copy(parent.matrixWorld).invert();
            
            tempVector3.set(rigidBodyWorldPosition.x, rigidBodyWorldPosition.y, rigidBodyWorldPosition.z);
            tempVector3.applyMatrix4(tempMatrix4);
            item.mesh.position.copy(tempVector3);

            parent.getWorldQuaternion(tempQuaternion);
            tempQuaternion.invert();
            tempQuaternion.multiply(rigidBodyWorldQuaternion);
            item.mesh.quaternion.copy(tempQuaternion);
        }
    });

    camera.far = 5000;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}

// Điều chỉnh camera ban đầu
camera.position.set(-20, 15, 30);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Xử lý thay đổi kích thước cửa sổ
window.addEventListener('resize', () => {
    const newWidth = renderTarget.clientWidth;
    const newHeight = renderTarget.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

// Gọi hàm khởi tạo Rapier sau khi cửa sổ đã tải
window.onload = function () {
    setupRapier();
}
