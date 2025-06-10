// src/main_02.js

// --- Import các thư viện sử dụng importmap ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from 'rapier3d'; // Dùng * as RAPIER với bản compat

// --- Cài đặt cơ bản của Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa); // Nền màu xám nhạt

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });

const renderTarget = document.getElementById('render-target');
if (!renderTarget) {
    console.error("Lỗi: Không tìm thấy phần tử 'render-target'.");
} else {
    renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
    renderTarget.appendChild(renderer.domElement);
}

// Bật OrbitControls TẠM THỜI để gỡ lỗi hiển thị xe
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0); // Camera nhìn vào gốc tọa độ hoặc vị trí xe
controls.update();
controls.enabled = true; // Tạm thời BẬT OrbitControls để có thể di chuyển camera bằng chuột

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0x404040, 5); // Ánh sáng môi trường tổng thể
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 3); // Ánh sáng định hướng (giống mặt trời)
directionalLight.position.set(5, 10, 7.5).normalize();
scene.add(directionalLight);

const axesHelper = new THREE.AxesHelper(5); // Tham số là độ dài trục
scene.add(axesHelper); // Thêm AxesHelper vào scene để dễ debug

// Thêm lưới sàn để dễ định hướng
const gridHelper = new THREE.GridHelper(50, 50, 0x0000ff, 0x808080); // Kích thước 50x50, màu xanh cho trục Z, màu xám cho các đường khác
scene.add(gridHelper);
console.log("Đã thêm GridHelper.");

const debugVisuals = [];

// Khai báo truckMesh và truckRigidBody ở phạm vi global
let truckMesh;
let truckRigidBody;
let truckDebugMesh; // Thêm biến cho debug mesh của xe tải

// Khai báo các mảng đối tượng phụ trợ ở phạm vi global
const wallBlocks = [];
const cylinders = [];
const spheres = [];

// --- Cài đặt Rapier.js (Thư viện vật lý) ---
let world;
let eventQueue; // Để nhận sự kiện va chạm

