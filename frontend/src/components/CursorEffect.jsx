import { useEffect } from 'react';
import useIsMobile from '../lib/useIsMobile';

/**
 * Ports initAntigravityCursor() from the original js/app.js verbatim.
 * Mounted once at the app root so the effect persists across route changes.
 *
 * Desktop/laptop only: on mobile the custom cursor (and its antigravity
 * web-particle canvas) is skipped entirely so the interface behaves like a
 * normal touch UI (native cursor, no cursor:none override, no canvas).
 */
export default function CursorEffect() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return undefined;
    if (document.getElementById('ag-web-canvas')) return undefined;

    const cvs = document.createElement('canvas');
    cvs.id = 'ag-web-canvas';
    document.body.appendChild(cvs);

    const dot = document.createElement('div');
    dot.id = 'ag-cursor-dot';
    document.body.appendChild(dot);

    const style = document.createElement('style');
    style.id = 'ag-cursor-style';
    style.textContent = `
      *{cursor:none!important}
      #ag-web-canvas{position:fixed;inset:0;pointer-events:none;z-index:9990;width:100vw;height:100vh;}
      #ag-cursor-dot{
        position:fixed;pointer-events:none;z-index:99999;
        width:28px;height:28px;
        transform:translate(-50%,-50%);
        will-change:left,top,transform;
        background:none!important;
        border:none!important;
        border-radius:0!important;
        box-shadow:none!important;
        background-color:transparent!important;
        -webkit-tap-highlight-color:transparent!important;
        transition:filter .15s;
        filter:drop-shadow(0 0 3px rgba(180,180,180,.7)) drop-shadow(0 0 8px rgba(150,150,150,.3));
      }
      #ag-cursor-dot.ag-hovered{
        filter:drop-shadow(0 0 6px rgba(200,200,200,.9)) drop-shadow(0 0 16px rgba(180,180,180,.5));
      }
      @keyframes legWalkL{0%,100%{transform:rotate(0deg);}30%{transform:rotate(10deg);}70%{transform:rotate(-10deg);}}
      @keyframes legWalkR{0%,100%{transform:rotate(0deg);}30%{transform:rotate(-10deg);}70%{transform:rotate(10deg);}}
      @keyframes bodyBob{0%,100%{transform:translateY(0px);}50%{transform:translateY(1.5px);}}
      #ag-cursor-dot .sp-body{animation:bodyBob .45s ease-in-out infinite;}
      #ag-cursor-dot.ag-hovered .sp-leg-l{animation:legWalkL .22s ease-in-out infinite;transform-origin:13px 14px;}
      #ag-cursor-dot.ag-hovered .sp-leg-r{animation:legWalkR .22s ease-in-out infinite;transform-origin:15px 14px;}
      .ag-web-throw{position:fixed;pointer-events:none;z-index:9989;filter:drop-shadow(0 0 3px rgba(180,180,180,.5));opacity:0;transition:opacity .08s;}
    `;
    document.head.appendChild(style);

    dot.innerHTML = `<svg id="ag-spider-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="28" height="28" viewBox="0 0 28 28"
      style="display:block;overflow:visible;background:none;">
      <g class="sp-body">
        <g class="sp-leg-l">
          <line x1="13" y1="11" x2="3"  y2="6"  stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="3"  y1="6"  x2="1"  y2="3"  stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="13" y1="13" x2="2"  y2="13" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="2"  y1="13" x2="0"  y2="11" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="13" y1="15" x2="3"  y2="19" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="3"  y1="19" x2="1"  y2="22" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="13" y1="17" x2="5"  y2="24" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="5"  y1="24" x2="3"  y2="27" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
        </g>
        <g class="sp-leg-r">
          <line x1="15" y1="11" x2="25" y2="6"  stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="25" y1="6"  x2="27" y2="3"  stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="15" y1="13" x2="26" y2="13" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="26" y1="13" x2="28" y2="11" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="15" y1="15" x2="25" y2="19" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="25" y1="19" x2="27" y2="22" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
          <line x1="15" y1="17" x2="23" y2="24" stroke="#888888" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="23" y1="24" x2="25" y2="27" stroke="#888888" stroke-width=".9"  stroke-linecap="round"/>
        </g>
        <circle cx="14" cy="9" r="3.2" fill="#2a0020" stroke="#888888" stroke-width="1"/>
        <circle cx="12.5" cy="8.5" r=".9" fill="#fff" opacity=".95"/>
        <circle cx="15.5" cy="8.5" r=".9" fill="#fff" opacity=".95"/>
        <circle cx="12.5" cy="8.5" r="1.5" fill="#aaaaaa" opacity=".3"/>
        <circle cx="15.5" cy="8.5" r="1.5" fill="#aaaaaa" opacity=".3"/>
        <ellipse cx="14" cy="18" rx="4.5" ry="6" fill="#1a0015" stroke="#888888" stroke-width="1"/>
        <ellipse cx="14" cy="17.5" rx="1.8" ry="2.8" fill="#888888" opacity=".2"/>
        <circle  cx="14" cy="14"   r="1"   fill="#888888" opacity=".5"/>
      </g>
    </svg>`;

    function resize() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
    resize();

    const NODE_COUNT = 90, WEB_R = 190, CROSS_R = 110;
    let webNodes = [];
    function resetNodes() {
      webNodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        webNodes.push({
          x: Math.random() * cvs.width, y: Math.random() * cvs.height,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        });
      }
    }
    resetNodes();
    const onResize = () => { resize(); resetNodes(); };
    window.addEventListener('resize', onResize);

    let _mx = -9999, _my = -9999, mx = -9999, my = -9999, isOnPage = false, mouseDirty = false;
    let prevMx = -9999, prevMy = -9999;
    let spiderAngle = 0, targetAngle = 0, lastMoveTime = 0;

    const onMouseMove = (e) => {
      _mx = e.clientX; _my = e.clientY; isOnPage = true; mouseDirty = true;
      dot.style.left = _mx + 'px'; dot.style.top = _my + 'px';
      const dx = _mx - prevMx, dy = _my - prevMy;
      if (Math.sqrt(dx * dx + dy * dy) > 2) {
        targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
        lastMoveTime = Date.now();
      }
      prevMx = _mx; prevMy = _my;
    };
    const onMouseLeave = () => { isOnPage = false; };
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    const hoverSel = 'a,button,input,textarea,select,[onclick],.sidebar-avatar,.btn-ag,.btn-close,.btn-logout,.profile-avatar-wrap,.slot-tile,[role="button"]';
    const onMouseOver = (e) => { if (e.target.closest && e.target.closest(hoverSel)) dot.classList.add('ag-hovered'); };
    const onMouseOut = (e) => { if (e.target.closest && e.target.closest(hoverSel)) dot.classList.remove('ag-hovered'); };
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);

    let lastThrow = 0, lastTarget = null;
    function throwWeb(target) {
      const clickable = target && target.closest && target.closest(hoverSel + ',.btn,[role="button"]');
      if (!clickable) return;
      const rect = clickable.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      // mousedown + click (and touchstart) can all fire for the same user
      // action — guard against throwing the net twice for one interaction.
      const now = Date.now();
      if (clickable === lastTarget && now - lastThrow < 150) return;
      lastThrow = now; lastTarget = clickable;

      const PAD = 6;
      const x = rect.left - PAD, y = rect.top - PAD;
      const W = rect.width + PAD * 2, H = rect.height + PAD * 2;
      const cx = W / 2, cy = H / 2;
      const RINGS = 6, SPOKES = 14;
      let paths = '';
      for (let s = 0; s < SPOKES; s++) {
        const angle = (s / SPOKES) * Math.PI * 2;
        paths += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * (W / 2) * 0.88}" y2="${cy + Math.sin(angle) * (H / 2) * 0.88}" stroke="#888888" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>`;
      }
      for (let r = 1; r <= RINGS; r++) {
        const t = r / RINGS;
        const rx = (W / 2 - 4) * t * 0.88, ry = (H / 2 - 4) * t * 0.88;
        paths += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#888888" stroke-width="${0.5 + t * 0.6}" opacity="${0.3 + t * 0.5}"/>`;
        for (let s = 0; s < SPOKES; s++) {
          const a1 = (s / SPOKES) * Math.PI * 2, a2 = ((s + 1) / SPOKES) * Math.PI * 2;
          paths += `<line x1="${cx + Math.cos(a1) * (W / 2) * t * 0.88}" y1="${cy + Math.sin(a1) * (H / 2) * t * 0.88}" x2="${cx + Math.cos(a2) * (W / 2) * t * 0.88}" y2="${cy + Math.sin(a2) * (H / 2) * t * 0.88}" stroke="#888888" stroke-width="0.5" opacity="${0.25 + t * 0.4}" stroke-linecap="round"/>`;
        }
      }
      for (let r = 1; r <= RINGS; r += 2) {
        const t = r / RINGS;
        for (let s = 0; s < SPOKES; s += 2) {
          const angle = (s / SPOKES) * Math.PI * 2;
          paths += `<circle cx="${cx + Math.cos(angle) * (W / 2) * t * 0.88}" cy="${cy + Math.sin(angle) * (H / 2) * t * 0.88}" r="1.3" fill="#bbbbbb" opacity="0.75"/>`;
        }
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.setAttribute('class', 'ag-web-throw');
      svg.style.cssText = `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:9989;filter:drop-shadow(0 0 3px rgba(180,180,180,.5));opacity:0;transition:opacity .08s;`;
      svg.innerHTML = paths;
      document.body.appendChild(svg);
      requestAnimationFrame(() => {
        svg.style.opacity = '1';
        setTimeout(() => {
          svg.style.transition = 'opacity .4s';
          svg.style.opacity = '0';
          setTimeout(() => svg.remove(), 420);
        }, 450);
      });
    }
    const onMouseDown = (e) => { dot.style.display = 'block'; throwWeb(e.target); };
    const onMouseUp = () => { dot.style.display = 'block'; };
    const onClick = (e) => { throwWeb(e.target); };
    const onTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        throwWeb(document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY));
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', onClick);
    document.addEventListener('touchstart', onTouchStart, { passive: true });

    function lerpAngle(a, b, t) {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    }

    const spiderSvg = document.getElementById('ag-spider-svg');
    const ctx = cvs.getContext('2d');
    let frameCount = 0;
    let rafId;

    (function draw() {
      rafId = requestAnimationFrame(draw);
      frameCount++;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      if (mouseDirty) { mx = _mx; my = _my; mouseDirty = false; }

      if (Date.now() - lastMoveTime > 5000) targetAngle = 0;
      spiderAngle = lerpAngle(spiderAngle, targetAngle, 0.07);
      if (spiderSvg) {
        spiderSvg.style.transform = `rotate(${((spiderAngle * 180) / Math.PI).toFixed(2)}deg)`;
        spiderSvg.style.transformOrigin = '14px 14px';
      }

      const W = cvs.width, H = cvs.height;
      for (let k = 0; k < webNodes.length; k++) {
        const n = webNodes[k];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) { n.vx *= -1; n.x = n.x < 0 ? 0 : W; }
        if (n.y < 0 || n.y > H) { n.vy *= -1; n.y = n.y < 0 ? 0 : H; }
      }

      if (!isOnPage) return;

      const WEB_R2 = WEB_R * WEB_R;
      const near = [];
      for (let k = 0; k < webNodes.length; k++) {
        const n = webNodes[k];
        const dx = n.x - mx, dy = n.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < WEB_R2) near.push({ n, d: Math.sqrt(d2) });
      }

      for (let k = 0; k < near.length; k++) {
        const { n, d } = near[k];
        const t = 1 - d / WEB_R;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = `rgba(200,200,200,${(t * 0.72).toFixed(2)})`;
        ctx.lineWidth = t * 1.5 + 0.2; ctx.stroke();
      }

      if (frameCount % 2 === 0) {
        const CROSS_R2 = CROSS_R * CROSS_R;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const a = near[i].n, b = near[j].n;
            const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 < CROSS_R2) {
              const prox = 1 - Math.sqrt(d2) / CROSS_R;
              const cf = 1 - ((near[i].d + near[j].d) * 0.5) / WEB_R;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(180,180,180,${(prox * cf * 0.35).toFixed(2)})`;
              ctx.lineWidth = 0.6; ctx.stroke();
            }
          }
        }
      }

      for (let k = 0; k < near.length; k++) {
        const { n, d } = near[k];
        const t = 1 - d / WEB_R;
        ctx.beginPath(); ctx.arc(n.x, n.y, t * 2.5 + 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,200,200,${(t * 0.9).toFixed(2)})`; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(mx, my, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,200,0.06)'; ctx.fill();
    })();

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onClick);
      document.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('resize', onResize);
      cvs.remove(); dot.remove(); style.remove();
    };
  }, [isMobile]);

  return null;
}