// --- IMPORT MODULE ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// --- THIẾT LẬP THREE.JS ---

// Scene (Cảnh)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);

// Camera (Máy ảnh)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 15);

// Renderer (Bộ kết xuất)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const renderTarget = document.getElementById('render-target');
if (renderTarget) {
    renderTarget.appendChild(renderer.domElement);
} else {
    console.error('Lỗi: Không tìm thấy phần tử #render-target trong DOM. Canvas không thể gắn vào.');
}

// Controls (Điều khiển camera)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// Lighting (Ánh sáng)
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// Axes Helper (Trợ giúp hiển thị trục tọa độ)
scene.add(new THREE.AxesHelper(5));

// Mảng để lưu trữ các đối tượng gỡ lỗi (debug visuals)
const debugVisuals = [];

// --- THIẾT LẬP CANNON.JS (VẬT LÝ) ---

// Tạo một thế giới Cannon.js mới
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Đặt trọng lực (Trái đất)
const timeStep = 1 / 60; // Bước thời gian mô phỏng vật lý

// Tạo một Vật liệu Vật lý cho mặt đất
const groundMaterial = new CANNON.Material('groundMaterial');
const groundContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    groundMaterial,
    {
        friction: 0.5,
        restitution: 0.3, // Độ nảy
    }
);
world.addContactMaterial(groundContactMaterial);

// Tạo Mặt phẳng Đất (Three.js và Cannon.js)
const planeWidth = 20;
const planeHeight = 20;
const threePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide }) // Màu xanh lá cây
);
threePlane.rotation.x = -Math.PI / 2; // Xoay để nằm phẳng trên mặt phẳng XZ
threePlane.position.y = -0.5; // Đặt thấp hơn gốc tọa độ một chút
scene.add(threePlane);

// Tạo vật thể vật lý Cannon.js cho mặt đất
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial }); // mass = 0 biến nó thành tĩnh
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Xoay để khớp với mặt phẳng Three.js
groundBody.position.y = threePlane.position.y; // Khớp vị trí
world.addBody(groundBody);

// Tạo hình ảnh gỡ lỗi cho mặt đất (hộp dây màu xanh ngọc)
const groundDebug = new THREE.Mesh(
    new THREE.BoxGeometry(planeWidth, 0.1, planeHeight),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.5 })
);
scene.add(groundDebug);
debugVisuals.push({
    type: 'physicsMarker', // Loại này để biết đây là dấu hiệu của vật thể vật lý
    physicsBody: groundBody,
    debugObject: groundDebug
});


// --- TẢI MÔ HÌNH GLB VÀ TẠO HÌNH DẠNG VẬT LÝ CHO ĐỐI TƯỢNG CHA ---

// Danh sách tên các đối tượng cha sẽ sử dụng Trimesh (hình dạng va chạm chi tiết)
const TRIMESH_PARENT_NAMES = [
    'Nui_01', 'Cay01', 'Cay_02', 'Cay_03', 'CotDen'
];

