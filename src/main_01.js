// src/main.js

// --- Import các thư viện sử dụng importmap ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Thêm OrbitControls để debug
import * as CANNON from 'cannon-es';

// --- Cài đặt cơ bản của Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa); // Nền màu xám nhạt

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });

const renderTarget = document.getElementById('render-target');
if (!renderTarget) {
    console.error("Lỗi: Không tìm thấy phần tử 'render-target'.");
    // Thoát hoặc xử lý lỗi nếu không tìm thấy div
} else {
    renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
    renderTarget.appendChild(renderer.domElement);
}

// Controls (Điều khiển camera) - Thêm OrbitControls để debug cảnh quan khi cần
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0); // Camera nhìn vào gốc tọa độ
controls.update();
controls.enabled = false; // Tắt OrbitControls mặc định để camera theo xe, bật lại khi debug

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0x404040, 5); // Ánh sáng môi trường tổng thể
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 3); // Ánh sáng định hướng (giống mặt trời)
directionalLight.position.set(5, 10, 7.5).normalize();
scene.add(directionalLight);

const axesHelper = new THREE.AxesHelper(5); // Tham số là độ dài trục
scene.add(axesHelper); // Thêm AxesHelper vào scene để dễ debug

// Mảng để lưu trữ các đối tượng gỡ lỗi vật lý (debug visuals)
const debugVisuals = [];

// --- Cài đặt Cannon-es (Thư viện vật lý) ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Đặt trọng lực (trọng lực chuẩn của Trái đất)
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 100; // Tăng solver iterations để cải thiện ổn định và tương tác Trimesh

// Định nghĩa vật liệu tiếp xúc mặc định cho Cannon.js
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.9,
        restitution: 0.05, // Giảm độ nảy để tránh jitter và cải thiện va chạm
        contactEquationRelaxation: 3,
        frictionEquationRelaxation: 3
    }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial; // Đặt làm vật liệu tiếp xúc mặc định

// Mặt phẳng nền (Ground) - Đã có trong code của bạn
const groundGeometry = new THREE.PlaneGeometry(200, 200); // Tăng kích thước mặt đất
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2; // Đổi lại thành -Math.PI / 2 để khớp với mặt phẳng Cannon
scene.add(groundMesh);

// Thêm mặt phẳng nền vào thế giới vật lý - Đã có trong code của bạn
const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Tạo hình ảnh gỡ lỗi cho mặt đất (hộp dây màu xanh ngọc)
const groundDebug = new THREE.Mesh(
    new THREE.BoxGeometry(200, 0.1, 200), // Kích thước của debug box khớp với groundMesh
    new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.5 })
);
groundDebug.position.y = -0.05; // Điều chỉnh vị trí debug box nếu cần
scene.add(groundDebug);
debugVisuals.push({
    type: 'physicsMarker', // Loại này để biết đây là dấu hiệu của vật thể vật lý
    physicsBody: groundBody,
    debugObject: groundDebug
});

// --- Thêm một quả cầu kiểm tra để verify Trimesh collisions ---
const testSphereRadius = 0.5;
const testSphereGeometry = new THREE.SphereGeometry(testSphereRadius, 16, 16);
const testSphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Màu xanh lá cây để dễ thấy
const testSphereMesh = new THREE.Mesh(testSphereGeometry, testSphereMaterial);
// Đặt vị trí để nó rơi vào một trong các đối tượng Trimesh của bạn (ví dụ: Nui_01 nằm gần 0,0,0)
testSphereMesh.position.set(-20, 10, 5); 
scene.add(testSphereMesh);

const testSphereShape = new CANNON.Sphere(testSphereRadius);
const testSphereBody = new CANNON.Body({
    mass: 1, // Vật thể động
    position: new CANNON.Vec3(testSphereMesh.position.x, testSphereMesh.position.y, testSphereMesh.position.z),
    shape: testSphereShape,
    linearDamping: 0.1,
    angularDamping: 0.1
});
world.addBody(testSphereBody);
debugVisuals.push({ // Thêm quả cầu kiểm tra vào debugVisuals để nó tự cập nhật vị trí
    type: 'testSphereDebug',
    physicsBody: testSphereBody,
    debugObject: testSphereMesh
});


