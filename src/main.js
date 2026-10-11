/**
 * main.js
 * Main entry point and orchestrator for Nürburgring Pixel 3D Racing Game.
 * Connects WebGL renderer, Catmull-Rom Nordschleife track, realistic drivetrain physics,
 * retro low-poly car model, Web Audio engine, pixel post-processor, and arcade HUD.
 */

import * as THREE from 'three';
import { AudioEngine } from './audio/AudioEngine.js';
import { CarPhysics } from './physics/CarPhysics.js';
import { NurburgringTrack } from './track/NurburgringTrack.js';
import { CarModel } from './car/CarModel.js';
import { PixelPostProcessor } from './rendering/PixelPostProcessor.js';
import { HUD } from './ui/HUD.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Subsystems
    this.audio = new AudioEngine();
    this.physics = new CarPhysics();
    this.track = null;
    this.carModel = null;
    this.postProcessor = null;
    this.hud = null;

    // Input States
    this.keys = {
      KeyW: false,
      KeyS: false,
      KeyA: false,
      KeyD: false,
      ShiftLeft: false,
      ShiftRight: false,
      ArrowUp: false,
      ArrowDown: false
    };

    // Camera views
    // 0: Classic 3rd person chase, 1: Close chase, 2: Hood / Bumper cam
    this.cameraMode = 0;
    this.cameraTargetPos = new THREE.Vector3();
    this.cameraLookAt = new THREE.Vector3();

    // Timing
    this.lastFrameTime = performance.now();
    this.isRunning = false;

    this.init();
  }

  init() {
    // 1. Scene & Atmosphere (Green Hell Eifel Sky & Fog)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da4c2); // Moody sky blue
    this.scene.fog = new THREE.FogExp2(0x7da4c2, 0.0012);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.2,
      2500
    );

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // Keep crisp pixel edges
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1); // Point sampling handles pixel styling
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5dd, 1.25);
    dirLight.position.set(300, 500, 200);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1200;
    const shadowD = 250;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    this.scene.add(dirLight);

    // 5. Build Nürburgring Track
    this.track = new NurburgringTrack(this.scene);
    this.track.buildTrack();

    // 6. Spawn Car & Initialize Physics
    this.carModel = new CarModel(this.scene);
    this.carModel.buildCar();

    const spawn = this.track.getSpawnTransform();
    this.physics.resetTo(spawn.x, spawn.y, spawn.z, spawn.heading);

    // 7. Post-Processor (Retro Pixel Shading)
    this.postProcessor = new PixelPostProcessor(this.renderer, this.scene, this.camera);
    this.postProcessor.setPixelScale(1.5);

    // 8. HUD & UI Manager
    this.hud = new HUD(this.track);

    // Hook physics audio events
    this.physics.onShift = (newGear) => {
      this.audio.playGearShiftSound();
    };
    this.physics.onRevLimitPop = () => {
      this.audio.playExhaustPop();
    };

    // 9. Event Listeners
    this.bindEvents();

    // 10. Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postProcessor.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW') this.keys.KeyW = true;
      if (e.code === 'KeyS') this.keys.KeyS = true;
      if (e.code === 'KeyA') this.keys.KeyA = true;
      if (e.code === 'KeyD') this.keys.KeyD = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.ShiftLeft = true;
      }

      // Manual Gear Shifting
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        this.physics.shiftUp();
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        this.physics.shiftDown();
      }

      // Camera switch
      if (e.code === 'KeyC') {
        this.cycleCamera();
      }

      // Reset car
      if (e.code === 'KeyR') {
        this.resetCarToTrack();
      }

      // Start game on keypress if start overlay active
      if (!this.isRunning) {
        this.startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW') this.keys.KeyW = false;
      if (e.code === 'KeyS') this.keys.KeyS = false;
      if (e.code === 'KeyA') this.keys.KeyA = false;
      if (e.code === 'KeyD') this.keys.KeyD = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.ShiftLeft = false;
      }
    });

    // Start Button
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      const startFromOverlay = (event) => {
        event.preventDefault();
        this.startGame();
      };
      btnStart.addEventListener('click', startFromOverlay);
      btnStart.addEventListener('pointerup', startFromOverlay);
    }
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) {
      // Keep the start screen usable on touch devices and browsers that do
      // not synthesize a click after a pointer interaction.
      startOverlay.addEventListener('pointerup', (event) => {
        if (event.target === startOverlay) {
          this.startGame();
        }
      });
    }

    // Audio Toggle Button
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isUnmuted = this.audio.toggleMute();
        btnAudio.textContent = isUnmuted ? '🔊 音效: 开' : '🔇 音效: 关';
        btnAudio.classList.toggle('active', isUnmuted);
      });
    }

    // Camera Toggle Button
    const btnCamera = document.getElementById('btn-camera-toggle');
    if (btnCamera) {
      btnCamera.addEventListener('click', () => {
        this.cycleCamera();
      });
    }

    // Settings Modal
    const btnSettings = document.getElementById('btn-settings-toggle');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    if (btnSettings && settingsModal) {
      btnSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
      });
    }
    if (btnCloseSettings && settingsModal) {
      btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }
    if (btnSaveSettings && settingsModal) {
      btnSaveSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    // Pixel Scale Selector
    const pixelSelect = document.getElementById('pixel-scale-select');
    if (pixelSelect) {
      pixelSelect.addEventListener('change', (e) => {
        const scale = parseFloat(e.target.value);
        this.postProcessor.setPixelScale(scale);
      });
    }

    // Transmission Selector
    const transSelect = document.getElementById('transmission-select');
    if (transSelect) {
      transSelect.addEventListener('change', (e) => {
        this.physics.isAutoTransmission = e.target.value === 'auto';
      });
    }

    // Scanlines Toggle
    const btnScanlines = document.getElementById('btn-toggle-scanlines');
    const scanlineOverlay = document.getElementById('scanline-overlay');
    if (btnScanlines && scanlineOverlay) {
      btnScanlines.addEventListener('click', () => {
        scanlineOverlay.classList.toggle('active');
        const isActive = scanlineOverlay.classList.contains('active');
        btnScanlines.textContent = isActive ? '开 (ON)' : '关 (OFF)';
        btnScanlines.classList.toggle('active', isActive);
      });
    }

    // Sound Volume Slider
    const volSlider = document.getElementById('sound-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        this.audio.setVolume(parseInt(e.target.value) / 100);
      });
    }
  }

  startGame() {
    this.isRunning = true;
    this.audio.init();
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) {
      startOverlay.classList.add('hidden');
    }
  }

  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    const names = ['第三人称追尾', '贴地高速视角', '引擎盖车头视角'];
    const btn = document.getElementById('btn-camera-toggle');
    if (btn) btn.textContent = `🎥 ${names[this.cameraMode]} [C]`;
  }

  resetCarToTrack() {
    const closest = this.track.getClosestTrackPoint(this.physics.position);
    const p = closest.point;
    const heading = Math.atan2(closest.tangent.x, closest.tangent.z);
    this.physics.resetTo(p.x, p.y + 0.35, p.z, heading);
  }

  updateCamera(dt) {
    const carPos = this.carModel.carGroup.position;
    const heading = this.physics.heading;
    const speed = this.physics.speed;

    // Direction vectors
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    let offsetDist = 7.5;
    let offsetHeight = 3.2;
    let lookAheadDist = 8.0;

    if (this.cameraMode === 0) {
      // Standard Chase Cam
      offsetDist = 7.8 + Math.min(2.5, (speed * 3.6) / 100);
      offsetHeight = 3.2;
      lookAheadDist = 12.0;
    } else if (this.cameraMode === 1) {
      // Low Close Chase Cam
      offsetDist = 5.2;
      offsetHeight = 1.9;
      lookAheadDist = 10.0;
    } else if (this.cameraMode === 2) {
      // Hood / Bumper Cam
      offsetDist = -0.5;
      offsetHeight = 1.25;
      lookAheadDist = 20.0;
    }

    // Ideal camera position behind car
    const targetX = carPos.x - forwardX * offsetDist;
    const targetY = carPos.y + offsetHeight;
    const targetZ = carPos.z - forwardZ * offsetDist;

    // Smooth camera damping
    const lerpFactor = this.cameraMode === 2 ? 0.35 : 0.12;
    this.camera.position.x += (targetX - this.camera.position.x) * (lerpFactor * (dt * 60));
    this.camera.position.y += (targetY - this.camera.position.y) * (lerpFactor * (dt * 60));
    this.camera.position.z += (targetZ - this.camera.position.z) * (lerpFactor * (dt * 60));

    // Look at point ahead of car
    const lookX = carPos.x + forwardX * lookAheadDist;
    const lookY = carPos.y + 1.2;
    const lookZ = carPos.z + forwardZ * lookAheadDist;

    this.camera.lookAt(lookX, lookY, lookZ);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    let dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    if (dt > 0.1) dt = 0.1;

    // Gather Inputs
    const throttle = this.keys.KeyW ? 1.0 : 0.0;
    const brake = this.keys.KeyS ? 1.0 : 0.0;
    let steer = 0.0;
    if (this.keys.KeyA) steer -= 1.0;
    if (this.keys.KeyD) steer += 1.0;
    const handbrake = this.keys.ShiftLeft || this.keys.ShiftRight;

    // 1. Update Physics
    this.physics.update(dt, {
      throttle,
      brake,
      steer,
      handbrake
    });

    // 2. Track Query & Elevation follow
    const trackInfo = this.track.getClosestTrackPoint(this.physics.position);

    // Apply off-track surface friction penalty if driving onto grass
    if (trackInfo.isOffTrack) {
      this.physics.speed *= Math.max(0.2, 1.0 - dt * 0.8);
    }

    // 3. Update Visual Car Model
    this.carModel.update(dt, this.physics, trackInfo);

    // 4. Update Camera
    this.updateCamera(dt);

    // 5. Update Web Audio Engine
    if (this.isRunning) {
      this.audio.update(
        this.physics.rpm,
        this.physics.throttle,
        this.physics.getSpeedKmh(),
        Math.abs(this.physics.lateralSpeed) / 8.0,
        this.physics.isRevLimiting
      );
    }

    // 6. Update HUD
    this.hud.update(this.physics, trackInfo, dt);

    // 7. Render 3D Scene with Pixel Post-Processor
    this.postProcessor.render();
  }
}

// Instantiate game on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
