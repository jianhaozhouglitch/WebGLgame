/**
 * CarPhysics.js
 * High-fidelity racing physics engine with real internal combustion drivetrain,
 * realistic torque curves, 6-speed manual transmission, aerodynamic drag,
 * tire friction, drift mechanics, and lateral G-forces.
 */

export class CarPhysics {
  constructor() {
    // --- Vehicle Specifications (GT Sports Coupe) ---
    this.mass = 1380; // kg
    this.wheelRadius = 0.33; // meters
    this.finalDrive = 3.44;
    this.efficiency = 0.88;
    this.frontalArea = 2.1; // m^2
    this.dragCoeff = 0.32; // Cd
    this.rollingResistanceCoeff = 0.015;
    this.airDensity = 1.225; // kg/m^3

    // 6-Speed Manual Gearbox ratios: [R, N, 1, 2, 3, 4, 5, 6]
    this.gearRatios = {
      '-1': -3.60, // Reverse
      '0': 0.00,  // Neutral
      '1': 3.82,  // 1st
      '2': 2.20,  // 2nd
      '3': 1.52,  // 3rd
      '4': 1.22,  // 4th
      '5': 1.00,  // 5th
      '6': 0.83   // 6th (Overdrive)
    };

    this.currentGear = 1; // Starts in 1st gear
    this.isAutoTransmission = false;

    // Engine Limits
    this.idleRpm = 900;
    // Lexus LFA-inspired high-revving V10 character.
    this.redlineRpm = 10000;
    this.maxRpm = 10200;
    this.rpm = 900;
    this.isRevLimiting = false;
    this.revLimitTimer = 0;

    // Clutch & Shifting States
    this.isClutchEngaged = true;
    this.clutchTimer = 0;
    this.shiftDuration = 0.12; // 120ms shift latency
    this.justShifted = false;

    // Movement Vectors & Dynamic States
    this.position = { x: 0, y: 0, z: 0 };
    this.heading = 0; // Yaw angle in radians (0 = along +Z or track tangent)
    this.speed = 0; // m/s (forward speed)
    this.lateralSpeed = 0; // m/s (drift sideways speed)
    this.angularVelocity = 0; // rad/s
    this.steeringAngle = 0; // current front-wheel angle in radians
    this.maxSteerAngle = 0.58; // 33 degrees at parking/low speed
    this.highSpeedSteerAngle = 0.32; // 18 degrees at high speed
    this.steeringRatio = 14.0; // steering wheel turns per front-wheel turn

    // Dynamic Accelerations (for G-meter)
    this.longitudinalG = 0;
    this.lateralG = 0;

    // Drift Dynamics
    this.isDrifting = false;
    this.driftAngle = 0; // degrees
    this.driftScore = 0;
    this.driftMultiplier = 1.0;
    this.driftComboTimer = 0;
    this.isHandbrakeActive = false;
    this.tireSmokeIntensity = 0;

    // Control inputs
    this.throttle = 0; // 0 to 1
    this.brake = 0; // 0 to 1
    this.steerInput = 0; // -1 (left) to 1 (right)

    // Callbacks
    this.onShift = null;
    this.onRevLimitPop = null;
    this.onDriftStateChange = null;
  }

  /**
   * Peak torque curve based on engine RPM (Nm)
   */
  getEngineTorque(rpm) {
    if (rpm < 600) return 150;
    if (rpm > this.maxRpm) return 0;

    // Broad V10 power band with a strong high-rpm pull.
    const norm = (rpm - 900) / (10000 - 900);
    const clamped = Math.max(0, Math.min(1, norm));
    
    // Asymmetric torque dome
    const peakNorm = 0.68; // Peak around 7100 RPM
    let factor = 0;
    if (clamped < peakNorm) {
      factor = Math.sin((clamped / peakNorm) * (Math.PI / 2));
    } else {
      factor = Math.cos(((clamped - peakNorm) / (1 - peakNorm)) * (Math.PI / 2) * 0.7);
    }

    return 240 + factor * 240; // 240 Nm base to 480 Nm peak
  }

