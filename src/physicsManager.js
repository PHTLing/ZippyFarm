import * as THREE from "three";

export class PhysicsManager {
  constructor(RAPIER_LIB, soundManager) {
    this.RAPIER = RAPIER_LIB;
    this.world = null;
    this.eventQueue = null;
    this.debugVisuals = [];
    this.gltfObjectsMap = null; // Sẽ được gán từ SceneManager
    this.truckInfo = {
      mesh: null,
      rigidBody: null,
      collider: null,
      debugMesh: null,
    }; // Thông tin xe tải
    this.testObjects = []; // Mảng để lưu trữ các đối tượng test từ ObjectFactory
    this.soundManager = soundManager;

    this.bounceStrength = 0; // Độ mạnh của lực văng
    this.impactThreshold = 5;

    // Temporary objects for calculations in animate loop to avoid re-creation
    this.tempMatrix4 = new THREE.Matrix4();
    this.tempVector3 = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
  }

  async setupWorld() {
    await this.RAPIER.init();
    const gravity = { x: 0.0, y: -9.82, z: 0.0 };
    this.world = new this.RAPIER.World(gravity);
    this.eventQueue = new this.RAPIER.EventQueue(true);

    // Mặt phẳng nền (Ground)
    const groundColliderDesc = this.RAPIER.ColliderDesc.cuboid(0, 0.05, 0)
      .setTranslation(0, -0.05, 0)
      .setFriction(0.9)
      .setRestitution(0.0)
      .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    const groundCollider = this.world.createCollider(groundColliderDesc);

    // Debug visual cho mặt đất (có thể được thêm vào scene bởi SceneManager)
    const groundDebug = new THREE.Mesh(
      new THREE.BoxGeometry(0, 0.1, 0),
      new THREE.MeshBasicMaterial({
        color: 0x8bc34a,
        wireframe: false,
        transparent: true,
        opacity: 1.0,
      })
    );
    groundDebug.position.y = -0.05;
    // groundDebug.visible = false;
    this.debugVisuals.push({
      type: "groundDebug",
      collider: groundCollider,
      debugObject: groundDebug,
    });
    return groundDebug; // Trả về để SceneManager có thể thêm vào scene
  }

  setGltfObjectsMap(map) {
    this.gltfObjectsMap = map;
  }

  setTruckPhysics(mesh, rigidBody, collider, debugMesh) {
    this.truckInfo.mesh = mesh;
    this.truckInfo.rigidBody = rigidBody;
    this.truckInfo.collider = collider; // LƯU TRỮ COLLIDER VÀO TRUCKINFO
    this.truckInfo.debugMesh = debugMesh;

    debugMesh.visible = false;
    this.debugVisuals.push({
      type: "truckDebug",
      rigidBody: rigidBody,
      collider: collider, // Sử dụng collider đã được truyền vào
      debugObject: debugMesh,
    });
  }

  getTruckRigidBody() {
    return this.truckInfo.rigidBody;
  }

  getTruckColliderHandle() {
    return this.truckInfo.collider.handle;
  }

