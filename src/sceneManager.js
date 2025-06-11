import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class SceneManager {
  constructor(scene, physicsManager) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.loader = new GLTFLoader();
    this.mixers = [];
    this.truckMesh = null;
    this.truckRigidBody = null;
    this.truckColliderHandle = null;
    this.frontWheelLGroup = null;
    this.frontWheelRGroup = null;
    this.wheelLMesh = null;
    this.wheelRMesh = null;
    this.backWheelsMesh = null;
    this.isDebugMode = false;
    this.gltfObjectsMap = new Map();

    // Các mảng tên đối tượng (Không thay đổi so với file old)
    this.TRIMESH_PARENT_NAMES = [
      "Z",
      "I",
      "P",
      "P_1",
      "Y",
      "F",
      "A",
      "R",
      "M",
      "plane",
      "Sign",
      "mailbox",
      "haystack",
      "cart",
      "gate",
      "dog_bow",
      "water_can",
      "Hoe",
      "Hoe_1",
      "fisshingrod",
      "Bucket_5",
      "pond_1",
      "pond_2",
      "Bridge-wooden-lighter",
      "Bridge-wooden-lighter_1",
      "dock_wide",
      "lantern_1",
      "lantern_2",
      "lantern_3",
      "lantern_4",
      "lantern_5",
      "lantern_6",
      "lantern_7",
      "lantern_8",
      "lantern_9",
      "lantern_10",
      "lantern_11",
      "lantern_12",
      "lantern_13",
      "lantern_14",
      "lantern_15",
      "lantern_16",
      "lantern_17",
      "lantern_18",
      "lantern_19",
      "rock",
      "Cliff_Rock",
      "Cliff_Rock_1",
      "Cliff_Rock_2",
      "Cliff_Rock_3",
      "tree",
      "tree_1",
      "tree_2",
      "tree_3",
      "beet",
      "beet_1",
      "beet_2",
      "beet_3",
      "beet_4",
      "beet_5",
      "beet_6",
      "beet_7",
      "beet_8",
      "beet_9",
      "BananaTree",
      "BananaTree_1",
      "BananaTree_2",
      "BananaTree_3",
      "BananaTree_4",
      "BananaTree_5",
      "apple",
      "apple_1",
      "apple_2",
      "apple_3",
      "apple_4",
      "apple_5",
      "apple_6",
      "apple_7",
      "apple_8",
      "apple_9",
      "apple_10",
      "apple_11",
      "apple_12",
      "apple_13",
      "apple_14",
      "apple_15",
      "orange",
      "orange_1",
      "orange_2",
      "orange_3",
      "orange_4",
      "orange_5",
      "orange_6",
      "orange_7",
      "orange_8",
      "orange_9",
      "orange_10",
      "orange_11",
      "orange_12",
      "orange_13",
      "orange_14",
      "orange_15",
      "dog",
      "duck",
      "duck_1",
      "duck_2",
      "duck_3",
      "duck_4",
    ];
    this.FALLABLE_OBJECT_NAMES = [
      "Z",
      "I",
      "P",
      "P_1",
      "Y",
      "F",
      "A",
      "R",
      "M",
      "dog_bow",
      "water_can",
      "Hoe",
      "Hoe_1",
      "mailbox",
      "fisshingrod",
      "Bucket_5",
    ];
    this.STATIC_TRIMESH_NAMES = [
      "plane",
      "rock",
      "Cliff_Rock_1",
      "Cliff_Rock_2",
      "Cliff_Rock_3",
      "Cliff_Rock_4",
    ];
    this.STATIC_NOMESH_NAMES = [
      "street",
      "path",
      "path001",
      "path002",
      "path003",
      "river",
      "pond",
      "grass_base_1",
      "pond_3",
      "pond_4",
      "pond_5",
      "pond_6",
    ];

    // XÓA: Các biến lưu trữ trạng thái ban đầu của xe tải đã được loại bỏ
    // vì chức năng reset bây giờ là tải lại toàn bộ game, không cần "soft reset" nữa.
    // this.initialTruckPosition = new THREE.Vector3();
    // this.initialTruckQuaternion = new THREE.Quaternion();
  }

  // THAY ĐỔI: Hàm `loadAssets` giờ đây nhận `vehicleOptions` từ `main.js`
  async loadAssets(vehicleOptions) {
    // THÊM: Tạo một đối tượng options mặc định phòng trường hợp không có lựa chọn nào được truyền vào.
    const options = vehicleOptions || {
      type: "Truck",
      color: "#ff69b4", // Màu hồng mặc định như file cũ
      texture: null,
    };

    // THAY ĐỔI: Truyền `options` vào `loadTruck`
    const truckLoadPromise = this.loadTruck(options);
    const farmLoadPromise = this.loadFarm();

    await Promise.all([truckLoadPromise, farmLoadPromise]);
    this.updateDebugModeVisuals();

    return {
      truckMesh: this.truckMesh,
      gltfObjectsMap: this.gltfObjectsMap,
      truckColliderHandle: this.truckColliderHandle,
      frontWheelLGroup: this.frontWheelLGroup,
      frontWheelRGroup: this.frontWheelRGroup,
      wheelLMesh: this.wheelLMesh,
      wheelRMesh: this.wheelRMesh,
      backWheelsMesh: this.backWheelsMesh,
    };
  }

  update(delta) {
    this.mixers.forEach((mixer) => mixer.update(delta));
  }

  // THAY ĐỔI LỚN: Hàm `loadTruck` không còn cứng nữa mà đã được linh hoạt hóa.
  // - Nhận `vehicleOptions` làm tham số.
  // - Tải model và áp dụng tùy chỉnh dựa trên lựa chọn của người dùng.
  async loadTruck(vehicleOptions) {
    return new Promise((resolve, reject) => {
      // THAY ĐỔI: Đường dẫn model được tạo động dựa trên `vehicleOptions.type`.
      const modelPath = `assets/models/${vehicleOptions.type}.glb`;
      this.loader.load(
        modelPath,
        (gltf) => {
          this.truckMesh = gltf.scene;
          this.truckMesh.scale.set(1, 1, 1);
          this.truckMesh.position.set(0, 5, 0);
          this.scene.add(this.truckMesh);
          this.truckMesh.visible = true;
          const skinMesh = this.truckMesh.getObjectByName("Skin");
          if (skinMesh && skinMesh.isMesh) {
            const material = Array.isArray(skinMesh.material)
              ? skinMesh.material[0]
              : skinMesh.material;

            // THAY ĐỔI: Logic này thay thế cho việc đặt cứng màu hồng trong file old.
            // Nó sẽ ưu tiên dùng texture, nếu không có texture thì dùng màu người dùng chọn.
            if (vehicleOptions.texture) {
              const textureLoader = new THREE.TextureLoader();
              textureLoader.load(
                vehicleOptions.texture,
                (texture) => {
                  material.map = texture;
                  material.color.set(0xffffff); // Set màu trắng để không ảnh hưởng màu của texture
                  material.needsUpdate = true;
                },
                undefined,
                (err) => {
                  console.error("Lỗi tải texture:", err);
                  material.map = null;
                  material.color.set(vehicleOptions.color); // Nếu lỗi thì dùng màu đã chọn
                  material.needsUpdate = true;
                }
              );
            } else {
              material.map = null; // Không có texture thì đảm bảo map là null
              material.color.set(vehicleOptions.color); // Áp dụng màu đã chọn
              material.needsUpdate = true;
            }
          } else {
            console.warn(
              `Không tìm thấy mesh 'Skin' trong ${vehicleOptions.type}`
            );
          }

          // Các logic phía dưới về traverse, tìm bánh xe, tạo physics body vẫn giữ nguyên
          this.truckMesh.traverse((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.isMesh) {
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];
              materials.forEach((mat) => {
                if (mat) mat.transparent = true;
                mat.needsUpdate = true;
              });
            }
          });
          if (isNaN(this.truckMesh.quaternion.x))
            this.truckMesh.quaternion.set(0, 0, 0, 1);
          this.truckMesh.quaternion.normalize();
          this.truckMesh.traverse((child) => {
            if (child.isObject3D) {
              switch (child.name) {
                case "FrontWheel_L":
                  this.frontWheelLGroup = child;
                  child.traverse((c) => {
                    if (c.isMesh && c.name === "Wheel_L") this.wheelLMesh = c;
                  });
                  break;
                case "FrontWheel_R":
                  this.frontWheelRGroup = child;
                  child.traverse((c) => {
                    if (c.isMesh && c.name === "Wheel_R") this.wheelRMesh = c;
                  });
                  break;
                case "BackWheels":
                  this.backWheelsMesh = child;
                  break;
              }
            }
          });
          const truckHalfExtents = new this.physicsManager.RAPIER.Vector3(
            1.2,
            0.8,
            2.5
          );
          const { rigidBody, collider, debugMesh } =
            this.physicsManager.createBox({
              position: this.truckMesh.position,
              quaternion: this.truckMesh.quaternion,
              halfExtents: truckHalfExtents,
              isDynamic: true,
              friction: 1,
              restitution: 0.1,
              linearDamping: 0.05,
              angularDamping: 0.2,
              debugColor: 0xff00ff,
            });
          this.truckRigidBody = rigidBody;
          this.truckColliderHandle = collider.handle;
          this.physicsManager.setTruckPhysics(
            this.truckMesh,
            rigidBody,
            collider,
            debugMesh
          );
          resolve();
        },
        undefined,
        (error) => {
          console.error(`Lỗi tải mô hình xe: ${modelPath}`, error);
          reject(error);
        }
      );
    });
  }

  // Logic hàm loadFarm không thay đổi so với file old
  async loadFarm() {
    return new Promise((resolve, reject) => {
      this.loader.load(
        "assets/models/Map_Farm.glb",
        (gltf) => {
          const farmScene = gltf.scene;
          farmScene.position.set(0, 1, 0);
          farmScene.updateMatrixWorld(true);
          this.scene.add(farmScene);
          const mixer = new THREE.AnimationMixer(farmScene);
          this.mixers.push(mixer);
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.loop = THREE.LoopRepeat;
            action.play();
          });
          farmScene.children.forEach((parentObject) => {
            if (this.STATIC_NOMESH_NAMES.includes(parentObject.name)) return;
            parentObject.traverse((obj) => {
              if (obj.isMesh) {
                obj.visible = true;
                obj.castShadow = true;
                obj.receiveShadow = true;
                const materials = Array.isArray(obj.material)
                  ? obj.material
                  : [obj.material];
                materials.forEach((mat) => {
                  if (mat) {
                    mat.transparent = true;
                    mat.opacity = 1.0;
                    mat.needsUpdate = true;
                  }
                });
              }
            });
            const initialWorldPosition = new THREE.Vector3();
            const initialWorldQuaternion = new THREE.Quaternion();
            parentObject.getWorldPosition(initialWorldPosition);
            parentObject.getWorldQuaternion(initialWorldQuaternion);
            const isTrimeshObject = this.TRIMESH_PARENT_NAMES.includes(
              parentObject.name
            );
            let objectType;
            if (isTrimeshObject) {
              const meshesInGroup = [];
              parentObject.traverse((child) => {
                if (child.isMesh) meshesInGroup.push(child);
              });
              if (meshesInGroup.length === 0) return;
              const { rigidBody, debugMesh } =
                this.physicsManager.createTrimesh({
                  meshes: meshesInGroup,
                  position: initialWorldPosition,
                  quaternion: initialWorldQuaternion,
                  friction: 0.9,
                  restitution: 0.1,
                  debugColor: 0xffa500,
                  isDynamic: this.FALLABLE_OBJECT_NAMES.includes(
                    parentObject.name
                  ),
                });
              if (this.FALLABLE_OBJECT_NAMES.includes(parentObject.name)) {
                objectType = "fallable";
                rigidBody.setBodyType(
                  this.physicsManager.RAPIER.RigidBodyType.Fixed,
                  true
                );
              } else if (
                this.STATIC_TRIMESH_NAMES.includes(parentObject.name)
              ) {
                objectType = "static_trimesh";
              } else {
                objectType = "unknown_trimesh_static";
              }
              this.gltfObjectsMap.set(rigidBody.handle, {
                mesh: parentObject,
                rigidBody: rigidBody,
                debugMesh: debugMesh,
                type: objectType,
              });
              this.scene.add(debugMesh);
            } else {
              const boundingBox = new THREE.Box3().setFromObject(
                parentObject,
                true
              );
              const size = new THREE.Vector3();
              boundingBox.getSize(size);
              const center = new THREE.Vector3();
              boundingBox.getCenter(center);
              const { rigidBody, collider, debugMesh } =
                this.physicsManager.createBox({
                  position: center,
                  quaternion: initialWorldQuaternion,
                  halfExtents: new THREE.Vector3(
                    size.x / 2,
                    size.y / 2,
                    size.z / 2
                  ),
                  isDynamic: false,
                  friction: 0.9,
                  restitution: 0.1,
                  debugColor: 0x00ff00,
                });
              objectType = "static_cuboid";
              this.gltfObjectsMap.set(rigidBody.handle, {
                mesh: parentObject,
                rigidBody: rigidBody,
                debugMesh: debugMesh,
                type: objectType,
              });
              this.scene.add(debugMesh);
            }
          });
          resolve();
        },
        undefined,
        (error) => {
          console.error("Lỗi khi tải mô hình Farm.glb:", error);
          reject(error);
        }
      );
    });
  }

  // Các hàm toggleDebugMode và updateDebugModeVisuals không có thay đổi đáng kể
  toggleDebugMode() {
    this.isDebugMode = !this.isDebugMode;
    console.log(`Chế độ Debug: ${this.isDebugMode ? "BẬT" : "TẮT"}`);
    this.updateDebugModeVisuals();
  }
  updateDebugModeVisuals() {
    if (this.truckMesh && this.physicsManager.truckInfo.debugMesh) {
      this.truckMesh.traverse((child) => {
        if (child.isMesh) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            if (mat) {
              mat.opacity = this.isDebugMode ? 0.3 : 1.0;
              mat.needsUpdate = true;
            }
          });
        }
      });
      this.physicsManager.truckInfo.debugMesh.visible = this.isDebugMode;
    }
    this.physicsManager.testObjects.forEach((item) => {
      if (item.mesh) {
        const materials = Array.isArray(item.mesh.material)
          ? item.mesh.material
          : [item.mesh.material];
        materials.forEach((mat) => {
          if (mat) {
            mat.opacity = this.isDebugMode ? 0.3 : 1.0;
            mat.needsUpdate = true;
          }
        });
      }
    });
    this.gltfObjectsMap.forEach((item) => {
      if (item.mesh) {
        item.mesh.traverse((child) => {
          if (child.isMesh) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((mat) => {
              if (mat) {
                mat.opacity = this.isDebugMode ? 0.3 : 1.0;
                mat.needsUpdate = true;
              }
            });
          }
        });
      }
    });
    this.physicsManager.debugVisuals.forEach((item) => {
      if (item.debugObject) {
        item.debugObject.visible = this.isDebugMode;
      }
    });
  }
}
