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
            'Z','I','P','P_1','Y','F','A','R','M',

            'plane', 'Sign','mailbox', 'haystack', 'cart',
            'gate', 'dog_bow', 'water_can', 'Hoe','Hoe_1',
            'Bridge-wooden-lighter', 'Bridge-wooden-lighter_1', 'dock_wide',
            'lantern_1','lantern_2','lantern_3','lantern_4','lantern_5','lantern_6','lantern_7','lantern_8','lantern_9','lantern_10','lantern_11','lantern_12','lantern_13','lantern_14','lantern_15','lantern_16','lantern_17','lantern_18','lantern_19',
            
            

            'rock','Cliff_Rock','Cliff_Rock_1','Cliff_Rock_2', 'Cliff_Rock_3',
            'tree','tree_1','tree_2','tree_3',
            'beet','beet_1','beet_2','beet_3','beet_4','beet_5','beet_6','beet_7','beet_8','beet_9',
            'BananaTree', 'BananaTree_1', 'BananaTree_2', 'BananaTree_3', 'BananaTree_4', 'BananaTree_5',
            'apple', 'apple_1', 'apple_2', 'apple_3', 'apple_4', 'apple_5', 'apple_6', 'apple_7', 'apple_8', 'apple_9', 'apple_10','apple_11','apple_12','apple_13','apple_14','apple_15',
            'orange','orange_1','orange_2','orange_3','orange_4','orange_5','orange_6','orange_7','orange_8','orange_9','orange_10','orange_11','orange_12','orange_13','orange_14','orange_15',


            'dog',
            
            'Fence-Sheep_1',
            
        ];
        this.FALLABLE_OBJECT_NAMES = [
            'Z','I','P','P_1','Y','F','A','R','M','Fence-Sheep_1',
        ];
        this.STATIC_TRIMESH_NAMES = [
            'plane','rock','Cliff_Rock_1','Cliff_Rock_2', 'Cliff_Rock_3', 'Cliff_Rock_4', 'plane'
        ];
        this.STATIC_NOMESH_NAMES = ['street', 'path', 'path001', 'path002', 'path003', 'river', 'pond', 'grass_base_1'];

        this.gltfObjectsMap = new Map();

        // Thêm các biến để lưu trữ trạng thái ban đầu của xe tải
        this.initialTruckPosition = new THREE.Vector3();
        this.initialTruckQuaternion = new THREE.Quaternion();
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
                this.truckMesh.position.set(0, 5, 0);
                this.scene.add(this.truckMesh);
                this.truckMesh.visible = true; 

                // Đảm bảo tất cả vật liệu của truckMesh đều trong suốt
                this.truckMesh.traverse((child) => {
                    child.castShadow = true; 
                    child.receiveShadow = true;
                    
                    if (child.isMesh) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat) {
                                mat.transparent = true;
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
                // console.log("Truck rigid body type:", this.truckRigidBody.bodyType());
                
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
                farmScene.position.set(0, 1, 0);
                farmScene.updateMatrixWorld(true);
                this.scene.add(farmScene);

                farmScene.children.forEach((parentObject) => {
                    if (this.STATIC_NOMESH_NAMES.includes(parentObject.name)) {
                        console.log(`Bỏ qua tạo collider cho đối tượng NOMESH: ${parentObject.name}`);
                        // Đảm bảo đối tượng này vẫn hiển thị nếu bạn muốn
                        parentObject.traverse((obj) => {
                            if (obj.isMesh) {
                                obj.visible = true; // Vẫn hiển thị mesh
                                // Có thể chỉnh opacity hoặc màu nếu cần debug
                            }
                        });
                        return; // Bỏ qua đối tượng này, không tạo collider
                    }

                    parentObject.traverse((obj) => {
                        if (obj.isMesh) {
                            obj.visible = true;

                            obj.castShadow = true;
                            obj.receiveShadow = true;

                            // Đảm bảo tất cả vật liệu của Farm đều trong suốt
                            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                            materials.forEach(mat => {
                                if (mat) {
                                    mat.transparent = true; // RẤT QUAN TRỌNG: cho phép opacity hoạt động
                                    mat.opacity = 1.0; // Giữ opacity ban đầu
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