// --- 1. Điều khiển chiếc xe (truck.glb) ---
let truckMesh;
let truckBody;
const loader = new GLTFLoader();

loader.load('assets/models/Truck.glb', function (gltf) {
    truckMesh = gltf.scene;
    truckMesh.scale.set(0.5, 0.5, 0.5);
    truckMesh.position.set(-5, 0.5, -5); // Đặt xe ở vị trí ban đầu
    scene.add(truckMesh);

    const truckShape = new CANNON.Box(new CANNON.Vec3(0.5 * 0.5, 0.5 * 0.5, 1 * 0.5)); // Kích thước body vật lý của xe (tỷ lệ với mesh)
    truckBody = new CANNON.Body({
        mass: 100,
        position: new CANNON.Vec3(truckMesh.position.x, truckMesh.position.y, truckMesh.position.z),
        shape: truckShape,
        material: defaultMaterial // Gán vật liệu mặc định cho xe tải
    });
    truckBody.allowSleep = false;

    // Khóa chuyển động Y để xe luôn ở trên mặt phẳng và không bị "bay" hoặc "giật"
    truckBody.linearFactor.set(1, 1, 1);
    truckBody.angularFactor.set(0, 1, 0); // Chỉ quay quanh trục Y

    world.addBody(truckBody);

    truckBody.addEventListener('collide', (e) => {
        // console.log('Truck collided with:', e.body);
    });
}, undefined, function (error) {
    console.error('Lỗi khi tải mô hình xe tải:', error);
});


// --- 2. Tải mô hình Farm_N.glb và xử lý tương tác vật lý tối ưu ---

// Danh sách tên các đối tượng cha sẽ sử dụng Trimesh (hình dạng va chạm chi tiết)
const TRIMESH_PARENT_NAMES = [
    'Nui_01', 'Cay01', 'Cay_02', 'Cay_03', 'CotDen'
];

