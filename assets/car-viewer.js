import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PINK = 0xe00e82;
const PINK_SOFT = 0xff85c4;
const BG = 0x121317;

const COLORS = [
  { name: 'Magenta',  hex: 0xe00e82 },
  { name: 'Crimson',  hex: 0xc4123a },
  { name: 'Sapphire', hex: 0x1f4cff },
  { name: 'Emerald',  hex: 0x00a86b },
  { name: 'Silver',   hex: 0xb8b8c0 },
  { name: 'Sunburst', hex: 0xff9a1f },
  { name: 'Onyx',     hex: 0x111114 },
];

// Scroll sensitivity: ~one full rotation per ~1500px scrolled
const SCROLL_RADIANS_PER_PX = (Math.PI * 2) / 1500;

export function initCarViewer(container, { modelUrl }) {
  // Make sure container can host absolute children (swatches)
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.6, 7.2);
  camera.lookAt(0, 0.7, 0);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const rimLeft = new THREE.SpotLight(PINK, 60, 12, Math.PI / 5, 0.6, 1.2);
  rimLeft.position.set(-5, 3.5, -3);
  rimLeft.target.position.set(0, 0.6, 0);
  scene.add(rimLeft, rimLeft.target);

  const rimRight = new THREE.SpotLight(PINK_SOFT, 35, 12, Math.PI / 5, 0.6, 1.2);
  rimRight.position.set(5, 3.5, -3);
  rimRight.target.position.set(0, 0.6, 0);
  scene.add(rimRight, rimRight.target);

  const fill = new THREE.HemisphereLight(0xffffff, 0x1a1422, 0.3);
  scene.add(fill);

  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.08, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0d0e12,
      metalness: 0.7,
      roughness: 0.15,
    })
  );
  podium.position.y = -0.04;
  scene.add(podium);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.012, 12, 128),
    new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.001;
  scene.add(ring);

  const carGroup = new THREE.Group();
  scene.add(carGroup);

  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const status = document.createElement('div');
  status.textContent = 'Loading model…';
  status.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e2bdc8;font-family:Inter,sans-serif;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;pointer-events:none;';
  container.appendChild(status);

  // Track which materials belong to the car body (largest opaque mesh)
  let bodyMaterials = [];

  loader.load(
    modelUrl,
    (gltf) => {
      const car = gltf.scene;

      car.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if ('envMapIntensity' in m) m.envMapIntensity = 2.0;
            if ('metalness' in m && m.metalness > 0.3) {
              m.roughness = Math.min(m.roughness ?? 0.4, 0.22);
            }
          });
        }
      });

      // Auto-fit
      const box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      car.position.sub(center);
      const targetSize = 3.4;
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = targetSize / maxDim;
      car.scale.setScalar(scale);
      const rescaledBox = new THREE.Box3().setFromObject(car);
      car.position.y -= rescaledBox.min.y - 0.04;

      carGroup.add(car);

      // Find the canonical Body_Paint material the converter created.
      // Falls back to the largest opaque mesh's material if not found.
      const collected = new Set();
      car.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          if (m && m.name === 'Body_Paint') collected.add(m);
        });
      });
      if (collected.size === 0) {
        let biggest = null;
        let biggestVol = 0;
        car.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (m.transparent || (m.opacity ?? 1) < 1) return;
          const b = new THREE.Box3().setFromObject(o);
          const s = b.getSize(new THREE.Vector3());
          const vol = s.x * s.y * s.z;
          if (vol > biggestVol) {
            biggestVol = vol;
            biggest = m;
          }
        });
        if (biggest) collected.add(biggest);
      }
      bodyMaterials = [...collected];
      bodyMaterials.forEach((m) => {
        if (m.map) { m.map = null; m.needsUpdate = true; }
        m.metalness = 1.0;
        m.roughness = 0.18;
        m.envMapIntensity = 2.4;
        m.color.setHex(COLORS[0].hex);
      });

      // Pre-compile shaders + warmup-render so the first visible frame
      // is jank-free. Without this, the first scroll-into-view incurs
      // ~200-500ms of one-time shader compile + geometry upload.
      try {
        renderer.compile(scene, camera);
        renderer.render(scene, camera);
      } catch (e) { /* non-fatal */ }

      status.remove();
    },
    undefined,
    (err) => {
      status.textContent = 'Could not load 3D model';
      console.error('GLB load error', err);
    }
  );

  // Scroll-driven yaw — smooth, vertical-axis locked
  let targetYaw = 0;
  let currentYaw = 0;

  function updateFromScroll() {
    targetYaw = window.scrollY * SCROLL_RADIANS_PER_PX;
  }

  window.addEventListener('scroll', updateFromScroll, { passive: true });
  updateFromScroll();
  currentYaw = targetYaw; // start aligned, don't sweep from 0 on load

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // Only render when the viewer is on/near the screen. Saves CPU/GPU when
  // off-screen and gives shader compile / warmup render time to settle
  // before the user actually sees the canvas.
  let isVisible = false;
  if ('IntersectionObserver' in window) {
    const vis = new IntersectionObserver((entries) => {
      isVisible = entries.some((e) => e.isIntersecting);
    }, { rootMargin: '200px' });
    vis.observe(container);
  } else {
    isVisible = true;
  }

  function tick() {
    if (isVisible) {
      currentYaw += (targetYaw - currentYaw) * 0.18;
      carGroup.rotation.y = currentYaw;
      carGroup.rotation.x = 0;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Color swatches ----------
  const swatchBar = document.createElement('div');
  swatchBar.style.cssText = [
    'position:absolute',
    'left:50%',
    'bottom:14px',
    'transform:translateX(-50%)',
    'display:flex',
    'gap:8px',
    'padding:8px 12px',
    'background:rgba(13,14,18,0.7)',
    'backdrop-filter:blur(8px)',
    '-webkit-backdrop-filter:blur(8px)',
    'border:1px solid rgba(255,133,196,0.18)',
    'border-radius:999px',
    'z-index:5',
  ].join(';');

  COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', c.name);
    btn.title = c.name;
    btn.dataset.color = c.name;
    const hex = '#' + c.hex.toString(16).padStart(6, '0');
    btn.style.cssText = [
      'width:22px',
      'height:22px',
      'border-radius:999px',
      `background:${hex}`,
      'border:2px solid rgba(255,255,255,0.15)',
      'cursor:pointer',
      'padding:0',
      'transition:transform .15s ease, border-color .15s ease',
    ].join(';');
    if (i === 0) btn.style.borderColor = 'rgba(255,255,255,0.9)';
    btn.addEventListener('click', () => {
      bodyMaterials.forEach((m) => m.color.setHex(c.hex));
      [...swatchBar.children].forEach((b) => (b.style.borderColor = 'rgba(255,255,255,0.15)'));
      btn.style.borderColor = 'rgba(255,255,255,0.9)';
    });
    btn.addEventListener('mouseenter', () => (btn.style.transform = 'scale(1.15)'));
    btn.addEventListener('mouseleave', () => (btn.style.transform = 'scale(1)'));
    swatchBar.appendChild(btn);
  });

  container.appendChild(swatchBar);
}