  /**
   * Shift up (ArrowUp)
   */
  shiftUp() {
    if (this.currentGear === -1) {
      this.currentGear = 0; // Reverse to Neutral
    } else if (this.currentGear === 0) {
      this.currentGear = 1; // Neutral to 1st
    } else if (this.currentGear < 6) {
      this.currentGear++;
      this.triggerShiftClutch();
    }
    if (this.onShift) this.onShift(this.currentGear);
  }

  /**
   * Shift down (ArrowDown)
   */
  shiftDown() {
    if (this.currentGear > 1) {
      this.currentGear--;
      this.triggerShiftClutch(true);
    } else if (this.currentGear === 1) {
      this.currentGear = 0; // 1st to Neutral
    } else if (this.currentGear === 0) {
      this.currentGear = -1; // Neutral to Reverse
    }
    if (this.onShift) this.onShift(this.currentGear);
  }

  triggerShiftClutch(isDownshift = false) {
    this.isClutchEngaged = false;
    this.clutchTimer = this.shiftDuration;
    this.justShifted = true;

    // Downshift rev-matching blip
    if (isDownshift && this.speed > 3) {
      const targetRatio = Math.abs(this.gearRatios[this.currentGear]);
      const targetRpm = (this.speed * targetRatio * this.finalDrive * 60) / (2 * Math.PI * this.wheelRadius);
      this.rpm = Math.min(this.maxRpm - 200, Math.max(this.rpm + 1200, targetRpm));
    }
  }

