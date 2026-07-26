import { useEffect, useRef } from 'react';

/**
 * Renders the #bg-canvas element and drives the same Three.js particle-web
 * background used across every page in the original app (js/app.js ->
 * initThreeBackground). Logic is ported as-is, just scoped to this component
 * and cleaned up on unmount.
 */
export default function ThreeBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    function boot() {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const THREE = window.THREE;
      if (!canvas || typeof THREE === 'undefined') return;

      const W = (canvas.width = window.innerWidth);
      const H = (canvas.height = window.innerHeight);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setSize(W, H);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
      camera.position.z = 5;
      const NODES = 80;
      const palette = [0x00f0ff, 0x0075ff, 0x00ffb3, 0xff3c78, 0x8b5cf6];
      const nodeGeo = new THREE.SphereGeometry(0.045, 5, 5);
      const perGroup = Math.ceil(NODES / palette.length);
      const instanceGroups = palette.map((col) => {
        const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 });
        const im = new THREE.InstancedMesh(nodeGeo, mat, perGroup);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(im);
        return { im, mat };
      });
      const dummy = new THREE.Object3D();
      const nodePositions = [];
      for (let i = 0; i < NODES; i++) {
        nodePositions.push({
          x: (Math.random() - 0.5) * 14,
          y: (Math.random() - 0.5) * 10,
          z: (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.006,
          vy: (Math.random() - 0.5) * 0.005,
          vz: (Math.random() - 0.5) * 0.004,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.4 + 0.3,
        });
      }
      const MAX_LINES = 100;
      const linePool = [];
      for (let k = 0; k < MAX_LINES; k++) {
        const pts = [new THREE.Vector3(), new THREE.Vector3()];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x0075ff, transparent: true, opacity: 0.05, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        scene.add(line);
        linePool.push({ line, pts, geo, mat });
      }
      function updateLines() {
        let slot = 0;
        outer: for (let i = 0; i < NODES; i++) {
          for (let j = i + 1; j < NODES; j++) {
            const a = nodePositions[i], b = nodePositions[j];
            const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < 7.84) {
              if (slot >= MAX_LINES) break outer;
              const L = linePool[slot];
              L.pts[0].set(a.x, a.y, a.z);
              L.pts[1].set(b.x, b.y, b.z);
              L.geo.setFromPoints(L.pts);
              L.mat.opacity = 0.05 * (1 - Math.sqrt(d2) / 2.8);
              L.line.visible = true;
              slot++;
            }
          }
        }
        for (let k = slot; k < MAX_LINES; k++) linePool[k].line.visible = false;
      }
      const shapes = [];
      const shapeGeos = [new THREE.OctahedronGeometry(0.25, 0), new THREE.TetrahedronGeometry(0.22, 0)];
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: palette[i % 5], wireframe: true, transparent: true, opacity: Math.random() * 0.22 + 0.06 });
        const mesh = new THREE.Mesh(shapeGeos[i % 2], mat);
        mesh.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
        mesh.userData = {
          ry: (0.002 + Math.random() * 0.004) * (Math.random() > 0.5 ? 1 : -1),
          rx: (0.001 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
          floatAmp: Math.random() * 0.12 + 0.04,
          floatSpeed: Math.random() * 0.4 + 0.2,
          floatPhase: Math.random() * Math.PI * 2,
          baseY: mesh.position.y,
        };
        scene.add(mesh);
        shapes.push(mesh);
      }
      const rings = [];
      for (let i = 0; i < 2; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: [0x00f0ff, 0x8b5cf6][i], transparent: true, opacity: 0.06 });
        const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.9 + i * 0.5, 0.012, 5, 36), mat);
        mesh.position.set((i ? 1 : -1) * 2, (i ? 1 : -1) * 1.5, -2);
        mesh.userData = { rx: 0.001 * (i + 1), ry: 0.002 * (i + 1) };
        scene.add(mesh);
        rings.push(mesh);
      }
      let _rx = 0, _ry = 0, mx = 0, my = 0, mouseDirty = false;
      const mouseWorld = { x: 0, y: 0, active: false };
      const onMouseMove = (e) => { _rx = e.clientX; _ry = e.clientY; mouseDirty = true; mouseWorld.active = true; };
      const onMouseLeave = () => { mouseWorld.active = false; };
      document.addEventListener('mousemove', onMouseMove, { passive: true });
      document.addEventListener('mouseleave', onMouseLeave);

      const GLOW_R = 3.5, GLOW_R2 = GLOW_R * GLOW_R, GLOW_SC = 2.2;
      let lineTimer = 0;
      const clock = new THREE.Clock();
      let rafId;
      function animate() {
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        if (mouseDirty) {
          mx = (_rx / window.innerWidth - 0.5) * 0.8;
          my = (_ry / window.innerHeight - 0.5) * 0.6;
          mouseWorld.x = (_rx / window.innerWidth - 0.5) * 14;
          mouseWorld.y = -(_ry / window.innerHeight - 0.5) * 10;
          mouseDirty = false;
        }
        camera.position.x += (mx * 0.5 - camera.position.x) * 0.025;
        camera.position.y += (-my * 0.4 - camera.position.y) * 0.025;
        camera.lookAt(0, 0, 0);
        nodePositions.forEach((p, i) => {
          p.x += p.vx; p.y += p.vy; p.z += p.vz;
          if (Math.abs(p.x) > 7) p.vx *= -1;
          if (Math.abs(p.y) > 5) p.vy *= -1;
          if (Math.abs(p.z) > 4) p.vz *= -1;
          let op = 0.3 + 0.38 * Math.sin(t * p.speed + p.phase);
          let sc = 1;
          if (mouseWorld.active) {
            const dx = p.x - mouseWorld.x, dy = p.y - mouseWorld.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < GLOW_R2) {
              const str = 1 - Math.sqrt(d2) / GLOW_R;
              op = Math.min(1, op + str * 0.6);
              sc = 1 + str * (GLOW_SC - 1);
            }
          }
          const gIdx = i % palette.length;
          const lIdx = Math.floor(i / palette.length);
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          instanceGroups[gIdx].im.setMatrixAt(lIdx, dummy.matrix);
          instanceGroups[gIdx].mat.opacity = op;
          instanceGroups[gIdx].im.instanceMatrix.needsUpdate = true;
        });
        if (++lineTimer % 90 === 0) updateLines();
        shapes.forEach((s) => {
          s.rotation.y += s.userData.ry;
          s.rotation.x += s.userData.rx;
          s.position.y = s.userData.baseY + Math.sin(t * s.userData.floatSpeed + s.userData.floatPhase) * s.userData.floatAmp;
        });
        rings.forEach((r) => { r.rotation.x += r.userData.rx; r.rotation.y += r.userData.ry; });
        renderer.render(scene, camera);
      }
      updateLines();
      animate();

      const onResize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        canvas.width = w;
        canvas.height = h;
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      };
    }

    if (window.THREE) {
      boot();
    } else {
      const existing = document.getElementById('three-cdn-script');
      if (existing) {
        existing.addEventListener('load', boot);
      } else {
        const s = document.createElement('script');
        s.id = 'three-cdn-script';
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s.onload = boot;
        document.head.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