// Hàm khởi tạo Rapier và các đối tượng vật lý
async function setupRapier() {
    // Khởi tạo Rapier WASM module
    // Cảnh báo: "using deprecated parameters" là bình thường với bản compat, không phải lỗi
    await RAPIER.init();

    // Tạo thế giới vật lý Rapier
    const gravity = { x: 0.0, y: -9.82, z: 0.0 };
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true); // `true` để auto-drain

    console.log("Rapier world initialized!");

    // Mặt phẳng nền (Ground)
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    // Thêm mặt phẳng nền vào thế giới vật lý Rapier
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(100, 0.05, 100) // Rất mỏng để mô phỏng mặt phẳng
                                                   .setTranslation(0, -0.05, 0); // Đặt hơi thấp hơn mặt đất Three.js
    const groundCollider = world.createCollider(groundColliderDesc);

    // Debug visual cho mặt đất (có thể dùng BoxGeometry mỏng)
    const groundDebug = new THREE.Mesh(
        new THREE.BoxGeometry(200, 0.1, 200),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.5 })
    );
    groundDebug.position.y = -0.05;
    scene.add(groundDebug);
    debugVisuals.push({
        type: 'physicsMarker',
        collider: groundCollider, // Rapier dùng Collider
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
    const testSphereColliderDesc = RAPIER.ColliderDesc.ball(testSphereRadius);
    world.createCollider(testSphereColliderDesc, testSphereRigidBody);

    debugVisuals.push({
        type: 'testSphereDebug',
        rigidBody: testSphereRigidBody,
        debugObject: testSphereMesh
    });

    // Thêm một hình cầu đỏ nhỏ tại vị trí ban đầu dự kiến của xe tải để kiểm tra vị trí
    const helperGeometry = new THREE.SphereGeometry(0.2, 8, 8); // Hình cầu nhỏ
    const helperMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Màu đỏ
    const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
    helperMesh.position.set(-5, 0.5, -5); // Đặt tại vị trí ban đầu của xe tải
    scene.add(helperMesh);
    console.log("Đã thêm helperMesh tại vị trí ban đầu của xe tải: (-5, 0.5, -5).");

    // --- Các đối tượng phụ trợ (khối block, trụ, cầu) ---
    const blockSize = 1;
    const blockMass = 5;
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
            const colliderDesc = RAPIER.ColliderDesc.cuboid(blockSize / 2, blockSize / 2, blockSize / 2);
            world.createCollider(colliderDesc, rigidBody);

            wallBlocks.push({ mesh, rigidBody });
        }
    }
    console.log("Đã tạo và thêm các khối tường.");

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
        // Rapier Cylinder có half-height, không phải full height như Three.js
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radiusTop);
        world.createCollider(colliderDesc, rigidBody);

        cylinders.push({ mesh, rigidBody });
    }
    console.log("Đã tạo và thêm các trụ.");

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
        const colliderDesc = RAPIER.ColliderDesc.ball(radius);
        world.createCollider(colliderDesc, rigidBody);

        spheres.push({ mesh, rigidBody });
    }
    console.log("Đã tạo và thêm các cầu.");

    const loader = new GLTFLoader();

    // Sử dụng Promise.all để tải cả hai mô hình GLTF và chờ chúng hoàn thành
    const truckLoadPromise = new Promise((resolve, reject) => {
        loader.load('assets/Truck.glb', function (gltf) {
            truckMesh = gltf.scene;
            // Thay đổi scale xe tải thành 1
            truckMesh.scale.set(1, 1, 1);
            truckMesh.position.set(-5, 0.5, -5); // Vị trí ban đầu của xe
            scene.add(truckMesh);

            // --- QUAN TRỌNG: DEBUG VÀ KHẮC PHỤC NaN TRONG QUATERNION BAN ĐẦU ---
            console.log("THREE.js truckMesh.quaternion before Rapier assignment:", truckMesh.quaternion.x.toFixed(4), truckMesh.quaternion.y.toFixed(4), truckMesh.quaternion.z.toFixed(4), truckMesh.quaternion.w.toFixed(4));
            if (isNaN(truckMesh.quaternion.x) || isNaN(truckMesh.quaternion.y) || isNaN(truckMesh.quaternion.z) || isNaN(truckMesh.quaternion.w)) {
                console.error("CRITICAL: truckMesh.quaternion is NaN before Rapier assignment. Resetting to identity.");
                truckMesh.quaternion.set(0, 0, 0, 1); // Đặt về quaternion đơn vị nếu có NaN
            }
            truckMesh.quaternion.normalize(); // Đảm bảo đã chuẩn hóa, để tránh lỗi số học nhỏ

            // TẠO RIGIDBODY CHO XE TẢI LÀ DYNAMIC() THAY VÌ KINEMATICPOSITIONBASED()
            // Điều chỉnh kích thước collider cho phù hợp với scale = 1
            // Giả định kích thước ban đầu của xe là 1x1x2 (rộng x cao x dài)
            // Vậy half extents khi scale 1 sẽ là (0.5, 0.5, 1)
            const truckHalfExtents = new RAPIER.Vector3(1, 1, 2.6);
            const truckColliderDesc = RAPIER.ColliderDesc.cuboid(truckHalfExtents.x, truckHalfExtents.y, truckHalfExtents.z);

            const truckRigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
                                                            .setTranslation(truckMesh.position.x, truckMesh.position.y, truckMesh.position.z)
                                                            // Truyền đối tượng RAPIER.Quaternion tường minh
                                                            .setRotation(new RAPIER.Quaternion(truckMesh.quaternion.x, truckMesh.quaternion.y, truckMesh.quaternion.z, truckMesh.quaternion.w))
                                                            .setLinearDamping(0.8) // Tăng giảm xóc tuyến tính
                                                            .setAngularDamping(0); // Tăng giảm xóc góc để giảm nghiêng

            // TÙY CHỌN: Nếu bạn muốn xe không bao giờ bị lật, hãy bỏ comment dòng dưới đây:
            // truckRigidBodyDesc.lockRotations(true, false, true, true); // Khóa quay trên trục X và Z

            truckRigidBody = world.createRigidBody(truckRigidBodyDesc);
            world.createCollider(truckColliderDesc, truckRigidBody); // Gán collider vào rigid body
            console.log("Rapier truckRigidBody created. Its rotation immediately after creation:", truckRigidBody.rotation().x.toFixed(4), truckRigidBody.rotation().y.toFixed(4), truckRigidBody.rotation().z.toFixed(4), truckRigidBody.rotation().w.toFixed(4));
            // --- KẾT THÚC DEBUGGING QUATERNION ---

            // TẠO DEBUG MESH CHO XE TẢI
            const truckDebugGeometry = new THREE.BoxGeometry(truckHalfExtents.x * 2, truckHalfExtents.y * 2, truckHalfExtents.z * 2);
            const truckDebugMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, transparent: true, opacity: 0.8 });
            truckDebugMesh = new THREE.Mesh(truckDebugGeometry, truckDebugMaterial);
            scene.add(truckDebugMesh);
            debugVisuals.push({
                type: 'truckDebug',
                rigidBody: truckRigidBody,
                debugObject: truckDebugMesh
            });
            console.log("Đã tạo debug mesh cho xe tải.");
            
            console.log("Mô hình Truck.glb đã tải xong và RigidBody của xe tải đã được tạo.");
            resolve(); // Đánh dấu promise đã hoàn thành
        }, undefined, function(error) {
            console.error('Lỗi khi tải mô hình xe tải:', error);
            reject(error); // Báo lỗi nếu tải thất bại
        });
    });

    const farmLoadPromise = new Promise((resolve, reject) => {
        const TRIMESH_PARENT_NAMES = [
            'Nui_01', 'Cay01', 'Cay_02', 'Cay_03', 'CotDen'
        ];
        loader.load('assets/Farm_N.glb', function (gltf) {
            const farmScene = gltf.scene;
            farmScene.position.set(0, 0, 0);
            farmScene.updateMatrixWorld(true); // RẤT QUAN TRỌNG

            scene.add(farmScene);

            console.log("--- Bắt đầu xử lý vật lý cho các đối tượng cha trong Farm_N.glb ---");

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

                console.log('Đang xử lý đối tượng cha:', parentObject.name || '(Không tên)');

                let colliderDesc;
                let debugGeometry;
                const debugMaterial = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7
                });
                let debugMeshPosition = new THREE.Vector3(); // Biến tạm để lưu vị trí debug mesh

                if (TRIMESH_PARENT_NAMES.includes(parentObject.name)) {
                    // --- TẠO MESH COLLIDER cho đối tượng cha (và tất cả mesh con của nó) ---
                    const collectedWorldVertices = [];
                    const collectedIndices = [];
                    let vertexOffset = 0;

                    parentObject.traverse((child) => {
                        if (child.isMesh) {
                            const geometry = child.geometry;
                            if (!geometry.attributes.position || !geometry.index) {
                                console.warn(`Mesh ${child.name} trong nhóm ${parentObject.name} không có dữ liệu đỉnh hoặc chỉ số, bỏ qua.`);
                                return;
                            }

                            const positions = geometry.attributes.position.array;
                            const indices = geometry.index.array;

                            const tempVector = new THREE.Vector3();
                            for (let i = 0; i < positions.length; i += 3) {
                                tempVector.set(positions[i], positions[i + 1], positions[i + 2]);
                                tempVector.applyMatrix4(child.matrixWorld);
                                collectedWorldVertices.push(tempVector.x, tempVector.y, tempVector.z);
                            }

                            for (let i = 0; i < indices.length; i++) {
                                collectedIndices.push(indices[i] + vertexOffset);
                            }
                            vertexOffset += positions.length / 3;
                        }
                    });

                    if (collectedWorldVertices.length === 0 || collectedIndices.length === 0) {
                        console.warn(`Không đủ dữ liệu (vertices/indices) để tạo Mesh Collider cho đối tượng cha: ${parentObject.name}.`);
                        return;
                    }

                    // Chuyển đổi Float32Array sang Float32Array cho Rapier
                    const vertices = new Float32Array(collectedWorldVertices);
                    const indices = new Uint32Array(collectedIndices);

                    colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)
                                                       .setTranslation(0, 0, 0); // Vị trí đã ở tọa độ thế giới

                    debugGeometry = new THREE.BufferGeometry();
                    debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(collectedWorldVertices, 3));
                    debugGeometry.setIndex(new THREE.Uint32BufferAttribute(collectedIndices, 1));
                    debugMaterial.color = new THREE.Color(0xffa500); // Màu cam cho Mesh Collider (Trimesh)
                    console.log(`  -> Đã tạo Mesh Collider (Trimesh) cho đối tượng cha: ${parentObject.name}`);

                    debugMeshPosition.set(0,0,0); // Nó đã ở đúng vị trí
                } else {
                    // --- TẠO CUBIOD COLLIDER (BOX) cho đối tượng cha ---
                    const boundingBox = new THREE.Box3().setFromObject(parentObject, true);
                    const size = new THREE.Vector3();
                    boundingBox.getSize(size);

                    const center = new THREE.Vector3();
                    boundingBox.getCenter(center);

                    colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
                                                       .setTranslation(center.x, center.y, center.z);

                    debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                    debugMaterial.color = new THREE.Color(0x00ff00); // Màu xanh lá cây cho Cuboid (Box)
                    console.log(`  -> Đã tạo Cuboid Collider (Box) cho đối tượng cha: ${parentObject.name}`);

                    debugMeshPosition.copy(center); // Gán vị trí debug mesh
                }

                if (colliderDesc) {
                    const collider = world.createCollider(colliderDesc); // Tạo collider tĩnh
                    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
                    debugMesh.position.copy(debugMeshPosition); // Áp dụng vị trí đã tính
                    scene.add(debugMesh);

                    debugVisuals.push({
                        type: 'physicsDebug',
                        collider: collider,
                        debugObject: debugMesh
                    });
                }
            });

            console.log("--- Kết thúc xử lý vật lý Farm ---");
            resolve(); // Đánh dấu promise đã hoàn thành
        }, undefined, function(error) {
            console.error('Lỗi khi tải mô hình Farm_N.glb:', error);
            reject(error); // Báo lỗi nếu tải thất bại
        });
    });

    // Chờ cả hai Promise tải GLTF hoàn thành trước khi bắt đầu vòng lặp animate
    try {
        await Promise.all([truckLoadPromise, farmLoadPromise]);
        console.log("Cả Truck.glb và Farm_N.glb đã tải xong. Bắt đầu vòng lặp animation.");
        // Khi tất cả đã tải, camera ban đầu sẽ được điều chỉnh để nhìn vào xe tải
        // VÀ OrbitControls sẽ được TẮT để logic điều khiển xe tải bắt đầu hoạt động.
        controls.enabled = false; // Tắt OrbitControls sau khi tải xong để xe tải có thể điều khiển
        animate(); // Bắt đầu vòng lặp animate chỉ sau khi cả hai đã tải
    } catch (error) {
        console.error("Lỗi khi tải một hoặc nhiều mô hình GLTF:", error);
    }
}

