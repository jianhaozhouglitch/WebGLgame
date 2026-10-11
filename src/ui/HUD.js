/**
 * HUD.js
 * Comprehensive arcade instrument cluster and HUD overlay manager:
 * - Real-time Nürburgring track minimap with animated player arrow
 * - Canvas RPM arc tachometer with shift LEDs
 * - Giant gear number & digital speedometer
 * - G-Force meter & Drift combo counter
 * - Sector progress & Lap timing
 */

export class HUD {
  constructor(track) {
    this.track = track;

    // DOM Elements
    this.speedEl = document.getElementById('speed-display');
    this.gearEl = document.getElementById('gear-display');
    this.rpmDigitalEl = document.getElementById('rpm-digital');
    this.throttleBar = document.getElementById('throttle-bar');
    this.brakeBar = document.getElementById('brake-bar');
    this.driftBar = document.getElementById('drift-bar');

    this.currentLapEl = document.getElementById('current-lap-time');
    this.bestLapEl = document.getElementById('best-lap-time');
    this.sectorEl = document.getElementById('sector-display');
    this.locationNameEl = document.getElementById('track-location-name');

    this.gBall = document.getElementById('g-ball');
    this.latGEl = document.getElementById('lat-g-val');
    this.longGEl = document.getElementById('long-g-val');

    this.shiftAlert = document.getElementById('shift-alert');
    this.revLimitAlert = document.getElementById('rev-limit-alert');
    this.lapAlert = document.getElementById('lap-completed-alert');

    this.driftBox = document.getElementById('drift-score-box');
    this.driftPointsEl = document.getElementById('drift-points');
    this.driftAngleEl = document.getElementById('drift-angle');

    this.shiftLeds = Array.from(document.querySelectorAll('#shift-lights .led'));

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // RPM Canvas
    this.rpmCanvas = document.getElementById('rpm-canvas');
    this.rpmCtx = this.rpmCanvas ? this.rpmCanvas.getContext('2d') : null;

    // Timing States
    this.lapStartTime = performance.now();
    this.currentLapTime = 0;
    this.bestLapTime = null;
    this.lapCount = 1;
    this.lastCheckpointIdx = -1;
    this.hasCrossedMidpoint = false;

    // Cache pre-projected 2D minimap points
    this.minimapPoints = [];
    this.computeMinimapBounds();
  }

