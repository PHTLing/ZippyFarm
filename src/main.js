// src/main.js

// --- Import các thư viện sử dụng importmap ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

// --- Cài đặt cơ bản của Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

const renderTarget = document.getElementById('render-target');
if (!renderTarget) {
    console.error("Lỗi: Không tìm thấy phần tử 'render-target'.");
} else {
    renderer.setSize(renderTarget.clientWidth, renderTarget.clientHeight);
    renderTarget.appendChild(renderer.domElement);
}

// Ánh sáng
const ambientLight = new THREE.AmbientLight(0x404040, 5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(5, 10, 7.5).normalize();
scene.add(directionalLight);

const axesHelper = new THREE.AxesHelper(5); // Tham số là độ dài trục
scene.add(axesHelper);

// Mặt phẳng nền (Ground)
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = Math.PI / 2;
scene.add(groundMesh);

// --- Cài đặt Cannon-es (Thư viện vật lý) ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;
world.defaultContactMaterial.friction = 0.9;
world.defaultContactMaterial.restitution = 0;

// Thêm mặt phẳng nền vào thế giới vật lý
const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// --- 1. Điều khiển chiếc xe (truck.glb) ---
let truckMesh;
let truckBody;
const loader = new GLTFLoader();

loader.load('assets/Truck.glb', function (gltf) {
    truckMesh = gltf.scene;
    truckMesh.scale.set(0.5, 0.5, 0.5);
    truckMesh.position.set(0, 0.5, 0);
    scene.add(truckMesh);


    const truckShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 1));
    truckBody = new CANNON.Body({
        mass: 100,
        position: new CANNON.Vec3(truckMesh.position.x, truckMesh.position.y, truckMesh.position.z),
        shape: truckShape,
        linearDamping: 0.2,
        angularDamping: 0.2,
    });
    truckBody.allowSleep = false;

    // Khóa chuyển động Y và chỉ quay quanh trục Y
    // truckBody.linearFactor.set(1, 1, 1);
    truckBody.angularFactor.set(0, 1, 0);

    world.addBody(truckBody);


    truckBody.addEventListener('collide', (e) => {
        // console.log('Truck collided with:', e.body);
    });
}, undefined, function (error) {
    console.error('Lỗi khi tải mô hình xe tải:', error);
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
const truckRotationSpeed = 2; // ✅ Đặt lại tốc độ quay để xe có thể rẽ

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
        // ✅ In tọa độ khi di chuyển tiến
        console.log(`Tọa độ xe (tiến): X=${truckBody.position.x.toFixed(2)}, Y=${truckBody.position.y.toFixed(2)}, Z=${truckBody.position.z.toFixed(2)}`);
    } else if (keyboardState['ArrowDown'] || keyboardState['KeyS']) {
        targetLinearVelocityX = forwardVector.x * truckSpeed;
        targetLinearVelocityZ = forwardVector.z * truckSpeed;
        // ✅ In tọa độ khi di chuyển lùi (tùy chọn)
        console.log(`Tọa độ xe (lùi): X=${truckBody.position.x.toFixed(2)}, Y=${truckBody.position.y.toFixed(2)}, Z=${truckBody.position.z.toFixed(2)}`);
    }

    if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
        targetAngularVelocityY = truckRotationSpeed;
        
    } else if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
        targetAngularVelocityY = -truckRotationSpeed;
    }

    truckBody.velocity.x = targetLinearVelocityX;
    truckBody.velocity.z = targetLinearVelocityZ;
    // Cố định vận tốc Y để xe luôn ở trên mặt phẳng và không bị "bay"
    truckBody.velocity.y = 0; 

    truckBody.angularVelocity.y = targetAngularVelocityY;

    // console.log(`Vận tốc xe: x=${truckBody.velocity.x.toFixed(2)}, z=${truckBody.velocity.z.toFixed(2)}`);
}

// --- 2. Xây dựng bức tường bằng những khối hình hộp (5x5) ---
const wallBlocks = [];
const blockSize = 1;
const blockMass = 5;
const wallRows = 5;
const wallCols = 5;
const wallStartX = -(wallCols * blockSize) / 2;
const wallStartY = blockSize / 2;
const wallStartZ = 20;

for (let i = 0; i < wallRows; i++) {
    for (let j = 0; j < wallCols; j++) {
        // Three.js Mesh
        const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            wallStartX + j * blockSize + blockSize / 2,
            wallStartY + i * blockSize,
            wallStartZ
        );
        scene.add(mesh);

        // Cannon.js Body
        const shape = new CANNON.Box(new CANNON.Vec3(blockSize / 2, blockSize / 2, blockSize / 2));
        const body = new CANNON.Body({
            mass: blockMass,
            position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
            shape: shape,
        });
        world.addBody(body);

        wallBlocks.push({ mesh, body });
    }
}

// --- Vòng lặp Render ---
const timeStep = 1 / 60;
function animate() {
    requestAnimationFrame(animate);

    handleTruckMovement();
    world.step(timeStep);

    if (truckMesh && truckBody) {
        // Đồng bộ vị trí và góc quay của mesh với body vật lý
        truckMesh.position.copy(truckBody.position);
        truckMesh.quaternion.copy(truckBody.quaternion);

        // Cập nhật vị trí camera theo xe
        const truckPos = new THREE.Vector3(truckBody.position.x, truckBody.position.y, truckBody.position.z);
        const cameraOffset = new THREE.Vector3(-5, 5, 15);
        const desiredCameraPos = truckPos.clone().add(cameraOffset);

        camera.position.lerp(desiredCameraPos, 0.1); // Chuyển động mượt mà
        camera.lookAt(truckPos);
    }

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


// Điều chỉnh camera
camera.position.set(0, 0, 0); // ✅ Vị trí camera ban đầu tốt hơn để quan sát xe
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Nhìn vào gốc tọa độ ban đầu của xe

// Xử lý thay đổi kích thước cửa sổ
window.addEventListener('resize', () => {
    const newWidth = renderTarget.clientWidth;
    const newHeight = renderTarget.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

// --- Thêm hình trụ (Cylinder) và hình cầu (Sphere) vào scene ---
const cylinders = [];
const spheres = [];
const objectCount = 10;

// Thêm các hình trụ
for (let i = 0; i < objectCount; i++) {
    const radiusTop = 0.5;
    const radiusBottom = 0.5;
    const height = 1;
    const radialSegments = 16;
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-5, 2 + i * 1.2, 5);
    scene.add(mesh);

    const shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, radialSegments);
    const body = new CANNON.Body({
        mass: 5,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        shape: shape,
    });
    world.addBody(body);

    cylinders.push({ mesh, body });
}

// Thêm các hình cầu
for (let i = 0; i < objectCount; i++) {
    const radius = 0.5;
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x0099ff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(5, 2 + i * 1.2, 5);
    scene.add(mesh);

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
        mass: 5,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        shape: shape,
    });
    world.addBody(body);

    spheres.push({ mesh, body });
}




animate();