loader.load('assets/models/Farm_N.glb', function (gltf) {
    const farmScene = gltf.scene;
    // Cần cập nhật ma trận thế giới của farmScene và tất cả các đối tượng con
    // Đảm bảo farmScene ở vị trí 0,0,0 nếu không có ý định dịch chuyển nó
    farmScene.position.set(0, 0, 0);
    // RẤT QUAN TRỌNG: Cập nhật ma trận thế giới cho toàn bộ farmScene và tất cả các đối tượng con của nó.
    // Điều này đảm bảo object.matrixWorld của mỗi mesh là chính xác
    // khi chúng ta thu thập đỉnh trong hệ tọa độ thế giới.
    farmScene.updateMatrixWorld(true);

    scene.add(farmScene);
    // camera.lookAt(farmScene.position); // Không cần camera.lookAt ở đây nữa, do camera theo xe

    console.log("--- Bắt đầu xử lý vật lý cho các đối tượng cha trong Farm_N.glb ---");

    // Duyệt qua các ĐỐI TƯỢNG CON TRỰC TIẾP của farmScene (đây là các "đối tượng cha" của bạn)
    farmScene.children.forEach((parentObject) => {
        // Làm cho mô hình GLB gốc trong suốt để nhìn thấy Trimesh/Box debug bên trong
        parentObject.traverse((obj) => {
            if (obj.isMesh) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(mat => {
                    if (mat) { // Kiểm tra nếu material tồn tại
                        mat.transparent = true;
                        mat.opacity = 0.4; // Đặt độ mờ cho mô hình gốc
                        mat.needsUpdate = true; // Đảm bảo vật liệu được cập nhật
                    }
                });
            }
        });

        console.log('Đang xử lý đối tượng cha:', parentObject.name || '(Không tên)');

        let physicsBody;
        let debugGeometry;
        const debugMaterial = new THREE.MeshBasicMaterial({
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });

        // --- Lựa chọn tạo Trimesh hay Box dựa trên tên đối tượng cha ---
        if (TRIMESH_PARENT_NAMES.includes(parentObject.name)) {
            // --- TẠO TRIMESH cho đối tượng cha (và tất cả mesh con của nó) ---
            const collectedWorldVertices = [];
            const collectedIndices = [];
            let vertexOffset = 0; // Theo dõi số lượng đỉnh để bù đắp chỉ số

            // Duyệt qua đối tượng cha và tất cả các đối tượng con của nó để thu thập dữ liệu mesh
            parentObject.traverse((child) => {
                if (child.isMesh) {
                    const geometry = child.geometry;
                    // Đảm bảo geometry có các thuộc tính cần thiết
                    if (!geometry.attributes.position || !geometry.index) {
                        console.warn(`Mesh ${child.name} trong nhóm ${parentObject.name} không có dữ liệu đỉnh hoặc chỉ số, bỏ qua.`);
                        return;
                    }

                    const positions = geometry.attributes.position.array;
                    const indices = geometry.index.array;

                    const tempVector = new THREE.Vector3();
                    for (let i = 0; i < positions.length; i += 3) {
                        tempVector.set(positions[i], positions[i + 1], positions[i + 2]);
                        // Áp dụng ma trận thế giới của đối tượng con để biến đổi đỉnh cục bộ sang thế giới
                        tempVector.applyMatrix4(child.matrixWorld);
                        collectedWorldVertices.push(tempVector.x, tempVector.y, tempVector.z);
                    }

                    // Điều chỉnh chỉ số để khớp với mảng collectedWorldVertices
                    for (let i = 0; i < indices.length; i++) {
                        collectedIndices.push(indices[i] + vertexOffset);
                    }
                    vertexOffset += positions.length / 3; // Cập nhật bù đắp đỉnh
                }
            });

            if (collectedWorldVertices.length === 0 || collectedIndices.length === 0) {
                console.warn(`Không đủ dữ liệu (vertices/indices) để tạo Trimesh cho đối tượng cha: ${parentObject.name}.`);
                return; // Bỏ qua nếu không có hình học hợp lệ được tìm thấy
            }

            const trimeshShape = new CANNON.Trimesh(collectedWorldVertices, collectedIndices);
            physicsBody = new CANNON.Body({ mass: 0, material: defaultMaterial }); // Vật thể tĩnh, gán vật liệu
            physicsBody.addShape(trimeshShape);

            // Vì Trimesh đã được tạo bằng các đỉnh trong hệ tọa độ thế giới,
            // vật thể vật lý được đặt tại gốc (0,0,0) và không xoay.
            physicsBody.position.set(0, 0, 0);
            physicsBody.quaternion.set(0, 0, 0, 1); // Cannon.js identity quaternion

            debugGeometry = new THREE.BufferGeometry();
            debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(collectedWorldVertices, 3));
            debugGeometry.setIndex(new THREE.Uint32BufferAttribute(collectedIndices, 1));
            debugMaterial.color = new THREE.Color(0xffa500); // Màu cam cho Trimesh
            console.log(`  -> Đã tạo Trimesh cho đối tượng cha: ${parentObject.name}`);

        } else {
            // --- TẠO BOX cho đối tượng cha (bao gồm tất cả mesh con của nó) ---

            // Tính toán hộp bao quanh bao gồm toàn bộ đối tượng cha và tất cả các đối tượng con của nó.
            const boundingBox = new THREE.Box3().setFromObject(parentObject, true);
            const size = new THREE.Vector3();
            boundingBox.getSize(size); // Kích thước của hộp bao quanh tổng thể

            const center = new THREE.Vector3();
            boundingBox.getCenter(center); // Tâm của hộp bao quanh tổng thể

            // Half extents cho Cannon.js Box shape
            const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
            const boxShape = new CANNON.Box(halfExtents);
            physicsBody = new CANNON.Body({ mass: 0, material: defaultMaterial }); // Vật thể tĩnh, gán vật liệu
            physicsBody.addShape(boxShape);

            // Đặt vị trí vật thể Box Cannon.js tại tâm của hộp bao quanh thế giới
            physicsBody.position.copy(center);
            physicsBody.quaternion.set(0,0,0,1); // Quaternion định danh (AABB)

            // Tạo hình học Box debug trong Three.js
            debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            debugMaterial.color = new THREE.Color(0x00ff00); // Màu xanh lá cây cho Box
            console.log(`  -> Đã tạo Box cho đối tượng cha: ${parentObject.name}`);
        }

        if (physicsBody) {
            world.addBody(physicsBody);

            const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
            scene.add(debugMesh);

            debugVisuals.push({
                type: 'physicsDebug', // Loại chung cho tất cả các hiển thị debug vật lý
                physicsBody: physicsBody,
                debugObject: debugMesh
            });
        }
    });

    console.log("--- Kết thúc xử lý vật lý Farm ---");

}, undefined, function (error) {
    console.error('Lỗi khi tải mô hình Farm_N.glb:', error); // Đổi tên lỗi để khớp
});


