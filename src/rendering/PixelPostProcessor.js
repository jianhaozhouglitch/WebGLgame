/**
 * PixelPostProcessor.js
 * Custom WebGL Post-Processing Pipeline implementing retro pixelation,
 * Bayer matrix dithering, and retro color quantization.
 */

import * as THREE from 'three';

export class PixelPostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.pixelScale = 1.5; // Default 1.5x downscaling
    this.renderTarget = null;
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMesh = null;
    this.postMaterial = null;

    this.initPipeline();
  }

  initPipeline() {
    const width = Math.max(320, Math.floor(window.innerWidth / this.pixelScale));
    const height = Math.max(240, Math.floor(window.innerHeight / this.pixelScale));

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    });

    // Retro Pixel Fragment Shader
    const pixelShader = {
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uDitherStrength;
        varying vec2 vUv;

        // 4x4 Bayer Dither Matrix for retro 16-bit arcade gradient feel
        float bayer4(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int index = x + y * 4;
          if (index == 0) return 0.0 / 16.0;
          if (index == 1) return 8.0 / 16.0;
          if (index == 2) return 2.0 / 16.0;
          if (index == 3) return 10.0 / 16.0;
          if (index == 4) return 12.0 / 16.0;
          if (index == 5) return 4.0 / 16.0;
          if (index == 6) return 14.0 / 16.0;
          if (index == 7) return 6.0 / 16.0;
          if (index == 8) return 3.0 / 16.0;
          if (index == 9) return 11.0 / 16.0;
          if (index == 10) return 1.0 / 16.0;
          if (index == 11) return 9.0 / 16.0;
          if (index == 12) return 15.0 / 16.0;
          if (index == 13) return 7.0 / 16.0;
          if (index == 14) return 13.0 / 16.0;
          return 5.0 / 16.0;
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          // Pixel color grading & subtle retro contrast
          vec3 rgb = color.rgb;
          
          // Apply slight retro color quantization
          float dither = (bayer4(gl_FragCoord.xy) - 0.5) * uDitherStrength;
          rgb += dither;
          
          // Color step quantization (32 steps per channel for arcade feel)
          rgb = floor(rgb * 32.0 + 0.5) / 32.0;

          gl_FragColor = vec4(rgb, color.a);
        }
      `
    };

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: pixelShader.vertexShader,
      fragmentShader: pixelShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uDitherStrength: { value: 0.035 }
      },
      depthWrite: false,
      depthTest: false
    });

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(quadGeom, this.postMaterial);
    this.postScene.add(this.quadMesh);
  }

  setPixelScale(scale) {
    this.pixelScale = Math.max(1, scale);
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(width, height) {
    const targetW = Math.max(320, Math.floor(width / this.pixelScale));
    const targetH = Math.max(240, Math.floor(height / this.pixelScale));

    if (this.renderTarget) {
      this.renderTarget.dispose();
    }

    this.renderTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    });

    if (this.postMaterial) {
      this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
      this.postMaterial.uniforms.uResolution.value.set(targetW, targetH);
    }
  }

  render() {
    // 1. Render main 3D scene into low-resolution offscreen target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // 2. Render post-processing quad to screen with pixelated nearest-neighbor filter
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
