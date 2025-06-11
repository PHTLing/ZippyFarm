import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SceneManager {
    constructor(scene, physicsManager) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        
        this.loader = new GLTFLoader();

        this.truckMesh = null;
        this.truckRigidBody = null;
        this.truckColliderHandle = null;

        this.frontWheelLGroup = null;
        this.frontWheelRGroup = null;
        this.wheelLMesh = null;
        this.wheelRMesh = null;
        this.backWheelsMesh = null;

        this.isDebugMode = false;

        this.TRIMESH_PARENT_NAMES = [
            'Nui_01', 'Cay01', 'Cay_02', 'Cay_03', 'CotDen','plane','Plane', 'duck', 'Z','I','P','I','N','G','F','A','R','M', 'Bridge-wooden-lighter001'
        ];
        this.FALLABLE_OBJECT_NAMES = ['Cay01', 'Cay_02', 'Cay_03', 'CotDen', 'duck', 'Z','I','P','I','N','G','F','A','R','M'];
        this.STATIC_TRIMESH_NAMES = ['Nui_01', 'plane', 'Bridge-wooden-lighter001'];

        this.gltfObjectsMap = new Map();
    }

    async loadAssets() {
        const truckLoadPromise = this.loadTruck();
        const farmLoadPromise = this.loadFarm();

        await Promise.all([truckLoadPromise, farmLoadPromise]);

        // Thêm ground debug mesh vào scene
        // const groundDebugMesh = await this.physicsManager.setupWorld();
        // this.scene.add(groundDebugMesh);

        this.updateDebugModeVisuals(); // Gọi sau khi tất cả assets đã được tải và gán physics info

        return {
            truckMesh: this.truckMesh,
            gltfObjectsMap: this.gltfObjectsMap,
            truckColliderHandle: this.truckColliderHandle,
            frontWheelLGroup: this.frontWheelLGroup,
            frontWheelRGroup: this.frontWheelRGroup,
            wheelLMesh: this.wheelLMesh,
            wheelRMesh: this.wheelRMesh,
            backWheelsMesh: this.backWheelsMesh
        };
    }

    async loadTruck() {
        return new Promise((resolve, reject) => {
            this.loader.load('assets/models/Truck.glb', (gltf) => {
                this.truckMesh = gltf.scene;
                this.truckMesh.scale.set(1, 1, 1);
                this.truckMesh.position.set(-10, 15, -10);
                this.scene.add(this.truckMesh);
                this.truckMesh.visible = true; 

                // Thay đổi màu phần Skin thành màu hồng
                const skinMesh = this.truckMesh.getObjectByName("Skin");
                if (skinMesh && skinMesh.isMesh) {
                    // Tạo hoặc sửa material thành màu hồng
                    if (Array.isArray(skinMesh.material)) {
                        skinMesh.material.forEach(mat => {
                            mat.color.set(0xff69b4); // màu hồng
                            mat.needsUpdate = true;
                        });
                    } else {
                        skinMesh.material.color.set(0xff69b4);
                        skinMesh.material.needsUpdate = true;
                    }
                } else {
                    console.warn("Không tìm thấy mesh 'Skin' trong mô hình Truck");
                }


                // Đảm bảo tất cả vật liệu của truckMesh đều trong suốt
                this.truckMesh.traverse((child) => {
                    if (child.isMesh) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat) {
                                mat.transparent = true; // RẤT QUAN TRỌNG: cho phép opacity hoạt động
                                // mat.opacity = 1.0; // Giữ opacity ban đầu
                                mat.needsUpdate = true;
                            }
                        });
                    }
                });

                if (isNaN(this.truckMesh.quaternion.x) || isNaN(this.truckMesh.quaternion.y) || isNaN(this.truckMesh.quaternion.z) || isNaN(this.truckMesh.quaternion.w)) {
                    console.error("Lỗi nghiêm trọng: truckMesh.quaternion là NaN, đặt lại về quaternion đơn vị.");
                    this.truckMesh.quaternion.set(0, 0, 0, 1);
                }
                this.truckMesh.quaternion.normalize();

                this.truckMesh.traverse((child) => {
                    if (child.isObject3D) {
                        switch (child.name) {
                            case 'FrontWheel_L':
                                this.frontWheelLGroup = child;
                                child.traverse((wheelChild) => {
                                    if (wheelChild.isMesh && wheelChild.name === 'Wheel_L') {
                                        this.wheelLMesh = wheelChild;
                                    }
                                });
                                break;
                            case 'FrontWheel_R':
                                this.frontWheelRGroup = child;
                                child.traverse((wheelChild) => {
                                    if (wheelChild.isMesh && wheelChild.name === 'Wheel_R') {
                                        this.wheelRMesh = wheelChild;
                                    }
                                });
                                break;
                            case 'BackWheels':
                                this.backWheelsMesh = child;
                                break;
                        }
                    }
                });

                if (!this.frontWheelLGroup || !this.frontWheelRGroup || !this.wheelLMesh || !this.wheelRMesh || !this.backWheelsMesh) {
                    console.warn("Không tìm thấy tất cả các mesh/group bánh xe cần thiết. Đảm bảo tên trong GLB là chính xác.");
                    console.log("Found:", {
                        frontWheelLGroup: this.frontWheelLGroup?.name,
                        frontWheelRGroup: this.frontWheelRGroup?.name,
                        wheelLMesh: this.wheelLMesh?.name,
                        wheelRMesh: this.wheelRMesh?.name,
                        backWheelsMesh: this.backWheelsMesh?.name
                    });
                }

                const truckHalfExtents = new this.physicsManager.RAPIER.Vector3(1.2, 0.8, 2.5);
                const { rigidBody, collider, debugMesh } = this.physicsManager.createBox({
                    position: this.truckMesh.position,
                    quaternion: this.truckMesh.quaternion,
                    halfExtents: truckHalfExtents,
                    isDynamic: true,
                    friction: 1,
                    restitution: 0.5,
                    linearDamping: 0.05,
                    angularDamping: 0.2,
                    debugColor: 0xff00ff
                });
                this.truckRigidBody = rigidBody;
                this.truckColliderHandle = collider.handle;

                this.physicsManager.setTruckPhysics(this.truckMesh, rigidBody, collider, debugMesh);
                console.log("Truck rigid body type:", this.truckRigidBody.bodyType());
                
                resolve();
            }, undefined, (error) => {
                console.error('Lỗi khi tải mô hình xe tải:', error);
                reject(error);
            });
        });
    }

    async loadFarm() {
        return new Promise((resolve, reject) => {
            this.loader.load('assets/models/Map_Farm.glb', (gltf) => {
                const farmScene = gltf.scene;
                farmScene.position.set(0, 0, 0);
                farmScene.updateMatrixWorld(true);
                this.scene.add(farmScene);

                farmScene.children.forEach((parentObject) => {
                    parentObject.traverse((obj) => {
                        if (obj.isMesh) {
                            obj.visible = true;
                            // Đảm bảo tất cả vật liệu của Farm đều trong suốt
                            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                            materials.forEach(mat => {
                                if (mat) {
                                    mat.transparent = true; // RẤT QUAN TRỌNG: cho phép opacity hoạt động
                                    // mat.opacity = 1.0; // Giữ opacity ban đầu
                                    mat.needsUpdate = true;
                                }
                            });
                        }
                    });

                    const initialWorldPosition = new THREE.Vector3();
                    const initialWorldQuaternion = new THREE.Quaternion();
                    parentObject.getWorldPosition(initialWorldPosition);
                    parentObject.getWorldQuaternion(initialWorldQuaternion);

                    const isTrimeshObject = this.TRIMESH_PARENT_NAMES.includes(parentObject.name);
                    let objectType;

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

                        const { rigidBody, debugMesh } = this.physicsManager.createTrimesh({
                            meshes: meshesInGroup,
                            position: initialWorldPosition,
                            quaternion: initialWorldQuaternion,
                            friction: 0.9,
                            restitution: 0.2,
                            debugColor: 0xffa500,
                            isDynamic: this.FALLABLE_OBJECT_NAMES.includes(parentObject.name)
                        });

                        if (this.FALLABLE_OBJECT_NAMES.includes(parentObject.name)) {
                            objectType = 'fallable';
                            rigidBody.setBodyType(this.physicsManager.RAPIER.RigidBodyType.Fixed, true);
                        } else if (this.STATIC_TRIMESH_NAMES.includes(parentObject.name)) {
                            objectType = 'static_trimesh';
                        } else {
                            objectType = 'unknown_trimesh_static';
                        }
                        this.gltfObjectsMap.set(rigidBody.handle, {
                            mesh: parentObject,
                            rigidBody: rigidBody,
                            debugMesh: debugMesh,
                            type: objectType
                        });

                        this.scene.add(debugMesh);
                    } else {
                        const boundingBox = new THREE.Box3().setFromObject(parentObject, true);
                        const size = new THREE.Vector3();
                        boundingBox.getSize(size);
                        const center = new THREE.Vector3();
                        boundingBox.getCenter(center);

                        const { rigidBody, collider, debugMesh } = this.physicsManager.createBox({
                            position: center,
                            quaternion: initialWorldQuaternion,
                            halfExtents: new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2),
                            isDynamic: false,
                            friction: 0.9,
                            restitution: 0.2,
                            debugColor: 0x00ff00
                        });
                        objectType = 'static_cuboid';
                        this.gltfObjectsMap.set(rigidBody.handle, {
                            mesh: parentObject,
                            rigidBody: rigidBody,
                            debugMesh: debugMesh,
                            type: objectType
                        });
                        this.scene.add(debugMesh);
                    }
                });
                resolve();
            }, undefined, (error) => {
                console.error('Lỗi khi tải mô hình Farm.glb:', error);
                reject(error);
            });
        });
    }

    toggleDebugMode() {
        this.isDebugMode = !this.isDebugMode;
        console.log(`Chế độ Debug: ${this.isDebugMode ? 'BẬT' : 'TẮT'}`);
        this.updateDebugModeVisuals();
    }

    updateDebugModeVisuals() {
        // Cập nhật hiển thị cho xe tải
        if (this.truckMesh && this.physicsManager.truckInfo.debugMesh) {
            // Không tắt visible của truckMesh, chỉ chỉnh opacity
            this.truckMesh.traverse((child) => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat) {
                            mat.opacity = this.isDebugMode ? 0.3 : 1.0;
                            mat.needsUpdate = true;
                        }
                    });
                }
            });
            // Ẩn/hiện debug mesh của xe tải
            this.physicsManager.truckInfo.debugMesh.visible = this.isDebugMode;
        }

        // Cập nhật hiển thị cho các đối tượng test (từ ObjectFactory)
        this.physicsManager.testObjects.forEach(item => {
            if (item.mesh) {
                // Không tắt visible của test object, chỉ chỉnh opacity
                const materials = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material];
                materials.forEach(mat => {
                    if (mat) {
                        mat.opacity = this.isDebugMode ? 0.3 : 1.0;
                        mat.needsUpdate = true;
                    }
                });
            }
        });

        // Cập nhật hiển thị cho các đối tượng GLTF từ Farm.glb
        this.gltfObjectsMap.forEach(item => {
            if (item.mesh) {
                // Không tắt visible của GLTF object, chỉ chỉnh opacity
                item.mesh.traverse((child) => {
                    if (child.isMesh) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat) {
                                mat.opacity = this.isDebugMode ? 0.3 : 1.0;
                                mat.needsUpdate = true;
                            }
                        });
                    }
                });
            }
        });

        // Cập nhật hiển thị cho TẤT CẢ debug meshes (bao gồm cả ground)
        this.physicsManager.debugVisuals.forEach(item => {
            if (item.debugObject) {
                item.debugObject.visible = this.isDebugMode;
                if (item.debugObject.material) {
                    const materials = Array.isArray(item.debugObject.material) ? item.debugObject.material : [item.debugObject.material];
                    materials.forEach(mat => {
                        if (mat) {
                            // Opacity của debug mesh luôn là 1.0 để rõ ràng
                            // transparent đã được thiết lập là true trong PhysicsManager khi tạo
                            mat.needsUpdate = true;
                        }
                    });
                }
            }
        });
    }
}