// Điều khiển xe bằng bàn phím
const keyboardState = {};
window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

const truckSpeed = 10; // Tốc độ di chuyển tuyến tính
const truckRotationSpeed = 2; // Tốc độ quay của xe

// Vector làm mượt vị trí camera nhìn vào
const smoothedTruckPos = new THREE.Vector3();

function handleTruckMovement() {
    if (!truckBody) return;

    let targetLinearVelocityX = 0;
    let targetLinearVelocityZ = 0;
    let targetAngularVelocityY = 0;

    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyQuaternion(truckBody.quaternion);

    if (keyboardState['ArrowUp'] || keyboardState['KeyW']) {
        targetLinearVelocityX = -forwardVector.x * truckSpeed;
        targetLinearVelocityZ = -forwardVector.z * truckSpeed;
    } else if (keyboardState['ArrowDown'] || keyboardState['KeyS']) {
        targetLinearVelocityX = forwardVector.x * truckSpeed;
        targetLinearVelocityZ = forwardVector.z * truckSpeed;
    }

    if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
        targetAngularVelocityY = truckRotationSpeed;
    } else if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
        targetAngularVelocityY = -truckRotationSpeed;
    }

    truckBody.velocity.x = targetLinearVelocityX;
    truckBody.velocity.z = targetLinearVelocityZ;
    // Cố định vận tốc Y để xe luôn ở trên mặt phẳng
    truckBody.velocity.y = 0;

    truckBody.angularVelocity.y = targetAngularVelocityY;
}

// --- Các đối tượng phụ trợ (khối block, trụ, cầu) ---
const wallBlocks = [];
const blockSize = 1;
const blockMass = 5;
const wallRows = 5;
const wallCols = 5;
const wallStartX = -(wallCols * blockSize) / 2 - 10; // Di chuyển ra xa hơn
const wallStartY = blockSize / 2;
const wallStartZ = -30; // Di chuyển ra xa hơn

for (let i = 0; i < wallRows; i++) {
    for (let j = 0; j < wallCols; j++) {
        const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            wallStartX + j * blockSize + blockSize / 2,
            wallStartY + i * blockSize,
            wallStartZ
        );
        scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(blockSize / 2, blockSize / 2, blockSize / 2));
        const body = new CANNON.Body({
            mass: blockMass,
            position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
            shape: shape,
            material: defaultMaterial // Gán vật liệu mặc định
        });
        world.addBody(body);
        wallBlocks.push({ mesh, body });
    }
}

const cylinders = [];
const spheres = [];
const objectCount = 5; // Giảm số lượng để đỡ tốn tài nguyên

