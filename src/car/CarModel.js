/**
 * CarModel.js
 * 3D Low-poly sports coupe model with pixel styling, rotating wheels,
 * responsive steering rack, brake light glow, pixel exhaust flames,
 * tire smoke particles, and skidmark rendering.
 */

import * as THREE from 'three';

export class CarModel {
  constructor(scene) {
    this.scene = scene;
    this.carGroup = new THREE.Group();

    // Wheel Meshes
    this.wheelFL = null;
    this.wheelFR = null;
    this.wheelRL = null;
    this.wheelRR = null;

    // Lights
    this.brakeLightMat = null;
    this.headlightMesh = null;
    this.headlightSpot = null;

    // Exhaust emitters & flames
    this.exhaustFlames = [];

    // Particle systems
    this.smokeParticles = [];
    this.smokeGroup = new THREE.Group();

    // Skidmarks
    this.skidmarkPoints = [];
    this.skidmarkLine = null;

    this.wheelRotation = 0;
  }

  buildCar() {
    // Car Body Palette (Pixel Racing GT style: vibrant racing cyan / teal body with black aero)
    const bodyMat = new THREE.MeshLambertMaterial({
      color: 0x00d4ff,
      flatShading: true
    });
    const blackTrimMat = new THREE.MeshLambertMaterial({
      color: 0x121720,
      flatShading: true
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x182838,
      metalness: 0.9,
      roughness: 0.1,
      flatShading: true
    });

    // 1. Main Lower Chassis (Width: 1.9m, Length: 4.4m, Height: 0.55m)
    const chassisGeom = new THREE.BoxGeometry(1.9, 0.45, 4.3);
    const chassis = new THREE.Mesh(chassisGeom, bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.carGroup.add(chassis);

    // Front Bumper & Splitter
    const splitterGeom = new THREE.BoxGeometry(1.95, 0.12, 0.7);
    const splitter = new THREE.Mesh(splitterGeom, blackTrimMat);
    splitter.position.set(0, 0.22, 2.15);
    this.carGroup.add(splitter);

    // Front Hood Slope
    const hoodGeom = new THREE.BoxGeometry(1.8, 0.25, 1.4);
    const hood = new THREE.Mesh(hoodGeom, bodyMat);
    hood.position.set(0, 0.7, 1.25);
    hood.rotation.x = -0.12;
    this.carGroup.add(hood);

    // Cabin / Cockpit Roof
    const cabinGeom = new THREE.BoxGeometry(1.5, 0.52, 1.9);
    const cabin = new THREE.Mesh(cabinGeom, glassMat);
    cabin.position.set(0, 0.95, -0.3);
    this.carGroup.add(cabin);

    // Roof Top
    const roofGeom = new THREE.BoxGeometry(1.4, 0.08, 1.3);
    const roof = new THREE.Mesh(roofGeom, bodyMat);
    roof.position.set(0, 1.23, -0.35);
    this.carGroup.add(roof);

    // Rear Trunk / Deck
    const trunkGeom = new THREE.BoxGeometry(1.8, 0.35, 1.2);
    const trunk = new THREE.Mesh(trunkGeom, bodyMat);
    trunk.position.set(0, 0.65, -1.55);
    this.carGroup.add(trunk);

    // Rear GT Racing Wing / Spoiler
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x111622, flatShading: true });
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.4), wingMat);
    wingBlade.position.set(0, 1.25, -2.05);

    const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.2), wingMat);
    wingPostL.position.set(-0.65, 1.0, -2.05);
    const wingPostR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.2), wingMat);
    wingPostR.position.set(0.65, 1.0, -2.05);

    this.carGroup.add(wingBlade);
    this.carGroup.add(wingPostL);
    this.carGroup.add(wingPostR);

    // Headlights (Front Pixel LED clusters)
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlGeom = new THREE.BoxGeometry(0.35, 0.15, 0.1);
    const hlLeft = new THREE.Mesh(hlGeom, headlightMat);
    hlLeft.position.set(-0.7, 0.55, 2.16);
    const hlRight = new THREE.Mesh(hlGeom, headlightMat);
    hlRight.position.set(0.7, 0.55, 2.16);
    this.carGroup.add(hlLeft);
    this.carGroup.add(hlRight);

    // Headlight Spot beam
    this.headlightSpot = new THREE.SpotLight(0xfff5e6, 2.5, 90, Math.PI / 5, 0.4);
    this.headlightSpot.position.set(0, 0.7, 2.0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 30);
    this.carGroup.add(spotTarget);
    this.headlightSpot.target = spotTarget;
    this.carGroup.add(this.headlightSpot);

    // Brake Lights (Rear Red LED bar)
    this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0x660000 });
    const blGeom = new THREE.BoxGeometry(0.4, 0.14, 0.08);
    const blLeft = new THREE.Mesh(blGeom, this.brakeLightMat);
    blLeft.position.set(-0.68, 0.6, -2.16);
    const blRight = new THREE.Mesh(blGeom, this.brakeLightMat);
    blRight.position.set(0.68, 0.6, -2.16);
    this.carGroup.add(blLeft);
    this.carGroup.add(blRight);

    // Dual Exhaust Pipes
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9 });
    const exhaustGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
    exhaustGeom.rotateX(Math.PI / 2);

    const exhL = new THREE.Mesh(exhaustGeom, exhaustMat);
    exhL.position.set(-0.4, 0.3, -2.2);
    const exhR = new THREE.Mesh(exhaustGeom, exhaustMat);
    exhR.position.set(0.4, 0.3, -2.2);
    this.carGroup.add(exhL);
    this.carGroup.add(exhR);

    // Exhaust Flames (hidden until redline/shift)
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff }); // Turbo blue/cyan pixel flame!
    const flameGeom = new THREE.ConeGeometry(0.14, 0.6, 6);
    flameGeom.rotateX(-Math.PI / 2);

    const flameL = new THREE.Mesh(flameGeom, flameMat);
    flameL.position.set(-0.4, 0.3, -2.6);
    flameL.visible = false;
    const flameR = new THREE.Mesh(flameGeom, flameMat);
    flameR.position.set(0.4, 0.3, -2.6);
    flameR.visible = false;

    this.carGroup.add(flameL);
    this.carGroup.add(flameR);
    this.exhaustFlames.push(flameL, flameR);

    // 2. Wheels Assembly
    this.wheelFL = this.createWheel();
    this.wheelFL.position.set(-0.95, 0.33, 1.4);
    this.carGroup.add(this.wheelFL);

    this.wheelFR = this.createWheel();
    this.wheelFR.position.set(0.95, 0.33, 1.4);
    this.carGroup.add(this.wheelFR);

    this.wheelRL = this.createWheel();
    this.wheelRL.position.set(-0.95, 0.33, -1.4);
    this.carGroup.add(this.wheelRL);

    this.wheelRR = this.createWheel();
    this.wheelRR.position.set(0.95, 0.33, -1.4);
    this.carGroup.add(this.wheelRR);

    this.scene.add(this.carGroup);

    // Smoke particle container
    this.scene.add(this.smokeGroup);
    this.initSmokeParticles();

    // Skidmarks trail initialization
    this.initSkidmarks();
  }

  createWheel() {
    const wheelGroup = new THREE.Group();
    // Low-poly pixel tire
    const tireGeom = new THREE.CylinderGeometry(0.33, 0.33, 0.28, 12);
    tireGeom.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x181a1e, flatShading: true });
    const tire = new THREE.Mesh(tireGeom, tireMat);
    wheelGroup.add(tire);

    // Golden racing rim
    const rimGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 8);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcc9933, metalness: 0.8, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeom, rimMat);
    wheelGroup.add(rim);

    return wheelGroup;
  }

  initSmokeParticles() {
    const maxParticles = 60;
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.6
    });
    const smokeGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);

    for (let i = 0; i < maxParticles; i++) {
      const mesh = new THREE.Mesh(smokeGeom, smokeMat.clone());
      mesh.visible = false;
      this.smokeGroup.add(mesh);
      this.smokeParticles.push({
        mesh,
        life: 0,
        maxLife: 0.8,
        vx: 0,
        vy: 0,
        vz: 0,
        active: false
      });
    }
  }

  emitTireSmoke(originX, originY, originZ) {
    // Find inactive particle
    const p = this.smokeParticles.find(sp => !sp.active);
    if (!p) return;

    p.active = true;
    p.mesh.visible = true;
    p.life = 0;
    p.maxLife = 0.5 + Math.random() * 0.4;
    p.mesh.position.set(
      originX + (Math.random() - 0.5) * 0.4,
      originY + 0.1,
      originZ + (Math.random() - 0.5) * 0.4
    );
    p.mesh.scale.set(0.6, 0.6, 0.6);
    p.mesh.material.opacity = 0.6;
    p.vx = (Math.random() - 0.5) * 1.5;
    p.vy = 0.8 + Math.random() * 1.2;
    p.vz = (Math.random() - 0.5) * 1.5;
  }

  updateSmokeParticles(dt) {
    for (const p of this.smokeParticles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Grow & rise
      const progress = p.life / p.maxLife;
      const currentScale = 0.6 + progress * 2.2;
      p.mesh.scale.set(currentScale, currentScale, currentScale);
      p.mesh.material.opacity = (1 - progress) * 0.5;

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
    }
  }

  initSkidmarks() {
    const maxPoints = 500;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0x111111,
      linewidth: 3,
      transparent: true,
      opacity: 0.7
    });

    this.skidmarkLine = new THREE.LineSegments(geom, mat);
    this.scene.add(this.skidmarkLine);
  }

  addSkidmarkPoint(p1, p2) {
    if (this.skidmarkPoints.length >= 480) {
      this.skidmarkPoints.splice(0, 4); // Remove oldest
    }
    this.skidmarkPoints.push(p1.x, p1.y + 0.05, p1.z);
    this.skidmarkPoints.push(p2.x, p2.y + 0.05, p2.z);

    const pos = this.skidmarkLine.geometry.attributes.position;
    for (let i = 0; i < this.skidmarkPoints.length; i++) {
      pos.array[i] = this.skidmarkPoints[i];
    }
    pos.needsUpdate = true;
    this.skidmarkLine.geometry.setDrawRange(0, this.skidmarkPoints.length / 3);
  }

  /**
   * Update visual car pose based on physics state
   */
  update(dt, physics, trackPoint) {
    // 1. Position & Orientation
    this.carGroup.position.x = physics.position.x;
    this.carGroup.position.z = physics.position.z;
    // Follow track elevation smoothly
    this.carGroup.position.y = trackPoint.elevationY + 0.15;

    // Heading (Yaw)
    this.carGroup.rotation.y = physics.heading;

    // Pitch & Roll matching track slope and Karussell banking
    if (trackPoint.tangent) {
      const pitch = -Math.atan2(trackPoint.tangent.y, Math.hypot(trackPoint.tangent.x, trackPoint.tangent.z));
      this.carGroup.rotation.x = pitch;
      // Lateral roll based on G-force + banking
      const roll = (-physics.lateralG * 0.06) + (trackPoint.banking || 0);
      this.carGroup.rotation.z = roll;
    }

    // 2. Wheels Rotation & Steering
    const wheelRotSpeed = physics.speed / physics.wheelRadius;
    this.wheelRotation += wheelRotSpeed * dt;

    // Spin wheels
    this.wheelFL.children[0].rotation.x = this.wheelRotation;
    this.wheelFR.children[0].rotation.x = this.wheelRotation;
    this.wheelRL.children[0].rotation.x = this.wheelRotation;
    this.wheelRR.children[0].rotation.x = this.wheelRotation;

    // Steer front wheels
    this.wheelFL.rotation.y = physics.steeringAngle;
    this.wheelFR.rotation.y = physics.steeringAngle;

    // 3. Brake Lights Glow
    if (physics.brake > 0.1) {
      this.brakeLightMat.color.setHex(0xff0022); // Bright neon brake
    } else {
      this.brakeLightMat.color.setHex(0x440000); // Dim tail light
    }

    // 4. Exhaust Flames (Rev-limiter or Redline shift)
    const showFlame = physics.isRevLimiting || (physics.justShifted && physics.rpm > 7000);
    for (const f of this.exhaustFlames) {
      f.visible = showFlame;
      if (showFlame) {
        f.scale.set(
          0.8 + Math.random() * 0.5,
          1.0 + Math.random() * 0.8,
          0.8 + Math.random() * 0.5
        );
      }
    }
    if (physics.justShifted) {
      physics.justShifted = false;
    }

    // 5. Tire Smoke & Skidmarks when Drifting
    if (physics.isDrifting && Math.abs(physics.speed) > 4) {
      // Get world positions of rear wheels
      const rlWorld = new THREE.Vector3(-0.95, 0.1, -1.4).applyMatrix4(this.carGroup.matrixWorld);
      const rrWorld = new THREE.Vector3(0.95, 0.1, -1.4).applyMatrix4(this.carGroup.matrixWorld);

      this.emitTireSmoke(rlWorld.x, rlWorld.y, rlWorld.z);
      this.emitTireSmoke(rrWorld.x, rrWorld.y, rrWorld.z);

      // Add skidmarks
      const forwardVec = new THREE.Vector3(0, 0, 0.5).applyMatrix4(this.carGroup.matrixWorld);
      this.addSkidmarkPoint(rlWorld, rrWorld);
    }

    this.updateSmokeParticles(dt);
  }
}