// Điều khiển xe bằng bàn phím
const keyboardState = {};
window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;
    if (event.code === 'KeyF') { // Thêm phím F để bật/tắt OrbitControls
        controls.enabled = !controls.enabled;
        console.log("OrbitControls enabled:", controls.enabled);
    }
});
window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

// Giảm tốc độ để dễ debug hơn (điều chỉnh sau khi va chạm hoạt động)
const truckSpeed = 10; // Tốc độ di chuyển tuyến tính
const truckRotationSpeed = 2; // Tốc độ quay của xe

const smoothedTruckPos = new THREE.Vector3();

function handleTruckMovement() {
    // Đảm bảo truckRigidBody đã được khởi tạo trước khi sử dụng
    if (!truckRigidBody) {
        return;
    }

    // Lấy quaternion hiện tại của xe tải để xác định hướng forward
    const currentRotation = truckRigidBody.rotation(); // Rapier returns RAPIER.Quaternion
    const currentQuaternion = new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuaternion); // Hướng về phía trước của xe

    let linVel = new RAPIER.Vector3(0, 0, 0);
    let angVelY = 0;

    if (keyboardState['ArrowUp'] || keyboardState['KeyW']) {
        linVel.x = -forwardVector.x * truckSpeed;
        linVel.z = -forwardVector.z * truckSpeed;
    } else if (keyboardState['ArrowDown'] || keyboardState['KeyS']) {
        linVel.x = forwardVector.x * truckSpeed;
        linVel.z = forwardVector.z * truckSpeed;
    }

    if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
        angVelY = truckRotationSpeed;
    } else if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
        angVelY = -truckRotationSpeed;
    }

    // --- Debugging logs ---
    // console.log("--- Truck Movement Debug ---"); // Bỏ comment để xem lại log
    // console.log("Current Truck Pos (Rapier):", truckRigidBody.translation().x.toFixed(2), truckRigidBody.translation().y.toFixed(2), truckRigidBody.translation().z.toFixed(2));
    // console.log("Current Truck Rotation (Rapier):", currentRotation.x.toFixed(4), currentRotation.y.toFixed(4), currentRotation.z.toFixed(4), currentRotation.w.toFixed(4));
    // console.log("Forward Vector (calculated):", forwardVector.x.toFixed(4), forwardVector.y.toFixed(4), forwardVector.z.toFixed(4));
    // console.log("Linear Velocity (calculated):", linVel.x.toFixed(4), linVel.z.toFixed(4));
    // console.log("Angular Velocity Y (calculated):", angVelY.toFixed(4));

    // Kiểm tra NaN trong các giá trị quan trọng
    if (isNaN(linVel.x) || isNaN(linVel.z) ||
        isNaN(currentRotation.x) || isNaN(currentRotation.y) || isNaN(currentRotation.z) || isNaN(currentRotation.w)) {
        console.error("Lỗi: Giá trị NaN được phát hiện trong vận tốc hoặc rotation của xe tải! Đặt lại...");
        console.log("Current Rotation (debug):", currentRotation);
        console.log("Forward Vector (debug):", forwardVector);
        // Cố gắng đặt lại rotation về một giá trị hợp lệ để thoát khỏi trạng thái NaN
        truckRigidBody.setRotation(new RAPIER.Quaternion(0, 0, 0, 1), true); // Áp dụng ngay lập tức
        truckRigidBody.setLinvel(new RAPIER.Vector3(0,0,0), true); // Dừng xe
        truckRigidBody.setAngvel(new RAPIER.Vector3(0,0,0), true); // Dừng quay
        return; // Dừng xử lý chuyển động để tránh lan truyền NaN
    }
    // --- End Debugging logs ---

    // Đặt vận tốc cho dynamic body
    truckRigidBody.setLinvel(linVel, true); // true để đánh thức body
    truckRigidBody.setAngvel({ x: 0, y: angVelY, z: 0 }, true); // true để đánh thức body
}


