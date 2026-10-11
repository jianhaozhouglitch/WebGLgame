/**
 * NurburgringTrack.js
 * High-detail 3D procedural reproduction of the legendary Nürburgring Nordschleife circuit.
 * Includes iconic corners (Karussell, Flugplatz, Fuchsröhre, Brünnchen, Döttinger Höhe),
 * 3D elevation changes, curbs, Armco guardrails, pixel pine trees, bridges, and checkpoints.
 */

import * as THREE from 'three';

export class NurburgringTrack {
  constructor(scene) {
    this.scene = scene;
    this.trackCurve = null;
    this.sampleCount = 800;
    this.sampledPoints = [];
    this.trackWidth = 11.5; // meters
    this.roadMesh = null;
    this.curbMeshes = [];
    this.barrierMeshes = [];
    this.treeInstances = null;
    this.decorations = [];

    // Sectors and Iconic Landmarks along the Nordschleife
    this.landmarks = [
      { t: 0.00, name: 'START / FINISH LINE (起点/终点线)' },
      { t: 0.04, name: 'HATZENBACH (哈策巴赫连续弯)' },
      { t: 0.08, name: 'HOCHEICHEN (霍赫艾兴)' },
      { t: 0.12, name: 'FLUGPLATZ (机场飞坡)' },
      { t: 0.16, name: 'SCHWEDENKREUZ (瑞典十字弯 250+ KM/H)' },
      { t: 0.20, name: 'AREMBERG (阿伦伯格重刹区)' },
      { t: 0.24, name: 'FUCHSRÖHRE (狐狸洞大下坡压迫点)' },
      { t: 0.28, name: 'ADENAUER FORST (阿德瑙森林 S弯)' },
      { t: 0.33, name: 'METZGESFELD (梅茨格斯菲尔德)' },
      { t: 0.38, name: 'WEHRSEIFEN (维尔塞芬发夹弯)' },
      { t: 0.42, name: 'BREIDSCHEID (布赖德夏伊德石桥 - 最低点)' },
      { t: 0.47, name: 'EX-MÜHLE & BERGWERK (矿场大上坡)' },
      { t: 0.52, name: 'KESSELCHEN (长坡大马力拉升段)' },
      { t: 0.58, name: 'KLOSTERTAL & STEILSTRECKE' },
      { t: 0.63, name: 'CARACCIOLA KARUSSELL (卡拉奇奥拉旋转木马弯)' },
      { t: 0.69, name: 'HOHE ACHT (高阿赫特山巅 - 最高点)' },
      { t: 0.74, name: 'WIPPERMANN & ESCHBACH' },
      { t: 0.79, name: 'BRÜNNCHEN (小泉弯 - 知名观赛点)' },
      { t: 0.83, name: 'EISKURVE & PFLANZGARTEN (植物园飞跃点)' },
      { t: 0.88, name: 'SCHWALBENSCHWANZ (燕尾弯)' },
      { t: 0.91, name: 'GALGENKOPF (绞刑架弯)' },
      { t: 0.95, name: 'DÖTTINGER HÖHE (长达2.5KM极限大直道!)' },
      { t: 0.98, name: 'TIERGARTEN (动物园减速弯)' }
    ];

    this.checkpoints = [];
    this.totalLength = 0;
  }

  buildTrack() {
    this.createSplineCurve();
    this.generateTrackGeometry();
    this.generateTerrain();
    this.generateSceneryAndTrees();
    this.generateStartGantryAndBridges();
    this.setupCheckpoints();
  }