  createBox(options) {
    const {
      position,
      quaternion,
      halfExtents,
      isDynamic,
      friction,
      restitution,
      linearDamping,
      angularDamping,
      debugColor,
      gravityScale,
      useCCD, // Thêm `useCCD` vào danh sách tùy chọn
    } = options; //* gravityScale không sử dụng trong RAPIER, nhưng có thể dùng để điều chỉnh lực hấp dẫn nếu cần */

    const rigidBodyDesc = isDynamic
      ? this.RAPIER.RigidBodyDesc.dynamic()
      : this.RAPIER.RigidBodyDesc.fixed();

    if (linearDamping !== undefined)
      rigidBodyDesc.setLinearDamping(linearDamping);
    if (angularDamping !== undefined)
      rigidBodyDesc.setAngularDamping(angularDamping);

    // Tăng trọng lực tác động lên vật thể nếu được chỉ định
    if (gravityScale !== undefined) {
      rigidBodyDesc.setGravityScale(gravityScale);
    }

    // Sử dụng CCD (Continuous Collision Detection) nếu được chỉ định
    if (useCCD) {
      rigidBodyDesc.setCcdEnabled(true);
    }

    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    if (quaternion) {
      rigidBodyDesc.setRotation(
        new this.RAPIER.Quaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        )
      );
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z
    )
      .setFriction(friction)
      .setRestitution(restitution)
      .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const debugGeometry = new THREE.BoxGeometry(
      halfExtents.x * 2,
      halfExtents.y * 2,
      halfExtents.z * 2
    );
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: debugColor,
      wireframe: true,
      transparent: true,
      opacity: 1.0,
    });
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(position);
    if (quaternion) debugMesh.quaternion.copy(quaternion);

    // debugMesh.visible = false;
    this.debugVisuals.push({
      type: "physicsDebug",
      rigidBody: rigidBody,
      collider: collider,
      debugObject: debugMesh,
    });
    // Thêm đối tượng Three.js thực tế vào mảng để cập nhật
    if (options.mesh) {
      // Đảm bảo options.mesh tồn tại trước khi push
      this.testObjects.push({ mesh: options.mesh, rigidBody: rigidBody });
    }
    return { rigidBody, collider, debugMesh };
  }

  createCylinder(options) {
    const {
      position,
      radiusTop,
      radiusBottom,
      height,
      radialSegments,
      isDynamic,
      friction,
      restitution,
      debugColor,
    } = options;

    const rigidBodyDesc = isDynamic
      ? this.RAPIER.RigidBodyDesc.dynamic()
      : this.RAPIER.RigidBodyDesc.fixed();
    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = this.RAPIER.ColliderDesc.cylinder(
      height / 2,
      radiusTop
    )
      .setFriction(friction)
      .setRestitution(restitution)
      .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const debugGeometry = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      radialSegments
    );
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: debugColor,
      wireframe: true,
      transparent: true,
      opacity: 1.0,
    });
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(position);

    debugMesh.visible = false;
    this.debugVisuals.push({
      type: "physicsDebug",
      rigidBody: rigidBody,
      collider: collider,
      debugObject: debugMesh,
    });
    // Thêm đối tượng Three.js thực tế vào mảng để cập nhật
    if (options.mesh) {
      // Đảm bảo options.mesh tồn tại trước khi push
      this.testObjects.push({ mesh: options.mesh, rigidBody: rigidBody });
    }
    return { rigidBody, collider, debugMesh };
  }

  createSphere(options) {
    const { position, radius, isDynamic, friction, restitution, debugColor } =
      options;

    const rigidBodyDesc = isDynamic
      ? this.RAPIER.RigidBodyDesc.dynamic()
      : this.RAPIER.RigidBodyDesc.fixed();
    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = this.RAPIER.ColliderDesc.ball(radius)
      .setFriction(friction)
      .setRestitution(restitution)
      .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const debugGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: debugColor,
      wireframe: true,
      transparent: true,
      opacity: 1.0,
    });
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(position);

    debugMesh.visible = false;
    this.debugVisuals.push({
      type: "physicsDebug",
      rigidBody: rigidBody,
      collider: collider,
      debugObject: debugMesh,
    });
    // THÊM DÒNG NÀY ĐỂ THÊM VÀO testObjects
    if (options.mesh) {
      // Đảm bảo options.mesh tồn tại trước khi push
      this.testObjects.push({ mesh: options.mesh, rigidBody: rigidBody });
    }
    return { rigidBody, collider, debugMesh };
  }

  createTrimesh(options) {
    const {
      meshes,
      position,
      quaternion,
      friction,
      restitution,
      debugColor,
      isDynamic,
    } = options;

    const rigidBodyDesc = isDynamic
      ? this.RAPIER.RigidBodyDesc.dynamic()
      : this.RAPIER.RigidBodyDesc.fixed();
    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    if (quaternion) {
      rigidBodyDesc.setRotation(
        new this.RAPIER.Quaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        )
      );
    }
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const collidersForCompound = [];
    let combinedDebugVertices = [];
    let combinedDebugIndices = [];
    let debugVertexOffset = 0;

    const rigidBodyInverseWorldMatrix = new THREE.Matrix4()
      .compose(position, quaternion, new THREE.Vector3(1, 1, 1))
      .invert();

    meshes.forEach((meshChild) => {
      if (
        !meshChild.geometry.attributes.position ||
        !meshChild.geometry.index
      ) {
        return;
      }
      const positions = meshChild.geometry.attributes.position.array;
      const indices = meshChild.geometry.index.array;

      const tempPos = new THREE.Vector3();
      const transformedLocalVertices = [];

      for (let i = 0; i < positions.length; i += 3) {
        tempPos.set(positions[i], positions[i + 1], positions[i + 2]);
        tempPos.applyMatrix4(meshChild.matrixWorld);
        tempPos.applyMatrix4(rigidBodyInverseWorldMatrix);
        transformedLocalVertices.push(tempPos.x, tempPos.y, tempPos.z);

        combinedDebugVertices.push(tempPos.x, tempPos.y, tempPos.z);
      }

      const trimeshColliderDesc = this.RAPIER.ColliderDesc.trimesh(
        new Float32Array(transformedLocalVertices),
        new Uint32Array(indices)
      )
        .setFriction(friction)
        .setRestitution(restitution)
        .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
      collidersForCompound.push(trimeshColliderDesc);

      for (let i = 0; i < indices.length; i++) {
        combinedDebugIndices.push(indices[i] + debugVertexOffset);
      }
      debugVertexOffset += positions.length / 3;
    });

    collidersForCompound.forEach((cDesc) =>
      this.world.createCollider(cDesc, rigidBody)
    );

    const debugGeometry = new THREE.BufferGeometry();
    debugGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        new Float32Array(combinedDebugVertices),
        3
      )
    );
    debugGeometry.setIndex(
      new THREE.Uint32BufferAttribute(new Uint32Array(combinedDebugIndices), 1)
    );
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: debugColor,
      wireframe: true,
      transparent: 1.0,
    });

    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(position);
    if (quaternion) debugMesh.quaternion.copy(quaternion);

    // debugMesh.visible = false;
    this.debugVisuals.push({
      type: "physicsDebug",
      rigidBody: rigidBody,
      collider: null, // No single collider reference for compound
      debugObject: debugMesh,
    });
    return { rigidBody, debugMesh };
  }

  updatePhysics() {
    if (!this.world) return;
    this.world.step(this.eventQueue);
    this.handleCollisionEvents();
  }

  handleCollisionEvents() {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return; // Chỉ xử lý khi va chạm bắt đầu

      const truckColliderHandle = this.truckInfo.collider
        ? this.truckInfo.collider.handle
        : null;
      let truckIsColliding = false;
      let otherColliderHandle = null;

      if (
        truckColliderHandle &&
        (handle1 === truckColliderHandle || handle2 === truckColliderHandle)
      ) {
        truckIsColliding = true;
        otherColliderHandle =
          handle1 === truckColliderHandle ? handle2 : handle1;
      }

      if (truckIsColliding && otherColliderHandle !== null) {
        const otherCollider = this.world.getCollider(otherColliderHandle);
        if (!otherCollider) {
          console.warn("Collider khác không tồn tại.");
          return;
        }
        const otherRigidBody = otherCollider.parent();

        // LẤY VẬN TỐC HIỆN TẠI CỦA XE TẢI
        const truckLinvel = this.truckInfo.rigidBody.linvel();
        const truckSpeed = Math.sqrt(
          truckLinvel.x * truckLinvel.x +
            truckLinvel.y * truckLinvel.y +
            truckLinvel.z * truckLinvel.z
        );
        // console.log(truckSpeed)

        // CHỈ PHÁT ÂM THANH NẾU VẬN TỐC ĐỦ LỚN
        if (truckSpeed < this.impactThreshold) {
          return; // Bỏ qua va chạm nếu vận tốc quá nhỏ
        }

        // Kiểm tra xem otherRigidBody có phải là một trong các testObjects không
        const isTestObject = this.testObjects.some(
          (obj) => obj.rigidBody === otherRigidBody
        );

        let objectInfo = null;
        if (this.gltfObjectsMap) {
          objectInfo = this.gltfObjectsMap.get(otherRigidBody.handle);
        }

        // Xử lý va chạm với các đối tượng GLTF
        if (objectInfo) {
          const objectName = objectInfo.mesh.name;
          if (
            objectInfo.type === "fallable" &&
            otherRigidBody.bodyType() === this.RAPIER.RigidBodyType.Fixed
          ) {
            console.log(
              `VA CHẠM: Xe tải đâm vào '${objectName}'. Chuyển vật thể từ TĨNH sang ĐỘNG.`
            );
            otherRigidBody.setBodyType(this.RAPIER.RigidBodyType.Dynamic, true);
            if (objectInfo.debugMesh && objectInfo.debugMesh.material) {
              objectInfo.debugMesh.material.color.set(0xff0000); // Đổi màu debug sang đỏ
            }
            this.soundManager.playCollisionSound();
          } else if (
            objectInfo.type === "static_trimesh" ||
            objectInfo.type === "static_cuboid"
          ) {
            console.log(
              `VA CHẠM: Xe tải đâm vào vật thể TĨNH LỚN '${objectName}'. Áp dụng lực văng.`
            );
            const truckPosition = this.truckInfo.rigidBody.translation();
            const otherObjectPosition = otherRigidBody.translation();

            if (objectName !== "plane") {
              this.soundManager.playCollisionSound();
            }

            const bounceDirection = new this.RAPIER.Vector3(
              truckPosition.x - otherObjectPosition.x,
              0, // Bỏ qua trục Y để chỉ văng ngang
              truckPosition.z - otherObjectPosition.z
            );
            bounceDirection.normalize();

            const impulse = new this.RAPIER.Vector3(
              bounceDirection.x * this.bounceStrength,
              0,
              bounceDirection.z * this.bounceStrength
            );
            this.truckInfo.rigidBody.applyImpulse(impulse, true);
          } else {
            // this.soundManager.playCollisionSound();
          }
        }
        // Xử lý va chạm với các đối tượng test (hộp, trụ, cầu)
        else if (isTestObject) {
          // Nếu là đối tượng test và nó là quả cầu, áp dụng lực nhỏ để chúng lăn
          if (otherCollider.shapeType === this.RAPIER.ShapeType.Ball) {
            // Kiểm tra loại hình dạng là Ball
            console.log(`VA CHẠM: Xe tải đâm vào đối tượng test là CẦU.`);
            const truckLinvel = this.truckInfo.rigidBody.linvel();
            const impactForce = new this.RAPIER.Vector3(
              truckLinvel.x * 0.1,
              0,
              truckLinvel.z * 0.1
            ); // Lực nhỏ dựa trên vận tốc xe tải
            otherRigidBody.applyImpulse(impactForce, true);
            this.soundManager.playCollisionSound();
          } else {
            console.log(`VA CHẠM: Xe tải đâm vào đối tượng test (hộp/trụ).`);
            this.soundManager.playCollisionSound();
          }
        }
      }
    });
  }

  updateThreeJSObjects() {
    // Đồng bộ vị trí và góc quay của xe tải
    if (this.truckInfo.mesh && this.truckInfo.rigidBody) {
      const position = this.truckInfo.rigidBody.translation();
      const rotation = this.truckInfo.rigidBody.rotation();
      this.truckInfo.mesh.position.set(position.x, position.y, position.z);
      this.truckInfo.mesh.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
      );
      if (this.truckInfo.debugMesh) {
        this.truckInfo.debugMesh.position.copy(this.truckInfo.mesh.position);
        this.truckInfo.debugMesh.quaternion.copy(
          this.truckInfo.mesh.quaternion
        );
      }
    }

    // Đồng bộ vị trí và góc quay của TẤT CẢ debug meshes
    this.debugVisuals.forEach((item) => {
      if (item.rigidBody) {
        const position = item.rigidBody.translation();
        const rotation = item.rigidBody.rotation();
        item.debugObject.position.set(position.x, position.y, position.z);
        item.debugObject.quaternion.set(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w
        );
      } else if (item.collider) {
        // Đối với các collider không có rigid body riêng (ví dụ: ground)
        const position = item.collider.translation();
        const rotation = item.collider.rotation();
        item.debugObject.position.set(position.x, position.y, position.z);
        item.debugObject.quaternion.set(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w
        );
      }
    });

    // QUAN TRỌNG: Đồng bộ vị trí và góc quay cho các ĐỐI TƯỢNG 3D GLTF thực tế
    if (this.gltfObjectsMap) {
      this.gltfObjectsMap.forEach((item) => {
        // CHỈ cập nhật mesh nếu rigid body là DYNAMIC
        if (item.rigidBody.bodyType() === this.RAPIER.RigidBodyType.Dynamic) {
          const rigidBodyWorldPosition = item.rigidBody.translation();
          const rigidBodyWorldQuaternion = new THREE.Quaternion(
            item.rigidBody.rotation().x,
            item.rigidBody.rotation().y,
            item.rigidBody.rotation().z,
            item.rigidBody.rotation().w
          );

          const parent = item.mesh.parent;
          parent.updateMatrixWorld(true);

          this.tempMatrix4.copy(parent.matrixWorld).invert();

          this.tempVector3.set(
            rigidBodyWorldPosition.x,
            rigidBodyWorldPosition.y,
            rigidBodyWorldPosition.z
          );
          this.tempVector3.applyMatrix4(this.tempMatrix4);
          item.mesh.position.copy(this.tempVector3);

          parent.getWorldQuaternion(this.tempQuaternion);
          this.tempQuaternion.invert();
          this.tempQuaternion.multiply(rigidBodyWorldQuaternion);
          item.mesh.quaternion.copy(this.tempQuaternion);
        }
      });
    }

    // Cập nhật vị trí và góc quay cho các đối tượng test (hộp, cầu, trụ)
    this.testObjects.forEach((item) => {
      if (item.mesh && item.rigidBody) {
        const position = item.rigidBody.translation();
        const rotation = item.rigidBody.rotation();
        item.mesh.position.set(position.x, position.y, position.z);
        item.mesh.quaternion.set(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w
        );
      }
    });
  }

  /**
   * Trả về tất cả các debug visual meshes.
   * @returns {Array<THREE.Mesh>}
   */
  getAllDebugMeshes() {
    const debugMeshes = [];
    this.debugVisuals.forEach((item) => {
      if (item.debugObject) {
        debugMeshes.push(item.debugObject);
      }
    });
    // Thêm debug mesh của xe tải nếu có
    if (this.truckInfo.debugMesh) {
      debugMeshes.push(this.truckInfo.debugMesh);
    }
    return debugMeshes;
  }

  /**
   * Trả về tất cả các mesh của các đối tượng GLTF và test objects.
   * @returns {Array<THREE.Mesh>}
   */
  getAllRenderMeshes() {
    const renderMeshes = [];
    // Lấy mesh của xe tải
    if (this.truckInfo.mesh) {
      renderMeshes.push(this.truckInfo.mesh);
    }
    // Lấy mesh từ gltfObjectsMap
    if (this.gltfObjectsMap) {
      this.gltfObjectsMap.forEach((item) => {
        if (item.mesh) {
          renderMeshes.push(item.mesh);
        }
      });
    }
    // Lấy mesh từ testObjects
    if (this.testObjects) {
      this.testObjects.forEach((item) => {
        if (item.mesh) {
          renderMeshes.push(item.mesh);
        }
      });
    }
    return renderMeshes;
  }
}
