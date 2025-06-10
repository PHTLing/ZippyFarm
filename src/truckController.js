import * as THREE from 'three';

export class TruckController {
    constructor(
        truckMesh,
        truckRigidBody,
        truckColliderHandle,
        physicsManager,
        frontWheelLGroup,
        frontWheelRGroup,
        wheelLMesh,
        wheelRMesh,
        backWheelsMesh
    ) {
        this.truckMesh = truckMesh;
        this.truckRigidBody = truckRigidBody;
        this.truckColliderHandle = truckColliderHandle;
        this.physicsManager = physicsManager;

        // LƯU TRỮ CÁC THAM CHIẾU BÁNH XE
        this.frontWheelLGroup = frontWheelLGroup; // Group để xoay theo trục Y (bẻ lái)
        this.frontWheelRGroup = frontWheelRGroup; // Group để xoay theo trục Y (bẻ lái)
        this.wheelLMesh = wheelLMesh;             // Mesh để quay theo trục X (tiến/lùi)
        this.wheelRMesh = wheelRMesh;             // Mesh để quay theo trục X (tiến/lùi)
        this.backWheelsMesh = backWheelsMesh;     // Mesh (hoặc Group) để quay theo trục X (tiến/lùi)

        this.truckSpeed = 15;               // Tốc độ tiện tiến của bánh xe
        this.truckRotationSpeed = 2;        // Tốc độ xoay của xe

        this.maxSteerAngle = Math.PI / 6;   // Góc bẻ lái < 30 độ
        this.wheelRotationFactor = 0.5;     // Tốc độ quay của bánh xe khớp với tốc độ xe

        // Temporary objects for calculations to avoid re-creation
        this.tempQuaternion = new THREE.Quaternion();
        this.tempEuler = new THREE.Euler();
    }

    handleMovement(keyboardState) {
        if (!this.truckRigidBody) {
            return;
        }

        const currentRotation = this.truckRigidBody.rotation();
        this.tempQuaternion.set(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(this.tempQuaternion);

        const currentLinVel = this.truckRigidBody.linvel();
        let newLinVelX = currentLinVel.x;
        let newLinVelZ = currentLinVel.z;
        let angVelY = 0; // Vận tốc góc cho xe (yaw)
        let boost = 1;
        let stop = 1;

        if (keyboardState['Space']){stop = 0;}

        let moveSpeed = 0; // Tốc độ thực tế của xe để tính toán quay bánh
        if (keyboardState['ArrowUp'] || keyboardState['KeyW']) {
            if (keyboardState['KeyB']){boost = 1.5;}
            
            newLinVelX = -forwardVector.x * this.truckSpeed * boost * stop;
            newLinVelZ = -forwardVector.z * this.truckSpeed * boost * stop;
            moveSpeed = this.truckSpeed * boost * stop;

            
        } else if (keyboardState['ArrowDown'] || keyboardState['KeyS']) {
            newLinVelX = forwardVector.x * this.truckSpeed * 0.5 * stop;
            newLinVelZ = forwardVector.z * this.truckSpeed * 0.5 * stop;
            moveSpeed = -this.truckSpeed * stop; // Tốc độ âm khi lùi
        } else {
            // Giảm dần vận tốc ngang khi không có input
            newLinVelX = currentLinVel.x * 0.9;
            newLinVelZ = currentLinVel.z * 0.9;
            // Tính toán tốc độ hiện tại để bánh xe vẫn quay khi trôi
            moveSpeed = Math.sqrt(currentLinVel.x * currentLinVel.x + currentLinVel.z * currentLinVel.z);
            // Giữ dấu của tốc độ để biết đang tiến hay lùi
            const dotForward = forwardVector.dot(new THREE.Vector3(currentLinVel.x, 0, currentLinVel.z));
            if (dotForward > 0) moveSpeed *= -1; // Nếu vận tốc cùng chiều forward là lùi
        }

        let steerInput = 0; // -1 cho trái, 1 cho phải, 0 không rẽ
        if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
            steerInput = 1; // Rẽ trái
        } else if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
            steerInput = -1; // Rẽ phải
        }