  /**
   * Define 3D control points capturing the distinctive geographic footprint
   * and elevation profile of the Nürburgring Nordschleife.
   */
  createSplineCurve() {
    // 3D coordinates (X, Y (Elevation), Z) scaled for optimal racing scale
    // Real Nordschleife drops ~300m in elevation down to Breidscheid then climbs back to Hohe Acht!
    const scale = 1.35;
    const rawPoints = [
      // 0: Start / Finish Line & T13 Straight
      new THREE.Vector3(0, 40, -100),
      new THREE.Vector3(20, 38, -250),
      // Hatzenbach
      new THREE.Vector3(80, 36, -380),
      new THREE.Vector3(140, 34, -460),
      new THREE.Vector3(180, 32, -580),
      // Hocheichen
      new THREE.Vector3(150, 30, -680),
      new THREE.Vector3(100, 32, -780),
      // Flugplatz (High speed crest)
      new THREE.Vector3(40, 42, -900),
      new THREE.Vector3(-30, 44, -1050),
      // Schwedenkreuz (Sweeper)
      new THREE.Vector3(-120, 42, -1220),
      new THREE.Vector3(-240, 38, -1380),
      // Aremberg
      new THREE.Vector3(-380, 32, -1500),
      new THREE.Vector3(-520, 25, -1540),
      // Fuchsröhre (Steep downhill drop into compression!)
      new THREE.Vector3(-660, 5, -1500),
      new THREE.Vector3(-780, -15, -1400),
      new THREE.Vector3(-880, -25, -1260),
      // Adenauer Forst (chicane)
      new THREE.Vector3(-940, -20, -1100),
      new THREE.Vector3(-1020, -15, -1020),
      new THREE.Vector3(-1060, -12, -900),
      // Metzgesfeld
      new THREE.Vector3(-1080, -15, -740),
      new THREE.Vector3(-1120, -20, -580),
      // Kallenhard
      new THREE.Vector3(-1180, -28, -420),
      // Wehrseifen (Hairpin right)
      new THREE.Vector3(-1260, -40, -260),
      new THREE.Vector3(-1320, -55, -120),
      // Breidscheid (Lowest elevation point of the Nordschleife!)
      new THREE.Vector3(-1360, -70, 40),
      new THREE.Vector3(-1340, -68, 180),
      // Ex-Mühle
      new THREE.Vector3(-1260, -55, 300),
      new THREE.Vector3(-1160, -42, 380),
      // Bergwerk (Critical corner)
      new THREE.Vector3(-1040, -30, 420),
      new THREE.Vector3(-900, -15, 430),
      // Kesselchen (Long winding uphill climb)
      new THREE.Vector3(-740, 5, 410),
      new THREE.Vector3(-580, 25, 380),
      new THREE.Vector3(-440, 45, 340),
      // Klostertal
      new THREE.Vector3(-320, 60, 300),
      new THREE.Vector3(-200, 72, 260),
      // Steilstrecke
      new THREE.Vector3(-100, 80, 220),
      // Caracciola Karussell (Famous banked concrete turn!)
      new THREE.Vector3(-10, 84, 180),
      new THREE.Vector3(70, 83, 150),
      new THREE.Vector3(120, 80, 190),
      // Hohe Acht (Highest elevation summit)
      new THREE.Vector3(150, 92, 280),
      new THREE.Vector3(170, 95, 400),
      // Wippermann & Eschbach
      new THREE.Vector3(160, 85, 540),
      new THREE.Vector3(130, 75, 680),
      // Brünnchen (Famous corner)
      new THREE.Vector3(80, 65, 820),
      new THREE.Vector3(20, 55, 940),
      // Eiskurve
      new THREE.Vector3(-40, 48, 1060),
      // Pflanzgarten (Jumps)
      new THREE.Vector3(-80, 42, 1200),
      new THREE.Vector3(-60, 38, 1340),
      new THREE.Vector3(0, 35, 1460),
      // Schwalbenschwanz & Kleines Karussell
      new THREE.Vector3(80, 32, 1540),
      new THREE.Vector3(160, 30, 1560),
      new THREE.Vector3(220, 28, 1480),
      // Galgenkopf
      new THREE.Vector3(250, 26, 1340),
      new THREE.Vector3(240, 25, 1180),
      // Döttinger Höhe (Massive long high-speed straight ~2.5km!)
      new THREE.Vector3(210, 25, 960),
      new THREE.Vector3(180, 26, 680),
      new THREE.Vector3(140, 28, 400),
      new THREE.Vector3(100, 30, 150),
      new THREE.Vector3(60, 34, -10),
      // Antoniusbuche & Tiergarten chicane back to Start line
      new THREE.Vector3(20, 38, -60)
    ];

    // Scale points
    const scaledPoints = rawPoints.map(p => new THREE.Vector3(p.x * scale, p.y, p.z * scale));

    // Create smooth closed 3D Catmull-Rom spline
    this.trackCurve = new THREE.CatmullRomCurve3(scaledPoints, true, 'centripetal', 0.25);
    this.totalLength = this.trackCurve.getLength();

    // Sample points along the spline
    this.sampledPoints = [];
    for (let i = 0; i < this.sampleCount; i++) {
      const u = i / this.sampleCount;
      const point = this.trackCurve.getPointAt(u);
      const tangent = this.trackCurve.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Check if inside Karussell region (around t = 0.63)
      let banking = 0;
      if (Math.abs(u - 0.63) < 0.02) {
        banking = 0.22; // ~12 degrees banking in Karussell!
      }

      this.sampledPoints.push({
        index: i,
        u,
        position: point,
        tangent,
        normal,
        banking
      });
    }
  }