// --- Vòng lặp Render ---
const timeStep = 1 / 60; // Bước thời gian vật lý
function animate() {
    requestAnimationFrame(animate);

    if (!world) return; // Đảm bảo thế giới Rapier đã được khởi tạo

    // Chỉ xử lý chuyển động xe nếu OrbitControls đã tắt
    if (!controls.enabled) { // Nếu OrbitControls đang tắt, tức là bạn muốn điều khiển xe
        handleTruckMovement();
    } else { // Nếu OrbitControls đang bật, reset vận tốc xe để tránh tự di chuyển
        if (truckRigidBody) { // Chỉ làm điều này nếu truckRigidBody tồn tại
             truckRigidBody.setLinvel(new RAPIER.Vector3(0,0,0), true);
             truckRigidBody.setAngvel(new RAPIER.Vector3(0,0,0), true);
        }
    }

    world.step(eventQueue); // Cập nhật thế giới vật lý với eventQueue

    // Xử lý sự kiện va chạm (nếu cần)
    // eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    //     // Lấy collider từ handle
    //     const collider1 = world.getCollider(handle1);
    //     const collider2 = world.getCollider(handle2);
    //     // console.log(`Collision between ${collider1.handle} and ${collider2.handle} ${started ? 'started' : 'ended'}`);
    // });


    if (truckMesh && truckRigidBody) {
        const position = truckRigidBody.translation();
        const rotation = truckRigidBody.rotation();

        truckMesh.position.set(position.x, position.y, position.z);
        truckMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

        // Đồng bộ vị trí và góc quay của debug mesh của xe tải
        if (truckDebugMesh) {
            truckDebugMesh.position.copy(truckMesh.position);
            truckDebugMesh.quaternion.copy(truckMesh.quaternion);
        }

        const truckPos = new THREE.Vector3(position.x, position.y, position.z);
        const cameraOffset = new THREE.Vector3(-15, 10, 20); // Điều chỉnh offset camera
        const desiredCameraPos = truckPos.clone().add(cameraOffset);

        // Chỉ cập nhật camera theo xe nếu OrbitControls đã tắt
        if (!controls.enabled) {
            camera.position.lerp(desiredCameraPos, 0.1); // Chuyển động mượt mà
            smoothedTruckPos.lerp(truckPos, 0.1); // Điều chỉnh 0.1 cho độ mượt
            camera.lookAt(smoothedTruckPos); // Camera luôn nhìn vào vị trí mượt của xe
        } else {
            // Khi OrbitControls bật, điều khiển camera bằng chuột
            controls.update();
        }
    }

    // Đồng bộ vị trí và góc quay của các debug meshes khác
    debugVisuals.forEach(item => {
        // Static colliders (Farm, ground)
        if (item.collider && !item.rigidBody) { // Nếu là collider tĩnh (không có rigidBody cha)
            const position = item.collider.translation();
            const rotation = item.collider.rotation();
            item.debugObject.position.set(position.x, position.y, position.z);
            item.debugObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        } else if (item.rigidBody) { // Dynamic rigid bodies
            const position = item.rigidBody.translation();
            const rotation = item.rigidBody.rotation();
            item.debugObject.position.set(position.x, position.y, position.z);
            item.debugObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    });

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

    // Tăng tầm nhìn xa của camera để dễ dàng nhìn thấy các đối tượng di chuyển nhanh
    camera.far = 5000;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}


// Điều chỉnh camera ban đầu
// Camera được đặt ở vị trí nhìn tổng quan toàn cảnh
camera.position.set(-20, 15, 30);
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Nhìn vào gốc tọa độ

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