  computeMinimapBounds() {
    if (!this.track || !this.track.sampledPoints.length) return;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const sp of this.track.sampledPoints) {
      const x = sp.position.x;
      const z = sp.position.z;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const padding = 20;
    const mapW = 200 - padding * 2;
    const mapH = 200 - padding * 2;
    const spanX = maxX - minX || 1;
    const spanZ = maxZ - minZ || 1;

    // Maintain aspect ratio
    const scale = Math.min(mapW / spanX, mapH / spanZ);
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    this.minimapPoints = this.track.sampledPoints.map(sp => ({
      x: 100 + (sp.position.x - midX) * scale,
      y: 100 + (sp.position.z - midZ) * scale
    }));
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const millis = Math.floor(ms % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  update(physics, trackInfo, dt) {
    // 1. Digital Speed & Gear
    const speedKmh = physics.getSpeedKmh();
    this.speedEl.textContent = speedKmh;
    this.gearEl.textContent = physics.getGearDisplay();
    this.rpmDigitalEl.textContent = Math.round(physics.rpm);

    // 2. Pedals Bars
    this.throttleBar.style.width = `${Math.round(physics.throttle * 100)}%`;
    this.brakeBar.style.width = `${Math.round(physics.brake * 100)}%`;
    this.driftBar.style.width = physics.isHandbrakeActive ? '100%' : '0%';

    // 3. Shift Lights (9 LEDs)
    // LFA-inspired 10,000 RPM redline: progressive shift lights from 2,500 RPM.
    const rpmFrac = Math.max(0, Math.min(1, (physics.rpm - 2500) / (10000 - 2500)));
    const activeLedsCount = Math.floor(rpmFrac * this.shiftLeds.length);
    this.shiftLeds.forEach((led, idx) => {
      if (idx < activeLedsCount) {
        led.classList.add('on');
      } else {
        led.classList.remove('on');
      }
    });

    // 4. Shift Alerts
    if (physics.rpm > 9000 && physics.currentGear < 6 && physics.currentGear > 0 && physics.throttle > 0.5) {
      this.shiftAlert.classList.remove('hidden');
    } else {
      this.shiftAlert.classList.add('hidden');
    }

    if (physics.isRevLimiting) {
      this.revLimitAlert.classList.remove('hidden');
    } else {
      this.revLimitAlert.classList.add('hidden');
    }

    // 5. Drift Score Banner
    if (physics.isDrifting && physics.driftAngle > 10) {
      this.driftBox.classList.remove('hidden');
      this.driftPointsEl.textContent = `+${physics.driftScore} PTS`;
      this.driftAngleEl.textContent = `SLIP ANGLE ${Math.round(physics.driftAngle)}° [x${physics.driftMultiplier.toFixed(1)}]`;
    } else if (physics.driftComboTimer <= 0) {
      this.driftBox.classList.add('hidden');
    }

    // 6. G-Meter Telemetry
    const latG = physics.lateralG.toFixed(2);
    const longG = physics.longitudinalG.toFixed(2);
    this.latGEl.textContent = latG;
    this.longGEl.textContent = longG;

    // Clamp ball to circle
    const ballX = Math.max(-20, Math.min(20, physics.lateralG * 18));
    const ballY = Math.max(-20, Math.min(20, -physics.longitudinalG * 18));
    this.gBall.style.transform = `translate(${ballX}px, ${ballY}px)`;

    // 7. Track Location & Landmark
    this.locationNameEl.textContent = trackInfo.landmark || 'NORDSCHLEIFE';

    // 8. Lap & Sector Timing
    this.currentLapTime = performance.now() - this.lapStartTime;
    this.currentLapEl.textContent = this.formatTime(this.currentLapTime);

    // Track sector (0.0 to 1.0 along track curve)
    const currentSector = Math.floor(trackInfo.u * 12) + 1;
    this.sectorEl.textContent = `S${currentSector} / 12`;

    // Midpoint crossing verification to avoid instant lap triggers
    if (trackInfo.u > 0.45 && trackInfo.u < 0.55) {
      this.hasCrossedMidpoint = true;
    }

    // Finish line crossing (t near 0.0 or 1.0)
    if (this.hasCrossedMidpoint && trackInfo.u < 0.02) {
      this.onLapCompleted();
    }

    // 9. Draw Canvases
    this.drawRPMGauge(physics.rpm, physics.redlineRpm);
    this.drawMinimap(physics.position, physics.heading);
  }

  onLapCompleted() {
    this.hasCrossedMidpoint = false;
    const finalLapTime = this.currentLapTime;
    this.lapStartTime = performance.now();

    if (!this.bestLapTime || finalLapTime < this.bestLapTime) {
      this.bestLapTime = finalLapTime;
      this.bestLapEl.textContent = this.formatTime(this.bestLapTime);
    }

    this.lapAlert.textContent = `LAP ${this.lapCount} FINISHED: ${this.formatTime(finalLapTime)}`;
    this.lapAlert.classList.remove('hidden');
    setTimeout(() => {
      this.lapAlert.classList.add('hidden');
    }, 4500);

    this.lapCount++;
  }

  /**
   * Draw Analog Tachometer Arc on 2D Canvas
   */
  drawRPMGauge(rpm, redline) {
    if (!this.rpmCtx) return;
    const ctx = this.rpmCtx;
    const w = this.rpmCanvas.width;
    const h = this.rpmCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 10;
    const radius = 75;

    // Gauge Arc angles: from Math.PI to 2 * Math.PI
    const startAngle = Math.PI * 0.85;
    const endAngle = Math.PI * 2.15;
    const totalArc = endAngle - startAngle;

    // Background track arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#182333';
    ctx.stroke();

    // Colored Segments
    const gaugeMaxRpm = redline;
    // 1. Green (0 - 6500)
    const a1 = startAngle + totalArc * (6500 / gaugeMaxRpm);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, a1);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#00ff66';
    ctx.stroke();

    // 2. Yellow (6500 - 8200)
    const a2 = startAngle + totalArc * (8200 / gaugeMaxRpm);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, a1, a2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffcc00';
    ctx.stroke();

    // 3. Red (8200 - 10000)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, a2, endAngle);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ff3344';
    ctx.stroke();

    // RPM Needle
    const clampedRpm = Math.max(0, Math.min(gaugeMaxRpm, rpm));
    const needleAngle = startAngle + totalArc * (clampedRpm / gaugeMaxRpm);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(needleAngle);

    // Needle shadow
    ctx.fillStyle = '#ff3344';
    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(radius + 6, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();

    // Pivot cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw Nürburgring 2D Minimap
   */
  drawMinimap(playerPos, playerHeading) {
    if (!this.minimapCtx || !this.minimapPoints.length) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background track outline
    ctx.beginPath();
    ctx.strokeStyle = '#1e324a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < this.minimapPoints.length; i++) {
      const pt = this.minimapPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Glowing track center
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Start / Finish Line marker
    const pStart = this.minimapPoints[0];
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(pStart.x, pStart.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player position
    if (!this.track || !this.track.sampledPoints.length) return;
    const minX = Math.min(...this.track.sampledPoints.map(p => p.position.x));
    const maxX = Math.max(...this.track.sampledPoints.map(p => p.position.x));
    const minZ = Math.min(...this.track.sampledPoints.map(p => p.position.z));
    const maxZ = Math.max(...this.track.sampledPoints.map(p => p.position.z));

    const spanX = maxX - minX || 1;
    const spanZ = maxZ - minZ || 1;
    const scale = Math.min(160 / spanX, 160 / spanZ);
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const px = 100 + (playerPos.x - midX) * scale;
    const py = 100 + (playerPos.z - midZ) * scale;

    // Draw Player Arrow
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-playerHeading + Math.PI); // Orient with heading

    ctx.fillStyle = '#ff7700';
    ctx.shadowColor = '#ff7700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