  /**
   * Procedural Pixel Road Texture
   */
  createPixelRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Dark grey pixel asphalt
    ctx.fillStyle = '#22262c';
    ctx.fillRect(0, 0, 256, 256);

    // Pixel noise grain
    for (let x = 0; x < 256; x += 4) {
      for (let y = 0; y < 256; y += 4) {
        if (Math.random() > 0.6) {
          ctx.fillStyle = Math.random() > 0.5 ? '#1a1d22' : '#2b3038';
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Racing rubber tire groove marks (racing line)
    ctx.fillStyle = '#17191d';
    ctx.fillRect(50, 0, 36, 256);
    ctx.fillRect(170, 0, 36, 256);

    // White dashed centerline
    ctx.fillStyle = '#e8edf5';
    for (let y = 0; y < 256; y += 64) {
      ctx.fillRect(124, y + 8, 8, 36);
    }

    // White edge lines
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(4, 0, 8, 256);
    ctx.fillRect(244, 0, 8, 256);

    // Iconic Nürburgring track graffiti!
    ctx.fillStyle = '#ff3344';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('NÜRBURG', 60, 80);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('RING #1', 140, 180);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 240);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  /**
   * Procedural Red & White Kerb Texture
   */
  createPixelKerbTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Red and White alternating stripes
    ctx.fillStyle = '#d92534';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 64, 64, 64);

    // Pixel bevel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, 6, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 400);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  /**
   * Procedural Armco Guardrail Texture
   */
  createBarrierTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Metallic silver corrugated armco
    ctx.fillStyle = '#8f9da9';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#b6c5d4';
    ctx.fillRect(0, 10, 64, 16);
    ctx.fillRect(0, 38, 64, 16);
    ctx.fillStyle = '#556370';
    ctx.fillRect(0, 26, 64, 12);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(300, 1);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  /**
   * Generate 3D Road Mesh Ribbon & Curbs
   */
  generateTrackGeometry() {
    const halfWidth = this.trackWidth / 2;
    const curbWidth = 1.4;
    const barrierOffset = halfWidth + curbWidth + 0.6;

    const roadGeom = new THREE.BufferGeometry();
    const curbLeftGeom = new THREE.BufferGeometry();
    const curbRightGeom = new THREE.BufferGeometry();
    const barrierLeftGeom = new THREE.BufferGeometry();
    const barrierRightGeom = new THREE.BufferGeometry();
    const vergeLeftGeom = new THREE.BufferGeometry();
    const vergeRightGeom = new THREE.BufferGeometry();

    const roadPositions = [];
    const roadUvs = [];
    const roadIndices = [];

    const clPositions = [];
    const clUvs = [];
    const clIndices = [];

    const crPositions = [];
    const crUvs = [];
    const crIndices = [];

    const blPositions = [];
    const blIndices = [];
    const brPositions = [];
    const brIndices = [];

    const vlPositions = [];
    const vlUvs = [];
    const vlIndices = [];
    const vrPositions = [];
    const vrUvs = [];
    const vrIndices = [];

    const n = this.sampleCount;

    for (let i = 0; i < n; i++) {
      const curr = this.sampledPoints[i];
      const p = curr.position;
      const normal = curr.normal;

      // Apply Karussell banking if applicable
      const bankY = Math.sin(curr.banking) * halfWidth;

      // Left and right track edge coordinates
      const pLeft = new THREE.Vector3(
        p.x - normal.x * halfWidth,
        p.y + bankY * 0.5,
        p.z - normal.z * halfWidth
      );
      const pRight = new THREE.Vector3(
        p.x + normal.x * halfWidth,
        p.y - bankY * 0.5,
        p.z + normal.z * halfWidth
      );

      // Road Vertices
      roadPositions.push(pLeft.x, pLeft.y, pLeft.z);
      roadPositions.push(pRight.x, pRight.y, pRight.z);
      const vCoord = i / n;
      roadUvs.push(0, vCoord);
      roadUvs.push(1, vCoord);

      // Curbs Vertices
      const curbLeftOuter = new THREE.Vector3(
        pLeft.x - normal.x * curbWidth,
        pLeft.y + 0.15,
        pLeft.z - normal.z * curbWidth
      );
      clPositions.push(curbLeftOuter.x, curbLeftOuter.y, curbLeftOuter.z);
      clPositions.push(pLeft.x, pLeft.y, pLeft.z);
      clUvs.push(0, vCoord);
      clUvs.push(1, vCoord);

      const curbRightOuter = new THREE.Vector3(
        pRight.x + normal.x * curbWidth,
        pRight.y + 0.15,
        pRight.z + normal.z * curbWidth
      );
      crPositions.push(pRight.x, pRight.y, pRight.z);
      crPositions.push(curbRightOuter.x, curbRightOuter.y, curbRightOuter.z);
      crUvs.push(0, vCoord);
      crUvs.push(1, vCoord);

      // Armco Guardrail Vertices (height 1.1m)
      const barrierH = 1.1;
      const bLeftBase = new THREE.Vector3(p.x - normal.x * barrierOffset, p.y + 0.1, p.z - normal.z * barrierOffset);
      const bLeftTop = new THREE.Vector3(bLeftBase.x, bLeftBase.y + barrierH, bLeftBase.z);
      blPositions.push(bLeftBase.x, bLeftBase.y, bLeftBase.z);
      blPositions.push(bLeftTop.x, bLeftTop.y, bLeftTop.z);

      const bRightBase = new THREE.Vector3(p.x + normal.x * barrierOffset, p.y + 0.1, p.z + normal.z * barrierOffset);
      const bRightTop = new THREE.Vector3(bRightBase.x, bRightBase.y + barrierH, bRightBase.z);
      brPositions.push(bRightBase.x, bRightBase.y, bRightBase.z);
      brPositions.push(bRightTop.x, bRightTop.y, bRightTop.z);

      // Grass Verge Embankments (22m buffer extending outward from barrier bases, sloping downwards)
      const vergeW = 22.0;
      const vlOuter = new THREE.Vector3(p.x - normal.x * (barrierOffset + vergeW), p.y - 1.6, p.z - normal.z * (barrierOffset + vergeW));
      vlPositions.push(bLeftBase.x, bLeftBase.y, bLeftBase.z);
      vlPositions.push(vlOuter.x, vlOuter.y, vlOuter.z);
      vlUvs.push(0, vCoord * 12);
      vlUvs.push(1, vCoord * 12);

      const vrOuter = new THREE.Vector3(p.x + normal.x * (barrierOffset + vergeW), p.y - 1.6, p.z + normal.z * (barrierOffset + vergeW));
      vrPositions.push(bRightBase.x, bRightBase.y, bRightBase.z);
      vrPositions.push(vrOuter.x, vrOuter.y, vrOuter.z);
      vrUvs.push(0, vCoord * 12);
      vrUvs.push(1, vCoord * 12);

      // Face indices
      if (i < n - 1) {
        const i0 = i * 2;
        const i1 = i * 2 + 1;
        const i2 = (i + 1) * 2;
        const i3 = (i + 1) * 2 + 1;

        // Road faces
        roadIndices.push(i0, i1, i2);
        roadIndices.push(i1, i3, i2);

        // Curb faces
        clIndices.push(i0, i1, i2);
        clIndices.push(i1, i3, i2);

        crIndices.push(i0, i1, i2);
        crIndices.push(i1, i3, i2);

        // Barrier faces
        blIndices.push(i0, i1, i2);
        blIndices.push(i1, i3, i2);

        brIndices.push(i0, i1, i2);
        brIndices.push(i1, i3, i2);

        // Verge faces
        vlIndices.push(i0, i1, i2);
        vlIndices.push(i1, i3, i2);

        vrIndices.push(i0, i1, i2);
        vrIndices.push(i1, i3, i2);
      } else {
        // Connect loop back to start
        const i0 = i * 2;
        const i1 = i * 2 + 1;
        const i2 = 0;
        const i3 = 1;

        roadIndices.push(i0, i1, i2);
        roadIndices.push(i1, i3, i2);

        clIndices.push(i0, i1, i2);
        clIndices.push(i1, i3, i2);

        crIndices.push(i0, i1, i2);
        crIndices.push(i1, i3, i2);

        blIndices.push(i0, i1, i2);
        blIndices.push(i1, i3, i2);

        brIndices.push(i0, i1, i2);
        brIndices.push(i1, i3, i2);

        vlIndices.push(i0, i1, i2);
        vlIndices.push(i1, i3, i2);

        vrIndices.push(i0, i1, i2);
        vrIndices.push(i1, i3, i2);
      }
    }

    // Set Buffers
    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeom.setIndex(roadIndices);
    roadGeom.computeVertexNormals();

    const roadMat = new THREE.MeshLambertMaterial({
      map: this.createPixelRoadTexture()
    });
    this.roadMesh = new THREE.Mesh(roadGeom, roadMat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // Left Curb
    curbLeftGeom.setAttribute('position', new THREE.Float32BufferAttribute(clPositions, 3));
    curbLeftGeom.setAttribute('uv', new THREE.Float32BufferAttribute(clUvs, 2));
    curbLeftGeom.setIndex(clIndices);
    curbLeftGeom.computeVertexNormals();

    const curbMat = new THREE.MeshLambertMaterial({
      map: this.createPixelKerbTexture()
    });
    const curbLeftMesh = new THREE.Mesh(curbLeftGeom, curbMat);
    curbLeftMesh.receiveShadow = true;
    this.scene.add(curbLeftMesh);
    this.curbMeshes.push(curbLeftMesh);

    // Right Curb
    curbRightGeom.setAttribute('position', new THREE.Float32BufferAttribute(crPositions, 3));
    curbRightGeom.setAttribute('uv', new THREE.Float32BufferAttribute(crUvs, 2));
    curbRightGeom.setIndex(crIndices);
    curbRightGeom.computeVertexNormals();
    const curbRightMesh = new THREE.Mesh(curbRightGeom, curbMat);
    curbRightMesh.receiveShadow = true;
    this.scene.add(curbRightMesh);
    this.curbMeshes.push(curbRightMesh);

    // Armco Guardrails
    const barrierMat = new THREE.MeshStandardMaterial({
      map: this.createBarrierTexture(),
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide
    });

    barrierLeftGeom.setAttribute('position', new THREE.Float32BufferAttribute(blPositions, 3));
    barrierLeftGeom.setIndex(blIndices);
    barrierLeftGeom.computeVertexNormals();
    const barrierLeftMesh = new THREE.Mesh(barrierLeftGeom, barrierMat);
    this.scene.add(barrierLeftMesh);
    this.barrierMeshes.push(barrierLeftMesh);

    barrierRightGeom.setAttribute('position', new THREE.Float32BufferAttribute(brPositions, 3));
    barrierRightGeom.setIndex(brIndices);
    barrierRightGeom.computeVertexNormals();
    const barrierRightMesh = new THREE.Mesh(barrierRightGeom, barrierMat);
    this.scene.add(barrierRightMesh);
    this.barrierMeshes.push(barrierRightMesh);

    // Grass Embankment Verges
    const grassTex = this.createPixelGrassTexture();
    const vergeMat = new THREE.MeshLambertMaterial({ map: grassTex });

    vergeLeftGeom.setAttribute('position', new THREE.Float32BufferAttribute(vlPositions, 3));
    vergeLeftGeom.setAttribute('uv', new THREE.Float32BufferAttribute(vlUvs, 2));
    vergeLeftGeom.setIndex(vlIndices);
    vergeLeftGeom.computeVertexNormals();
    const vergeLeftMesh = new THREE.Mesh(vergeLeftGeom, vergeMat);
    vergeLeftMesh.receiveShadow = true;
    this.scene.add(vergeLeftMesh);

    vergeRightGeom.setAttribute('position', new THREE.Float32BufferAttribute(vrPositions, 3));
    vergeRightGeom.setAttribute('uv', new THREE.Float32BufferAttribute(vrUvs, 2));
    vergeRightGeom.setIndex(vrIndices);
    vergeRightGeom.computeVertexNormals();
    const vergeRightMesh = new THREE.Mesh(vergeRightGeom, vergeMat);
    vergeRightMesh.receiveShadow = true;
    this.scene.add(vergeRightMesh);
  }

  /**
   * Procedural Pixel Grass Texture
   */
  createPixelGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2d5a27'; // Dark forest green
    ctx.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 4) {
      for (let y = 0; y < 64; y += 4) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = Math.random() > 0.5 ? '#244820' : '#396d30';
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
    const grassTex = new THREE.CanvasTexture(canvas);
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(120, 120);
    grassTex.magFilter = THREE.NearestFilter;
    grassTex.minFilter = THREE.NearestFilter;
    return grassTex;
  }

  /**
   * Rolling Eifel Mountain Grass Terrain with Track Heightmap Carving
   * Ensures terrain NEVER clips into the road, curbs, or barriers!
   */
  generateTerrain() {
    const terrainSize = 4200;
    const terrainSegments = 120;
    const terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    terrainGeom.rotateX(-Math.PI / 2);

    const pos = terrainGeom.attributes.position;
    const sampleCount = this.sampledPoints.length;

    // Spatial acceleration grid for lightning-fast closest point queries
    const cellSize = 80;
    const grid = new Map();
    for (let k = 0; k < sampleCount; k++) {
      const pt = this.sampledPoints[k];
      const gx = Math.floor(pt.position.x / cellSize);
      const gz = Math.floor(pt.position.z / cellSize);
      const key = `${gx},${gz}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(pt);
    }

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Fast nearest track point lookup
      const gx = Math.floor(vx / cellSize);
      const gz = Math.floor(vz / cellSize);
      let minDistSq = Infinity;
      let closestPt = null;

      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const list = grid.get(`${gx + dx},${gz + dz}`);
          if (list) {
            for (let c = 0; c < list.length; c++) {
              const sp = list[c];
              const d2 = (sp.position.x - vx) * (sp.position.x - vx) + (sp.position.z - vz) * (sp.position.z - vz);
              if (d2 < minDistSq) {
                minDistSq = d2;
                closestPt = sp;
              }
            }
          }
        }
      }

      // Base rolling hills for distant scenery
      const hillBase = Math.sin(vx * 0.002) * Math.cos(vz * 0.002) * 45 + Math.sin(vx * 0.005 + 1.2) * 20;

      let y;
      if (closestPt && minDistSq < 240 * 240) {
        const dist = Math.sqrt(minDistSq);
        const trackY = closestPt.position.y;

        if (dist < 26) {
          // Inside track corridor: strictly under road level (no clipping possible!)
          y = trackY - 2.4;
        } else if (dist < 95) {
          // Embankment transition: blend smoothly from road level into regional hills
          const t = (dist - 26) / (95 - 26);
          const blend = t * t * (3 - 2 * t);
          const naturalY = trackY - 1.5 + (hillBase * 0.25);
          y = (trackY - 2.4) * (1 - blend) + naturalY * blend;
          // Absolute safety clamp within 60m of track
          if (dist < 60) {
            y = Math.min(y, trackY - 1.4);
          }
        } else {
          // Beyond 95m: blend up to regional mountain range
          const t = Math.min(1.0, (dist - 95) / 100);
          const blend = t * t * (3 - 2 * t);
          const nearHill = trackY - 1.2 + (hillBase * 0.4);
          y = nearHill * (1 - blend) + (hillBase - 15) * blend;
        }
      } else {
        // Distant background mountains
        y = hillBase - 15;
      }

      pos.setY(i, y);
    }
    terrainGeom.computeVertexNormals();

    const grassTex = this.createPixelGrassTexture();
    grassTex.repeat.set(200, 200);

    const terrainMat = new THREE.MeshLambertMaterial({
      map: grassTex
    });
    const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
    terrainMesh.position.y = -0.5;
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  /**
   * Retro Pixel Pine Trees (Eifel Forest)
   */
  generateSceneryAndTrees() {
    const treeCount = 900;
    // Low-poly pixel pine tree geometry (Cone + Cylinder)
    const trunkGeom = new THREE.CylinderGeometry(0.5, 0.7, 4, 5);
    const foliageGeom = new THREE.ConeGeometry(3.5, 9, 5);
    foliageGeom.translate(0, 5.5, 0);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e18, flatShading: true });
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x1f4724, flatShading: true });

    const trunkInst = new THREE.InstancedMesh(trunkGeom, trunkMat, treeCount);
    const foliageInst = new THREE.InstancedMesh(foliageGeom, foliageMat, treeCount);

    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < treeCount; i++) {
      // Pick random point along track and offset outward
      const sampleIdx = Math.floor(Math.random() * this.sampleCount);
      const curr = this.sampledPoints[sampleIdx];
      const p = curr.position;
      const normal = curr.normal;

      const side = Math.random() > 0.5 ? 1 : -1;
      const offsetDist = 18 + Math.random() * 120; // 18m to 138m from track
      const tx = p.x + normal.x * offsetDist * side + (Math.random() - 0.5) * 20;
      const tz = p.z + normal.z * offsetDist * side + (Math.random() - 0.5) * 20;
      const ty = p.y + (Math.random() - 0.5) * 6;

      const treeScale = 0.8 + Math.random() * 0.7;
      dummy.position.set(tx, ty, tz);
      dummy.scale.set(treeScale, treeScale, treeScale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      trunkInst.setMatrixAt(placed, dummy.matrix);
      foliageInst.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    trunkInst.castShadow = true;
    foliageInst.castShadow = true;
    this.scene.add(trunkInst);
    this.scene.add(foliageInst);
  }

  /**
   * Start / Finish Gantry Arch & Bilstein Bridge
   */
  generateStartGantryAndBridges() {
    // 1. Start / Finish Line Arch Gantry at t = 0
    const startPoint = this.sampledPoints[0];
    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(startPoint.position);

    // Align with track normal and tangent
    const rotMat = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      startPoint.tangent,
      new THREE.Vector3(0, 1, 0)
    );
    gantryGroup.quaternion.setFromRotationMatrix(rotMat);

    // Arch pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222d3d, metalness: 0.8 });
    const pillarGeom = new THREE.BoxGeometry(1.2, 8, 1.2);

    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-this.trackWidth * 0.55 - 1.5, 4, 0);
    gantryGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(this.trackWidth * 0.55 + 1.5, 4, 0);
    gantryGroup.add(rightPillar);

    // Top Crossbeam
    const beamGeom = new THREE.BoxGeometry(this.trackWidth + 6, 2.0, 2.0);
    const beam = new THREE.Mesh(beamGeom, pillarMat);
    beam.position.set(0, 8, 0);
    gantryGroup.add(beam);

    // Banner board texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141d';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#00ff66';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NÜRBURGRING NORDSCHLEIFE', 256, 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.fillText('START / FINISH LINE', 256, 95);

    const bannerTex = new THREE.CanvasTexture(canvas);
    bannerTex.magFilter = THREE.NearestFilter;
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth + 4, 1.8), bannerMat);
    bannerMesh.position.set(0, 8, 1.05);
    gantryGroup.add(bannerMesh);

    this.scene.add(gantryGroup);
    this.decorations.push(gantryGroup);

    // 2. Famous Bilstein Bridge over Döttinger Höhe (around t = 0.95)
    const bridgeSample = this.sampledPoints[Math.floor(this.sampleCount * 0.95)];
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.copy(bridgeSample.position);
    const bridgeRot = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      bridgeSample.tangent,
      new THREE.Vector3(0, 1, 0)
    );
    bridgeGroup.quaternion.setFromRotationMatrix(bridgeRot);

    // Bridge arch
    const bridgeArch = new THREE.Mesh(new THREE.BoxGeometry(this.trackWidth + 8, 3.2, 4.0), new THREE.MeshStandardMaterial({ color: 0x1a3d6e }));
    bridgeArch.position.set(0, 8.5, 0);
    bridgeGroup.add(bridgeArch);

    // Bilstein Logo Banner
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 512;
    bCanvas.height = 128;
    const bCtx = bCanvas.getContext('2d');
    bCtx.fillStyle = '#ffcc00';
    bCtx.fillRect(0, 0, 512, 128);
    bCtx.fillStyle = '#003399';
    bCtx.font = 'bold 50px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText('BILSTEIN', 256, 85);

    const bTex = new THREE.CanvasTexture(bCanvas);
    bTex.magFilter = THREE.NearestFilter;
    const bSign = new THREE.Mesh(new THREE.PlaneGeometry(this.trackWidth + 5, 2.5), new THREE.MeshBasicMaterial({ map: bTex }));
    bSign.position.set(0, 8.5, 2.05);
    bridgeGroup.add(bSign);

    this.scene.add(bridgeGroup);
    this.decorations.push(bridgeGroup);
  }

  /**
   * Setup 12 Sector checkpoints for lap timing
   */
  setupCheckpoints() {
    this.checkpoints = [];
    const sectorCount = 12;
    for (let i = 0; i < sectorCount; i++) {
      const u = i / sectorCount;
      const point = this.trackCurve.getPointAt(u);
      this.checkpoints.push({
        index: i,
        u,
        position: point,
        passed: false
      });
    }
  }

  /**
   * Find nearest track point and elevation for the vehicle
   */
  getClosestTrackPoint(carPos) {
    let closest = this.sampledPoints[0];
    let minDistSq = Infinity;

    // Fast search through sampled points
    for (let i = 0; i < this.sampleCount; i++) {
      const sp = this.sampledPoints[i];
      const dx = sp.position.x - carPos.x;
      const dz = sp.position.z - carPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = sp;
      }
    }

    // Calculate lateral offset from centerline
    const toCar = new THREE.Vector3(carPos.x - closest.position.x, 0, carPos.z - closest.position.z);
    const lateralDist = toCar.dot(closest.normal);
    const isOffTrack = Math.abs(lateralDist) > (this.trackWidth * 0.5 + 2.0);

    // Current landmark name
    let activeLandmark = this.landmarks[0].name;
    for (let i = this.landmarks.length - 1; i >= 0; i--) {
      if (closest.u >= this.landmarks[i].t) {
        activeLandmark = this.landmarks[i].name;
        break;
      }
    }

    return {
      point: closest.position,
      tangent: closest.tangent,
      normal: closest.normal,
      u: closest.u,
      elevationY: closest.position.y,
      lateralDist,
      isOffTrack,
      landmark: activeLandmark
    };
  }

  /**
   * Returns start line spawn position and orientation
   */
  getSpawnTransform() {
    const p0 = this.sampledPoints[0].position;
    const tangent = this.sampledPoints[0].tangent;
    const heading = Math.atan2(tangent.x, tangent.z);
    return {
      x: p0.x,
      y: p0.y + 0.35,
      z: p0.z,
      heading
    };
  }
}