const loader = new GLTFLoader();
loader.load('assets/Farm_N.glb', function (gltf) {
    const modelScene = gltf.scene;
    // Đảm bảo modelScene ở vị trí 0,0,0 nếu không có ý định dịch chuyển nó
    modelScene.position.set(0, 0, 0);
    // Cập nhật ma trận thế giới cho toàn bộ modelScene và tất cả các đối tượng con của nó.
    // Điều này là RẤT QUAN TRỌNG để đảm bảo object.matrixWorld của mỗi mesh là chính xác
    // khi chúng ta thu thập đỉnh trong hệ tọa độ thế giới.
    modelScene.updateMatrixWorld(true);

    scene.add(modelScene);
    camera.lookAt(modelScene.position); // Điều chỉnh camera nhìn vào mô hình

    // Duyệt qua các ĐỐI TƯỢNG CON TRỰC TIẾP của modelScene (đây là các "đối tượng cha")
    modelScene.children.forEach((parentObject) => {
        // Làm cho mô hình GLB gốc trong suốt để nhìn thấy Trimesh/Box debug bên trong
        parentObject.traverse((obj) => {
            if (obj.isMesh) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(mat => {
                    if (mat) { // Check if material exists
                        mat.transparent = true;
                        mat.opacity = 0.4; // Đặt độ mờ cho mô hình gốc
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
            physicsBody = new CANNON.Body({ mass: 0 }); // Vật thể tĩnh
            physicsBody.addShape(trimeshShape);

            // Vì Trimesh đã được tạo bằng các đỉnh trong hệ tọa độ thế giới,
            // vật thể vật lý được đặt tại gốc (0,0,0) và không xoay.
            physicsBody.position.set(0, 0, 0);
            physicsBody.quaternion.set(0, 0, 0, 1); // Cannon.js identity quaternion

            debugGeometry = new THREE.BufferGeometry();
            debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(collectedWorldVertices, 3));
            debugGeometry.setIndex(new THREE.Uint32BufferAttribute(collectedIndices, 1));
            debugMaterial.color = new THREE.Color(0xffa500); // Màu cam cho Trimesh
            console.log(`Đã tạo Trimesh cho đối tượng cha: ${parentObject.name}`);

        } else {
            // --- TẠO BOX cho đối tượng cha (bao gồm tất cả mesh con của nó) ---

            // Tính toán hộp bao quanh bao gồm toàn bộ đối tượng cha và tất cả các đối tượng con của nó.
            // Tham số 'true' đảm bảo tính toán ở world space và bao gồm các đối tượng con.
            const boundingBox = new THREE.Box3().setFromObject(parentObject, true);
            const size = new THREE.Vector3();
            boundingBox.getSize(size); // Kích thước của hộp bao quanh tổng thể

            const center = new THREE.Vector3();
            boundingBox.getCenter(center); // Tâm của hộp bao quanh tổng thể

            // Half extents cho Cannon.js Box shape
            const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
            const boxShape = new CANNON.Box(halfExtents);
            physicsBody = new CANNON.Body({ mass: 0 }); // Vật thể tĩnh
            physicsBody.addShape(boxShape);

            // Đặt vị trí vật thể Box Cannon.js tại tâm của hộp bao quanh thế giới
            physicsBody.position.copy(center);
            // Quan trọng: Vì Box3 là Axis-Aligned (căn chỉnh theo trục thế giới),
            // chúng ta chỉ sao chép vị trí. Quaternion của Box body mặc định là identity (không xoay)
            // trừ khi bạn muốn nó xoay theo một hướng cụ thể không phải trục thế giới.
            // Nếu đối tượng cha có xoay đáng kể và bạn muốn box vật lý cũng xoay theo, bạn sẽ cần
            // sử dụng OBB (Oriented Bounding Box) mà Cannon.js không hỗ trợ trực tiếp.
            // Để đơn giản và phù hợp với AABB, giữ nguyên quaternion.
            // Tuy nhiên, để đảm bảo box debug hiển thị đúng vị trí và xoay của Three.js,
            // chúng ta sẽ copy quaternion của parentObject sang debugMesh, không phải physicsBody.
            // Cannon.js Box mặc định không có xoay nếu không set, nên nó sẽ là AABB.
            physicsBody.quaternion.set(0,0,0,1); // Đặt quaternion về định danh nếu muốn AABB

            // Tạo hình học Box debug trong Three.js
            debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            debugMaterial.color = new THREE.Color(0x00ff00); // Màu xanh lá cây cho Box
            console.log(`Đã tạo Box cho đối tượng cha: ${parentObject.name}`);
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

}, undefined, function (error) {
    console.error('Lỗi khi load GLB:', error);
});


// --- VÒNG LẶP HOẠT HÌNH ---

function animate() {
    requestAnimationFrame(animate);

    // Bước mô phỏng thế giới vật lý
    world.step(timeStep);

    // Cập nhật vị trí và xoay của các công cụ hiển thị gỡ lỗi từ các vật thể vật lý
    debugVisuals.forEach(item => {
        if (item.physicsBody && item.debugObject) {
            item.debugObject.position.copy(item.physicsBody.position);
            item.debugObject.quaternion.copy(item.physicsBody.quaternion);
        }
    });

    controls.update(); // Cập nhật điều khiển camera
    renderer.render(scene, camera); // Kết xuất cảnh
}

// Start the animation loop
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