        if ((keyboardState['ArrowUp'] && keyboardState['ArrowLeft']) || (keyboardState['KeyW'] && keyboardState['KeyA'])) {
            angVelY = this.truckRotationSpeed* boost* stop;
            
        } else if ((keyboardState['ArrowUp'] && keyboardState['ArrowRight']) || (keyboardState['KeyW'] && keyboardState['KeyD'])) {
            angVelY = -this.truckRotationSpeed* boost* stop;
            
        }


        if ((keyboardState['ArrowDown'] && keyboardState['ArrowLeft']) || (keyboardState['KeyS'] && keyboardState['KeyA']))  {
            angVelY = -this.truckRotationSpeed* boost* stop;
            
        } else if ((keyboardState['ArrowDown'] && keyboardState['ArrowRight']) || (keyboardState['KeyS'] && keyboardState['KeyD'])) {
            angVelY = this.truckRotationSpeed* boost* stop;
            
        }


        // Đặt vận tốc tuyến tính, giữ nguyên vận tốc trục Y để trọng lực hoạt động
        this.truckRigidBody.setLinvel({ x: newLinVelX, y: currentLinVel.y, z: newLinVelZ }, true);
        this.truckRigidBody.setAngvel({ x: 0, y: angVelY, z: 0 }, true);

        // KỸ THUẬT CHỐNG NGHIÊNG: Buộc xe tải luôn thẳng đứng
        const truckQuat = this.truckRigidBody.rotation();
        this.tempQuaternion.set(truckQuat.x, truckQuat.y, truckQuat.z, truckQuat.w);

        this.tempEuler.setFromQuaternion(this.tempQuaternion, 'YXZ');
        const yaw = this.tempEuler.y;

        this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        this.truckRigidBody.setRotation(new this.physicsManager.RAPIER.Quaternion(this.tempQuaternion.x, this.tempQuaternion.y, this.tempQuaternion.z, this.tempQuaternion.w), true);

        // === LOGIC XOAY VÀ BẺ LÁI BÁNH XE ===
        // 1. Xoay bánh xe (tiến/lùi)
        const wheelRotationAmount = (moveSpeed * this.wheelRotationFactor) / (2 * Math.PI) * 0.1; // 0.1 là delta time nhỏ

        if (this.wheelLMesh) {
            this.wheelLMesh.rotation.x += wheelRotationAmount;
        }
        if (this.wheelRMesh) {
            this.wheelRMesh.rotation.x += wheelRotationAmount;
        }
        if (this.backWheelsMesh) {
            // Đối với BackWheels, nếu nó là một Group chứa nhiều bánh xe,
            // rotation.x sẽ xoay tất cả các bánh xe con.
            this.backWheelsMesh.rotation.x += wheelRotationAmount;
        }

        // 2. Bẻ lái bánh trước (trái/phải)
        // Lerp angle để chuyển động bẻ lái mượt mà hơn
        const targetSteerAngle = steerInput * this.maxSteerAngle;
        const currentSteerAngleL = this.frontWheelLGroup ? this.frontWheelLGroup.rotation.y : 0;
        const currentSteerAngleR = this.frontWheelRGroup ? this.frontWheelRGroup.rotation.y : 0;

        const lerpFactor = 0.1; // Tùy chỉnh độ mượt khi bẻ lái

        if (this.frontWheelLGroup) {
            this.frontWheelLGroup.rotation.y = THREE.MathUtils.lerp(currentSteerAngleL, targetSteerAngle, lerpFactor);
        }
        if (this.frontWheelRGroup) {
            this.frontWheelRGroup.rotation.y = THREE.MathUtils.lerp(currentSteerAngleR, targetSteerAngle, lerpFactor);
        }
        // =====================================
    }

    resetMovement() {
        if (this.truckRigidBody && this.physicsManager && this.physicsManager.RAPIER) {
            this.truckRigidBody.setLinvel(new this.physicsManager.RAPIER.Vector3(0, 0, 0), true);
            this.truckRigidBody.setAngvel(new this.physicsManager.RAPIER.Vector3(0, 0, 0), true);
        }
        // Đặt lại góc lái về 0 khi reset
        if (this.frontWheelLGroup) {
            this.frontWheelLGroup.rotation.y = 0;
        }
        if (this.frontWheelRGroup) {
            this.frontWheelRGroup.rotation.y = 0;
        }
        
    }
}