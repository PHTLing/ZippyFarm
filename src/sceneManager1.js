import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

    this.backWheelsMesh = null; // Các hằng số định nghĩa loại đối tượng trong Farm.glb

    this.TRIMESH_PARENT_NAMES = [
      "Nui_01",
      "Cay01",
      "Cay_02",
      "Cay_03",
      "CotDen",
      "plane",
      "Plane",
      "duck",
      "Z",
      "I",
      "P",
      "I",
      "N",
      "G",
      "F",
      "A",
      "R",
      "M",
    ];

    this.FALLABLE_OBJECT_NAMES = [
      "Cay01",
      "Cay_02",
      "Cay_03",
      "CotDen",
      "duck",
      "Z",
      "I",
      "P",
      "I",
      "N",
      "G",
      "F",
      "A",
      "R",
      "M",
    ];

    this.STATIC_TRIMESH_NAMES = ["Nui_01", "plane"]; // Map để lưu trữ tất cả các đối tượng GLTF từ Farm.glb và thông tin vật lý của chúng

    this.gltfObjectsMap = new Map();
  }

  async loadAssets() {
    const truckLoadPromise = this.loadTruck();

    const farmLoadPromise = this.loadFarm();

    await Promise.all([truckLoadPromise, farmLoadPromise]);

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

  async loadTruck() {
    return new Promise((resolve, reject) => {
      this.loader.load(
        "assets/models/Truck.glb",
        (gltf) => {
          this.truckMesh = gltf.scene;

          this.truckMesh.scale.set(2, 2, 2);

          this.truckMesh.position.set(-10, 15, -10);

          this.scene.add(this.truckMesh);

          if (
            isNaN(this.truckMesh.quaternion.x) ||
            isNaN(this.truckMesh.quaternion.y) ||
            isNaN(this.truckMesh.quaternion.z) ||
            isNaN(this.truckMesh.quaternion.w)
          ) {
            console.error(
              "Lỗi nghiêm trọng: truckMesh.quaternion là NaN, đặt lại về quaternion đơn vị."
            );

            this.truckMesh.quaternion.set(0, 0, 0, 1);
          }

          this.truckMesh.quaternion.normalize(); // === TÌM VÀ LƯU TRỮ CÁC PHẦN TỬ BÁNH XE ===

          this.truckMesh.traverse((child) => {
            if (child.isObject3D) {
              switch (child.name) {
                case "FrontWheel_L":
                  this.frontWheelLGroup = child;

                  child.traverse((wheelChild) => {
                    if (wheelChild.isMesh && wheelChild.name === "Wheel_L") {
                      this.wheelLMesh = wheelChild;
                    }
                  });

                  break;

                case "FrontWheel_R":
                  this.frontWheelRGroup = child;

                  child.traverse((wheelChild) => {
                    if (wheelChild.isMesh && wheelChild.name === "Wheel_R") {
                      this.wheelRMesh = wheelChild;
                    }
                  });

                  break;

                case "BackWheels":
                  this.backWheelsMesh = child;

                  break;

                case "Pickup": // Đây là mesh chính của thân xe tải // Không cần lưu trữ Pickup ở đây nếu không có logic riêng
                  break;
              }
            }
          });

          if (
            !this.frontWheelLGroup ||
            !this.frontWheelRGroup ||
            !this.wheelLMesh ||
            !this.wheelRMesh ||
            !this.backWheelsMesh
          ) {
            console.warn(
              "Không tìm thấy tất cả các mesh/group bánh xe cần thiết. Đảm bảo tên trong GLB là chính xác."
            );

            console.log("Found:", {
              frontWheelLGroup: this.frontWheelLGroup?.name,

              frontWheelRGroup: this.frontWheelRGroup?.name,

              wheelLMesh: this.wheelLMesh?.name,

              wheelRMesh: this.wheelRMesh?.name,

              backWheelsMesh: this.backWheelsMesh?.name,
            });
          } // ============================================ // --- THÊM DEBUG BOX CHO XE TẢI (Pickup) --- // Ước lượng kích thước của pickup (thân xe) để tạo collider // Điều chỉnh kích thước này cho phù hợp với model của bạn

          const truckHalfExtents = new this.physicsManager.RAPIER.Vector3(
            1.2,
            0.8,
            2.5
          ); // Điều chỉnh kích thước này!

          const { rigidBody, collider, debugMesh } =
            this.physicsManager.createBox({
              position: this.truckMesh.position,

              quaternion: this.truckMesh.quaternion,

              halfExtents: truckHalfExtents,

              isDynamic: true,

              friction: 1,

              restitution: 0.5,

              linearDamping: 0.05,

              angularDamping: 0.2,

              debugColor: 0xff00ff, // Màu hồng cho thân xe
            });

          this.truckRigidBody = rigidBody;

          this.truckColliderHandle = collider.handle; // Set truck physics trong PhysicsManager, bao gồm cả debugMesh của Pickup

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
          console.error("Lỗi khi tải mô hình xe tải:", error);

          reject(error);
        }
      );
    });
  }

  async loadFarm() {
    return new Promise((resolve, reject) => {
      this.loader.load(
        "assets/models/Map_Farm.glb",
        (gltf) => {
          const farmScene = gltf.scene;

          farmScene.position.set(0, 0, 0);

          farmScene.updateMatrixWorld(true);

          this.scene.add(farmScene);

          farmScene.children.forEach((parentObject) => {
            parentObject.traverse((obj) => {
              if (obj.isMesh) {
                const materials = Array.isArray(obj.material)
                  ? obj.material
                  : [obj.material];

                materials.forEach((mat) => {
                  if (mat) {
                    mat.transparent = true;

                    mat.opacity = 1;

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
                if (child.isMesh) {
                  meshesInGroup.push(child);
                }
              });

              if (meshesInGroup.length === 0) {
                console.warn(
                  `Đối tượng cha '${parentObject.name}' là Trimesh nhưng không có mesh con nào. Bỏ qua.`
                );

                return;
              }

              const { rigidBody, debugMesh } =
                this.physicsManager.createTrimesh({
                  meshes: meshesInGroup,

                  position: initialWorldPosition,

                  quaternion: initialWorldQuaternion,

                  friction: 0.9,

                  restitution: 0.2,

                  debugColor: 0xffa500,

                  isDynamic: this.FALLABLE_OBJECT_NAMES.includes(
                    parentObject.name
                  ), // Cây cối là dynamic, núi là fixed
                });

              if (this.FALLABLE_OBJECT_NAMES.includes(parentObject.name)) {
                objectType = "fallable";

                rigidBody.setBodyType(
                  this.physicsManager.RAPIER.RigidBodyType.Fixed,
                  true
                ); // Ban đầu là Fixed
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

              this.scene.add(debugMesh); // Thêm debug mesh vào scene
            } else {
              // Đây là một đối tượng cuboid (box)

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

                  isDynamic: false, // Mặc định các vật thể khác là static

                  friction: 0.9,

                  restitution: 0.2,

                  debugColor: 0x00ff00,
                });

              objectType = "static_cuboid";

              this.gltfObjectsMap.set(rigidBody.handle, {
                mesh: parentObject,

                rigidBody: rigidBody,

                debugMesh: debugMesh,

                type: objectType,
              });

              this.scene.add(debugMesh); // Thêm debug mesh vào scene
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
}
