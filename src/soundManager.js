import * as THREE from 'three';

export class SoundManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);
        this.audioLoader = new THREE.AudioLoader();

        // Khai báo các biến cho từng loại âm thanh
        this.backgroundMusic = null;
        this.brakeSound = null;
        this.hornClickSound = null;
        this.hornPressSound = null;
        this.engineSound = null;
        this.collisionSound = null;
    }

    async loadSounds() {
        // Tải âm thanh nhạc nền
        this.backgroundMusic = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/backgroundMusic.mp3'); 
            this.backgroundMusic.setBuffer(buffer);
            this.backgroundMusic.setLoop(true);
            this.backgroundMusic.setVolume(0.1);
        } catch (error) {
            console.error('Lỗi khi tải âm thanh nhạc nền:', error);
        }

        // Tải âm thanh phanh (brake)
        this.brakeSound = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/brake.mp3'); 
            this.brakeSound.setBuffer(buffer);
            this.brakeSound.setLoop(false);
            this.brakeSound.setVolume(0.5);
        } catch (error) {
            console.error('Lỗi khi tải âm thanh phanh:', error);
        }

        // Tải âm thanh còi (click)
        this.hornClickSound = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/hornClick.MP3'); 
            this.hornClickSound.setBuffer(buffer);
            this.hornClickSound.setLoop(false);
            this.hornClickSound.setVolume(0.5);
        } catch (error) {
            console.error('Lỗi khi tải âm thanh còi (nhấn):', error);
        }

        // Tải âm thanh còi (press)
        this.hornPressSound = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/hornPress.MP3'); 
            this.hornPressSound.setBuffer(buffer);
            this.hornPressSound.setLoop(true);
            this.hornPressSound.setVolume(0.5);
        } catch (error) {
            console.error('Lỗi khi tải âm thanh còi (ấn):', error);
        }

        // Tải âm thanh động cơ
        this.engineSound = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/engine.MP3'); 
            this.engineSound.setBuffer(buffer);
            this.engineSound.setLoop(true);
            this.engineSound.setVolume(0.3); 
        } catch (error) {
            console.error('Lỗi khi tải âm thanh động cơ:', error);
        }

        // Tải âm thanh va chạm
        this.collisionSound = new THREE.Audio(this.listener);
        try {
            const buffer = await this.audioLoader.loadAsync('assets/sounds/collision.mp3'); 
            this.collisionSound.setBuffer(buffer);
            this.collisionSound.setLoop(false);
            this.collisionSound.setVolume(0.5);
        } catch (error) {
            console.error('Lỗi khi tải âm thanh va chạm:', error);
        }
    }

    // Các hàm điều khiển âm thanh riêng biệt
    playBackgroundMusic() {
        if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
            this.backgroundMusic.play();
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            this.backgroundMusic.stop();
        }
    }

    playEngineSound() {
        if (this.engineSound && !this.engineSound.isPlaying) {
            this.engineSound.play();
        }
    }

    stopEngineSound() {
        if (this.engineSound && this.engineSound.isPlaying) {
            this.engineSound.stop();
        }
    }

    playBrakeSound() {
        if (this.brakeSound) {
            if (this.brakeSound.isPlaying) {
                this.brakeSound.stop();
            }
            this.brakeSound.play();
        }
    }

    playHornClickSound() {
        if (this.hornClickSound) {
            if (this.hornClickSound.isPlaying) {
                this.hornClickSound.stop();
            }
            this.hornClickSound.play();
        }
    }

    playHornPressSound() {
        if (this.hornPressSound && !this.hornPressSound.isPlaying) {
            this.hornPressSound.play();
        }
    }

    stopHornPressSound() {
        if (this.hornPressSound && this.hornPressSound.isPlaying) {
            this.hornPressSound.stop();
        }
    }

    playCollisionSound() {
        if (this.collisionSound) {
            if (this.collisionSound.isPlaying) {
                this.collisionSound.stop();
            }
            this.collisionSound.play();
        }
    }

    updateEngineVolumeAndPitch(speed, maxSpeed, volumeBoost = 1) {
        if (this.engineSound) {
            const normalizedSpeed = Math.min(Math.abs(speed) / maxSpeed, 1.0);
            let baseVolume = normalizedSpeed * 0.25;                // Tính toán âm lượng cơ bản
            this.engineSound.setVolume(baseVolume * volumeBoost);   // Áp dụng volumeBoost vào âm lượng
            this.engineSound.setPlaybackRate(0.8 + normalizedSpeed * 0.4);
        }
    }
}