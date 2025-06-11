import * as THREE from 'three';

export class ObjectFactory {
    constructor(scene, physicsManager) {
        this.scene = scene;
        this.physicsManager = physicsManager;
    }

    createTestObjects() {

        const textureLoader = new THREE.TextureLoader();
        
        const sphereTexturePath = 'assets/images/football.jpg';
        const sphereTexture = textureLoader.load(sphereTexturePath);

        // --- Quả bóng ---
        const testSphereRadius = 1.0;
        const testSphereGeometry = new THREE.SphereGeometry(testSphereRadius, 16, 16);
        const testSphereMaterial = new THREE.MeshStandardMaterial({
                                map: sphereTexture,
                                color: 0xffffff 
                            });
        const testSphereMesh = new THREE.Mesh(testSphereGeometry, testSphereMaterial);
        testSphereMesh.position.set(-50, 3, 0);
        this.scene.add(testSphereMesh);

        const { rigidBody: testSphereRigidBody, debugMesh: testSphereDebugMesh } = this.physicsManager.createSphere({
            position: testSphereMesh.position,
            radius: testSphereRadius,
            isDynamic: true,
            friction: 0.1,
            restitution: 0.1,
            debugColor: 0x00ff00,
            mesh: testSphereMesh 
        });
        testSphereMesh.userData.rigidBody = testSphereRigidBody; // Lưu rigidBody vào mesh để dễ truy cập

        // Bức tường hình chữ nhật  (tường vuông)
        const boxTexturePath = 'assets/images/box.jpg';
        const boxTexture = textureLoader.load(boxTexturePath);

        const baseSize = 1;

        const boxWidth = baseSize;       
        const boxHeight = baseSize;       
        const boxLength = baseSize * 1.5; 

        const wallRows = 5; 
        const wallCols = 5; 

        const wallStartX = -150;
        const wallStartY = boxHeight / 2 ;

        const wallStartZ = -(wallRows * boxLength) / 2 + 2; 

        for (let i = 0; i < wallCols; i++) {
            for (let j = 0; j < wallRows; j++) {

                const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxLength);
                const material = new THREE.MeshStandardMaterial({
                                map: boxTexture,
                                color: 0xffffff 
                            });
                const mesh = new THREE.Mesh(geometry, material);

                const x = wallStartX;
                const y = wallStartY + i * boxHeight;
                const z = wallStartZ + j * boxLength + boxLength / 2; 

                mesh.position.set(x, y, z);
                this.scene.add(mesh);


                const { rigidBody } = this.physicsManager.createBox({
                    position: mesh.position,
                    halfExtents: new THREE.Vector3(boxWidth / 2, boxHeight / 2, boxLength / 2),
                    isDynamic: true,
                    friction: 0.9,
                    restitution: 0.1,
                    debugColor: 0x00ff00,
                    mesh: mesh
                });
                mesh.userData.rigidBody = rigidBody;
            }
        }

        // --- Tạo bức tường hình chóp (pyramid wall) ---
        const pyramidBaseBlocks = 5; 
        const pyramidStartX = -20; // X cố định
        const pyramidStartZ = -3;   // Z sẽ thay đổi theo tầng

        for (let layer = 0; layer < pyramidBaseBlocks; layer++) {
            const blocksInCurrentLayer = pyramidBaseBlocks - layer;
            const currentLayerLength = blocksInCurrentLayer * boxLength;
            const baseLayerLength = pyramidBaseBlocks * boxLength;
            const offsetZ = (baseLayerLength - currentLayerLength) / 2;

            for (let blockIndex = 0; blockIndex < blocksInCurrentLayer; blockIndex++) {
                const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxLength);
                const material = new THREE.MeshStandardMaterial({
                    map: boxTexture,
                    color: 0xffffff 
                });
                const mesh = new THREE.Mesh(geometry, material);

                const x = pyramidStartX; // cố định
                const y = (boxHeight / 2) + (layer * boxHeight); // tầng chồng lên theo Y
                const z = pyramidStartZ + offsetZ + (blockIndex * boxLength) + (boxLength / 2);

                mesh.position.set(x, y, z);
                this.scene.add(mesh);

                const { rigidBody } = this.physicsManager.createBox({
                    position: mesh.position,
                    halfExtents: new THREE.Vector3(boxWidth / 2, boxHeight / 2, boxLength / 2),
                    isDynamic: true, 
                    friction: 0.9,
                    restitution: 0.1,
                    debugColor: 0xff00ff,
                    mesh: mesh
                });
                mesh.userData.rigidBody = rigidBody;
            }
        }


        const cylinderTexturePath = 'assets/images/straw.jpg';
        const cylinderTexture = textureLoader.load(cylinderTexturePath);

        const objectCountPerStack = 2; // Number of cylinders to stack at each position
        const squareSide = 2; // For a 2x2 square formation

        // --- Create the 2x2 square formation with stacked cylinders ---
        for (let row = 0; row < squareSide; row++) {
            for (let col = 0; col < squareSide; col++) {
                for (let i = 0; i < objectCountPerStack; i++) {
                    const radiusTop = 1;
                    const radiusBottom = 1;
                    const height = 2;
                    const radialSegments = 32;
                    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
                    const material = new THREE.MeshStandardMaterial({
                                map: cylinderTexture,
                                color: 0xffffff 
                            });
                    const mesh = new THREE.Mesh(geometry, material);

                    // Calculate x and z positions for the square
                    const x = -40 + col * 2.5; // Adjust spacing as needed
                    const y = 3 + i * height; // Stack vertically based on height
                    const z = -90 + row * 2.5; // Adjust spacing as needed

                    mesh.position.set(x, y, z);
                    this.scene.add(mesh);

                    const { rigidBody } = this.physicsManager.createCylinder({
                        position: mesh.position,
                        radiusTop: radiusTop,
                        radiusBottom: radiusBottom,
                        height: height,
                        radialSegments: radialSegments,
                        isDynamic: true,
                        friction: 0.5,
                        restitution: 0.1,
                        debugColor: 0xffaa00,
                        mesh: mesh
                    });
                    mesh.userData.rigidBody = rigidBody;
                }
            }
        }

        // --- Create the horizontal cylinder outside the formation ---
        {
            const radiusTop = 1;
            const radiusBottom = 1;
            const height = 2; // This is the height of the cylinder along its local Y-axis
            const radialSegments = 32;
            const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
            const material = new THREE.MeshStandardMaterial({
                map: cylinderTexture,
                color: 0xffffff
            });
            const mesh = new THREE.Mesh(geometry, material);

            // Position for the horizontal cylinder
            const x = -35; // Further out on X
            const y = 1; // Close to the ground
            const z = -90; // Slightly offset on Z

            mesh.position.set(x, y, z);

            // Rotate the cylinder to be horizontal
            // To make it lie on its side, rotate it 90 degrees around the Z-axis
            mesh.rotation.z = Math.PI / 2; // 90 degrees in radians

            this.scene.add(mesh);

            const { rigidBody } = this.physicsManager.createCylinder({
                position: mesh.position,
                radiusTop: radiusTop,
                radiusBottom: radiusBottom,
                height: height, // Use original height for physics body, and let physics engine handle rotation
                radialSegments: radialSegments, // Not strictly needed for physics, but might be part of the createCylinder signature
                isDynamic: true,
                friction: 0.9,
                restitution: 0.1,
                debugColor: 0x00ff00,
                mesh: mesh,
                rotation: mesh.rotation // Pass the rotation to the physics body
            });
            mesh.userData.rigidBody = rigidBody;
        }
    }
}
