// File: frontend/src/components/HeroCar.jsx
// Purpose: React component used across the frontend UI.
// Original description: Landing hero visual - three vehicles take turns in one parking bay
// (one 47s loop):   1) a Kawasaki-style 2-wheeler   (0-14s)   2) a yellow auto-rickshaw
// (14-28s)   3) a Lamborghini Centenario     (28-47s)  <- rendered from the supplied .glb
// model Each one drives in, parks, waits, then leaves before the next one arrives.  The
// Lamborghini is NOT a live 3D scene (the .glb is ~20 MB / 325k triangles, far too heavy
// for a landing page). Instead the model was rendered once from the side into two tiny
// transparent images (body ~60 KB, wheel ~15 KB) that slot into the same CSS animation
// system as the other two vehicles:   .hc-drive  forward / reverse travel      .hc-depth
// lane -> bay distance   .hc-yaw    steering + brake dive         .hc-wheel  wheel spin
// (keyframed to the travel)   .hc-brake / .hc-rev / .hc-head  lamp glows Pure inline SVG +
// CSS transforms/opacity - no JS animation loop, canvas or listeners.
// Contains:
//   - HeroCar
//   - BikeWheel
//   - Bike
//   - RickWheel
//   - Rickshaw
//
// NOTE: Source code intentionally removed. Implementation goes here.
