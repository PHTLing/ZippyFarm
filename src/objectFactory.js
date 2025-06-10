import * as THREE from 'three';

export class ObjectFactory {
    constructor(scene, physicsManager) {
        this.scene = scene;
        this.physicsManager = physicsManager;
    }

    createTestObjects() {
        // Thêm một quả cầu kiểm tra
        const testSphereRadius = 0.5;
        const testSphereGeometry = new THREE.SphereGeometry(testSphereRadius, 16, 16);
        const testSphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const testSphereMesh = new THREE.Mesh(testSphereGeometry, testSphereMaterial);
        testSphereMesh.position.set(-20, 10, 5);
        this.scene.add(testSphereMesh);

        const { rigidBody: testSphereRigidBody, debugMesh: testSphereDebugMesh } = this.physicsManager.createSphere({
            position: testSphereMesh.position,
            radius: testSphereRadius,
            isDynamic: true,
            friction: 0.9,
            restitution: 0.5,
            debugColor: 0x00ff00,
            mesh: testSphereMesh // Đã thêm: truyền mesh vào đây
        });
        testSphereMesh.userData.rigidBody = testSphereRigidBody; // Lưu rigidBody vào mesh để dễ truy cập

        // Thêm một hình cầu đỏ nhỏ tại vị trí ban đầu dự kiến của xe tải (để kiểm tra)
        const helperGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const helperMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
        helperMesh.position.set(-5, 0.5, -5);
        // this.scene.add(helperMesh);

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
                this.scene.add(mesh);

                const { rigidBody } = this.physicsManager.createBox({
                    position: mesh.position,
                    halfExtents: new THREE.Vector3(blockSize / 2, blockSize / 2, blockSize / 2),
                    isDynamic: true,
                    friction: 0.9,
                    restitution: 0.5,
                    debugColor: 0x00ff00,
                    mesh: mesh
                });
                mesh.userData.rigidBody = rigidBody;
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
            this.scene.add(mesh);

            const { rigidBody } = this.physicsManager.createCylinder({
                position: mesh.position,
                radiusTop: radiusTop,
                radiusBottom: radiusBottom,
                height: height,
                radialSegments: radialSegments,
                isDynamic: true,
                friction: 0.9,
                restitution: 0.5,
                debugColor: 0xffaa00,
                mesh: mesh // Đã thêm: truyền mesh vào đây
            });
            mesh.userData.rigidBody = rigidBody;
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
            this.scene.add(mesh);

            const { rigidBody } = this.physicsManager.createSphere({
                position: mesh.position,
                radius: radius,
                isDynamic: true,
                friction: 0.9,
                restitution: 0.5,
                debugColor: 0x0099ff,
                mesh: mesh // Đã thêm: truyền mesh vào đây
            });
            mesh.userData.rigidBody = rigidBody;
        }
    }
}