for (let i = 0; i < objectCount; i++) {
    const radiusTop = 0.5;
    const radiusBottom = 0.5;
    const height = 1;
    const radialSegments = 16;
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-20, 2 + i * 1.2, 5); // Đặt ở vị trí khác
    scene.add(mesh);

    const shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, radialSegments);
    const body = new CANNON.Body({
        mass: 5,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        shape: shape,
        material: defaultMaterial // Gán vật liệu mặc định
    });
    world.addBody(body);
    cylinders.push({ mesh, body });
}

for (let i = 0; i < objectCount; i++) {
    const radius = 0.5;
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x0099ff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(20, 2 + i * 1.2, 5); // Đặt ở vị trí khác
    scene.add(mesh);

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
        mass: 5,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        shape: shape,
        material: defaultMaterial // Gán vật liệu mặc định
    });
    world.addBody(body);
    spheres.push({ mesh, body });
}

// --- Vòng lặp Render ---
const timeStep = 1 / 60; // Bước thời gian vật lý
function animate() {
    requestAnimationFrame(animate);

    handleTruckMovement();
    world.step(timeStep); // Cập nhật thế giới vật lý

    if (truckMesh && truckBody) {
        // Đồng bộ vị trí và góc quay của mesh với body vật lý
        truckMesh.position.copy(truckBody.position);
        truckMesh.quaternion.copy(truckBody.quaternion);

        // Cập nhật vị trí camera theo xe
        const truckPos = new THREE.Vector3(truckBody.position.x, truckBody.position.y, truckBody.position.z);
        const cameraOffset = new THREE.Vector3(-15, 10, 20); // Điều chỉnh offset camera
        const desiredCameraPos = truckPos.clone().add(cameraOffset);

        camera.position.lerp(desiredCameraPos, 0.1); // Chuyển động mượt mà
        // Smooth the camera lookAt target
        smoothedTruckPos.lerp(truckPos, 0.1); // Điều chỉnh 0.1 cho độ mượt
        camera.lookAt(smoothedTruckPos); // Camera luôn nhìn vào vị trí mượt của xe
    }

    // Đồng bộ vị trí và góc quay của các debug meshes của Farm
    debugVisuals.forEach(item => {
        // Kiểm tra nếu item.debugObject là một THREE.Mesh (trường hợp của testSphereMesh)
        // và không phải là một THREE.LineSegments (trường hợp của Trimesh debug)
        if (item.debugObject instanceof THREE.Mesh) {
            item.debugObject.position.copy(item.physicsBody.position);
            item.debugObject.quaternion.copy(item.physicsBody.quaternion);
        } else if (item.debugObject instanceof THREE.LineSegments) { // Đối với Trimesh wireframe
            // Trimesh debug mesh đã được tạo với world coordinates,
            // nên vị trí của nó đã được đồng bộ với physicsBody.
            // Chỉ cần đảm bảo nó không bị dịch chuyển cục bộ.
            // Nếu physicsBody.position và physicsBody.quaternion là (0,0,0) và identity,
            // thì debugObject cũng vậy.
            item.debugObject.position.copy(item.physicsBody.position);
            item.debugObject.quaternion.copy(item.physicsBody.quaternion);
        }
    });


    // Đồng bộ cho các khối block, trụ và cầu
    wallBlocks.forEach(block => {
        block.mesh.position.copy(block.body.position);
        block.mesh.quaternion.copy(block.body.quaternion);
    });

    cylinders.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });

    spheres.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });

    renderer.render(scene, camera);
}


// Điều chỉnh camera ban đầu để nhìn tổng quan nông trại
camera.position.set(-20, 15, 30);
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Nhìn vào gốc tọa độ nơi Farm sẽ được đặt

// Xử lý thay đổi kích thước cửa sổ
window.addEventListener('resize', () => {
    const newWidth = renderTarget.clientWidth;
    const newHeight = renderTarget.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});


// Bắt đầu vòng lặp animation sau khi cửa sổ đã tải
window.onload = function () {
    animate();
}