  /**
   * Main Physics Tick (dt in seconds)
   */
  update(dt, input) {
    if (dt > 0.1) dt = 0.1; // Clamp delta time spike

    // Update player inputs
    this.throttle = input.throttle || 0;
    this.brake = input.brake || 0;
    this.steerInput = input.steer || 0;
    this.isHandbrakeActive = input.handbrake || false;

    // Handle clutch shift timing
    if (!this.isClutchEngaged) {
      this.clutchTimer -= dt;
      if (this.clutchTimer <= 0) {
        this.isClutchEngaged = true;
      }
    }

    // Auto transmission logic (optional toggle)
    if (this.isAutoTransmission && this.isClutchEngaged) {
      if (this.currentGear >= 1 && this.currentGear < 6 && this.rpm > 7600 && this.throttle > 0.5) {
        this.shiftUp();
      } else if (this.currentGear > 1 && this.rpm < 2800 && this.speed < (this.currentGear * 12)) {
        this.shiftDown();
      }
    }

    // 1. Variable steering ratio
    // The rack is quick at low speed for hairpins, then progressively slows
    // at speed so a large input remains controllable instead of saturating
    // the old fixed 0.24 rad lock too early.
    const speedKmh = Math.abs(this.speed) * 3.6;
    const speedBlend = Math.min(1.0, speedKmh / 220.0);
    const smoothBlend = speedBlend * speedBlend * (3.0 - 2.0 * speedBlend);
    const availableSteerAngle =
      this.maxSteerAngle + (this.highSpeedSteerAngle - this.maxSteerAngle) * smoothBlend;
    // Progressive input gives fine control in medium corners while retaining
    // full lock for tight bends.
    const progressiveInput = Math.sign(this.steerInput) * Math.pow(Math.abs(this.steerInput), 0.86);
    const targetSteerAngle = progressiveInput * availableSteerAngle;
    this.steeringRatio = 14.0 + smoothBlend * 8.0;
    // Smooth steering rack: smooth response on input, snappy return to center
    const steerSpeed = (this.steerInput === 0) ? 14.0 : 6.5;
    this.steeringAngle += (targetSteerAngle - this.steeringAngle) * Math.min(1.0, dt * steerSpeed);

    // 2. Drivetrain & Engine RPM Coupling
    const ratio = this.gearRatios[this.currentGear];
    const absRatio = Math.abs(ratio);

    if (this.currentGear === 0 || !this.isClutchEngaged) {
      // Neutral or Clutch disengaged: engine revs with throttle & flywheel inertia
      if (this.throttle > 0.05) {
        this.rpm += (this.throttle * 10000 - (this.rpm - this.idleRpm) * 0.5) * dt * 4;
      } else {
        this.rpm -= (this.rpm - this.idleRpm) * dt * 5;
      }
    } else {
      // In gear: RPM coupled to wheel speed
      const wheelRpm = (Math.abs(this.speed) / (2 * Math.PI * this.wheelRadius)) * 60;
      const targetRpm = wheelRpm * absRatio * this.finalDrive;
      
      // Smoothly blend RPM to wheel RPM
      this.rpm += (targetRpm - this.rpm) * Math.min(1.0, dt * 25.0);
    }

    // Hard rev limiter logic (bouncing off redline)
    if (this.rpm >= this.redlineRpm) {
      this.isRevLimiting = true;
      this.revLimitTimer += dt;
      if (this.revLimitTimer > 0.08) {
        this.revLimitTimer = 0;
        this.rpm = this.redlineRpm - 250 + (Math.random() * 80);
        if (this.onRevLimitPop) this.onRevLimitPop();
      }
    } else {
      this.isRevLimiting = false;
      this.revLimitTimer = 0;
    }
    this.rpm = Math.max(this.idleRpm, Math.min(this.maxRpm, this.rpm));

    // 3. Drive Force Calculation
    let driveForce = 0;
    if (this.isClutchEngaged && this.currentGear !== 0 && !this.isRevLimiting) {
      const engineTorque = this.getEngineTorque(this.rpm);
      const wheelTorque = engineTorque * absRatio * this.finalDrive * this.efficiency;
      const rawForce = (wheelTorque / this.wheelRadius) * this.throttle;

      if (this.currentGear > 0) {
        driveForce = rawForce;
      } else if (this.currentGear === -1) {
        // Reverse gear
        driveForce = -rawForce;
      }
    }

    // 4. Aerodynamic Drag & Rolling Resistance
    // Drag = 0.5 * rho * Cd * A * v^2
    const aeroDrag = 0.5 * this.airDensity * this.dragCoeff * this.frontalArea * Math.pow(this.speed, 2) * Math.sign(this.speed);
    const rollingResistance = this.rollingResistanceCoeff * this.mass * 9.81 * Math.sign(this.speed);

    // 5. Braking Force
    const maxBrakeForce = 14500; // N (High-performance carbon ceramic brakes)
    let brakeForce = 0;
    if (this.brake > 0) {
      brakeForce = this.brake * maxBrakeForce * Math.sign(this.speed);
      // Prevent reversing solely from braking
      if (Math.abs(this.speed) < 0.2 && driveForce === 0) {
        brakeForce = 0;
        this.speed = 0;
      }
    }

    // 6. Net Longitudinal Force & Forward Acceleration
    let netLongForce = driveForce - aeroDrag - rollingResistance - brakeForce;
    if (Math.abs(this.speed) < 0.1 && driveForce === 0 && this.brake > 0) {
      netLongForce = 0;
    }

    const forwardAccel = netLongForce / this.mass;
    this.speed += forwardAccel * dt;

    // Handbrake effect on forward speed
    if (this.isHandbrakeActive && Math.abs(this.speed) > 4) {
      // The handbrake unlocks the rear axle, but should not simply stop the
      // car. Retain momentum so the player can rotate through a corner.
      this.speed *= Math.max(0.1, 1.0 - dt * 0.35);
    }

    // 7. Lateral Dynamics, Drifting & Yaw Momentum
    // Lateral tire adhesion
    let tireGrip = 1.0;
    if (this.isHandbrakeActive) {
      tireGrip = 0.08; // Rear axle loses grip and begins to rotate
    }

    // High lateral load causes tire slip
    const lateralVelocity = this.lateralSpeed;
    const slipSpeed = Math.abs(lateralVelocity);

    // Turning rate proportional to speed and steering angle
    // In Three.js screen space, positive angular velocity turns car left (A key), negative turns right (D key)
    const wheelbase = 2.65; // meters
    let targetAngularVelocity = 0;
    if (Math.abs(this.speed) > 0.2) {
      targetAngularVelocity = -(this.speed / wheelbase) * Math.tan(this.steeringAngle);
    }

    // Oversteer & Drift Dynamics:
    // Only amplify yaw into drift when intentional: Shift key pressed or severe power-oversteer
    const isDriftIntentional =
      (this.isHandbrakeActive && Math.abs(this.speed) > 4) ||
      (slipSpeed > 6.0 && Math.abs(this.steeringAngle) > 0.1 && this.throttle > 0.75);

    if (isDriftIntentional) {
      this.isDrifting = true;
      const driftBoost = this.isHandbrakeActive ? 1.8 : 1.1;
      const steerDirection = this.steerInput !== 0
        ? -Math.sign(this.steerInput)
        : Math.sign(this.angularVelocity || 1);
      const driftInitiation = this.isHandbrakeActive
        ? steerDirection * (0.9 + Math.min(1.0, Math.abs(this.speed) / 22) * 1.1)
        : 0;
      this.angularVelocity += (targetAngularVelocity * 2.5 * driftBoost + driftInitiation) * dt;
      this.angularVelocity *= this.isHandbrakeActive ? 0.985 : 0.93;

      // Side slide increases
      const centripetalSlide = -this.angularVelocity * this.speed * 0.45;
      const handbrakeSlide = this.isHandbrakeActive
        ? steerDirection * Math.abs(this.speed) * 0.22
        : 0;
      this.lateralSpeed += (centripetalSlide + handbrakeSlide - this.lateralSpeed * 3.5 * tireGrip) * dt;
      this.tireSmokeIntensity = Math.min(1.0, (slipSpeed / 7.0) + (this.isHandbrakeActive ? 0.8 : 0.0));
    } else {
      this.isDrifting = false;
      // High tracking stability during regular cornering (prevents spinning out!)
      this.angularVelocity += (targetAngularVelocity - this.angularVelocity) * Math.min(1.0, dt * 14.0);
      this.angularVelocity *= 0.94; // Gyroscopic directional damping
      // Lateral friction restores grip quickly
      this.lateralSpeed += (-this.lateralSpeed * 16.0) * dt;
      this.tireSmokeIntensity = Math.max(0, this.tireSmokeIntensity - dt * 4.0);
    }

    // Apply Yaw
    this.heading += this.angularVelocity * dt;

    // 8. Drift Angle & Drift Scoring
    const totalSpeed = Math.sqrt(this.speed * this.speed + this.lateralSpeed * this.lateralSpeed);
    if (totalSpeed > 3.0 && Math.abs(this.lateralSpeed) > 1.2) {
      this.driftAngle = Math.abs(Math.atan2(this.lateralSpeed, Math.abs(this.speed))) * (180 / Math.PI);
      if (this.driftAngle > 10) {
        // Accumulate drift points
        const pointsThisTick = Math.floor(this.driftAngle * (speedKmh / 50) * dt * 25);
        this.driftScore += pointsThisTick;
        this.driftComboTimer = 1.5;
        this.driftMultiplier = Math.min(4.0, 1.0 + (this.driftAngle / 25));
      }
    } else {
      this.driftAngle = 0;
      if (this.driftComboTimer > 0) {
        this.driftComboTimer -= dt;
      }
    }

    // 9. Update 3D World Position (X, Z plane)
    // Forward direction: sin(heading), cos(heading)
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);

    // Lateral direction is perpendicular: cos(heading), -sin(heading)
    const dx = (sinH * this.speed + cosH * this.lateralSpeed) * dt;
    const dz = (cosH * this.speed - sinH * this.lateralSpeed) * dt;

    this.position.x += dx;
    this.position.z += dz;

    // 10. Telemetry G-Forces
    this.longitudinalG = forwardAccel / 9.81;
    this.lateralG = (this.angularVelocity * this.speed) / 9.81;
  }

  /**
   * Reset car position and physics state to a specified point
   */
  resetTo(x, y, z, heading) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.heading = heading;
    this.speed = 0;
    this.lateralSpeed = 0;
    this.angularVelocity = 0;
    this.steeringAngle = 0;
    this.steeringRatio = 14.0;
    this.currentGear = 1;
    this.rpm = this.idleRpm;
    this.isDrifting = false;
    this.driftAngle = 0;
    this.driftScore = 0;
    this.longitudinalG = 0;
    this.lateralG = 0;
  }

  getSpeedKmh() {
    return Math.round(this.speed * 3.6);
  }

  getGearDisplay() {
    if (this.currentGear === -1) return 'R';
    if (this.currentGear === 0) return 'N';
    return this.currentGear.toString();
  }
}
