const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const distanceLabel = document.getElementById("distanceLabel");
const killsLabel = document.getElementById("killsLabel");
const speedLabel = document.getElementById("speedLabel");
const startOverlay = document.getElementById("startOverlay");
const endOverlay = document.getElementById("endOverlay");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const finalSummary = document.getElementById("finalSummary");
const mobileControls = document.querySelectorAll(".mobile-controls button");

const W = canvas.width;
const H = canvas.height;
const CX = W * 0.5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const randomRange = (min, max) => min + Math.random() * (max - min);

const state = {
  mode: "idle",
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
  },
  distance: 0,
  kills: 0,
  worldSpeed: 6.5,
  targetSpeed: 6.5,
  cameraBob: 0,
  t: 0,
  message: "",
};

const player = {
  lane: 0,
  x: 0,
  y: H - 165,
  radius: 34,
  moveCooldown: 0,
  arrowCooldown: 0,
  blinkTime: 0,
};

const trail = {
  topY: 170,
  bottomY: H + 24,
  topWidth: 220,
  bottomWidth: 990,
};

const laneOffsets = [-1, 0, 1];
const ninjas = [];
const arrows = [];
const particles = [];
const treesNear = [];
const treesFar = [];
const mistLayers = [];

for (let i = 0; i < 16; i += 1) {
  treesFar.push({
    x: Math.random() * W,
    scale: randomRange(0.7, 1.15),
    phase: Math.random() * Math.PI * 2,
  });
}

for (let i = 0; i < 12; i += 1) {
  treesNear.push({
    x: Math.random() * W,
    scale: randomRange(0.85, 1.35),
    sway: Math.random() * Math.PI * 2,
    side: Math.random() > 0.5 ? 1 : -1,
  });
}

for (let i = 0; i < 4; i += 1) {
  mistLayers.push({
    x: Math.random() * W,
    y: randomRange(90, 260),
    speed: randomRange(8, 24),
    size: randomRange(180, 320),
    alpha: randomRange(0.05, 0.13),
  });
}

function laneToX(laneIndex, z) {
  const perspective = Math.pow(clamp(z, 0, 1), 0.92);
  const width = lerp(trail.topWidth, trail.bottomWidth, perspective);
  const laneFactor = laneOffsets[laneIndex + 1] ?? 0;
  return CX + laneFactor * width * 0.24;
}

function zToY(z) {
  return lerp(trail.topY, trail.bottomY, Math.pow(z, 1.05));
}

function zScale(z) {
  return lerp(0.34, 1.2, Math.pow(z, 1.12));
}

function makeNinja() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const typeRoll = Math.random();
  const type = typeRoll > 0.82 ? "elite" : typeRoll > 0.52 ? "runner" : "blade";
  ninjas.push({
    lane,
    z: randomRange(0.06, 0.22),
    speed: randomRange(0.17, 0.28),
    wiggle: Math.random() * Math.PI * 2,
    hop: Math.random() * Math.PI * 2,
    type,
    attackProgress: 0,
    hit: false,
  });
}

function shootArrow() {
  if (player.arrowCooldown > 0 || state.mode !== "running") return;

  const target = ninjas
    .filter((ninja) => !ninja.hit && ninja.z > 0.1 && ninja.z < 0.86)
    .sort((a, b) => b.z - a.z)[0];

  arrows.push({
    lane: player.lane,
    z: 0.95,
    targetLane: target ? target.lane : player.lane,
    drift: target ? (target.lane - player.lane) * 0.09 : 0,
    active: true,
  });

  player.arrowCooldown = 0.4;

  for (let i = 0; i < 8; i += 1) {
    particles.push({
      x: laneToX(player.lane, 0.98),
      y: zToY(0.98) - 18,
      vx: randomRange(-1.5, 1.5),
      vy: randomRange(-3.6, -1.2),
      life: randomRange(0.3, 0.55),
      color: "rgba(231, 200, 125, 0.85)",
      size: randomRange(2, 4),
    });
  }
}

function resetGame() {
  state.mode = "idle";
  state.distance = 0;
  state.kills = 0;
  state.worldSpeed = 6.5;
  state.targetSpeed = 6.5;
  state.t = 0;
  player.lane = 0;
  player.x = laneToX(0, 1);
  player.moveCooldown = 0;
  player.arrowCooldown = 0;
  player.blinkTime = 0;
  ninjas.length = 0;
  arrows.length = 0;
  particles.length = 0;

  for (let i = 0; i < 4; i += 1) makeNinja();

  distanceLabel.textContent = "0 m";
  killsLabel.textContent = "0";
  speedLabel.textContent = "0";
  endOverlay.classList.add("hidden");
}

function startGame() {
  resetGame();
  state.mode = "running";
  startOverlay.classList.add("hidden");
}

function endGame() {
  state.mode = "ended";
  player.blinkTime = 1.8;
  finalSummary.textContent = `Distance: ${Math.floor(state.distance)} m · Ninjas hit: ${state.kills} · Press R to run again.`;
  endOverlay.classList.remove("hidden");
}

function ensureNinjaDensity() {
  while (ninjas.length < 7) {
    makeNinja();
    ninjas[ninjas.length - 1].z = randomRange(-0.4, 0.1);
  }
}

function update(dt) {
  state.t += dt;

  if (state.mode === "running") {
    state.targetSpeed += (state.input.up ? 7.4 : 0) * dt;
    state.targetSpeed -= (state.input.down ? 10.5 : 0) * dt;
    state.targetSpeed = clamp(state.targetSpeed, 4.2, 16.5);
    state.worldSpeed = lerp(state.worldSpeed, state.targetSpeed, 0.09);
    state.targetSpeed = lerp(state.targetSpeed, 6.9 + Math.min(state.distance / 420, 2.8), 0.02);
    state.distance += state.worldSpeed * dt * 22;

    if (player.moveCooldown > 0) player.moveCooldown -= dt;
    player.x = lerp(player.x, laneToX(player.lane, 1), 0.18);

    if (player.arrowCooldown > 0) player.arrowCooldown -= dt;
    if (state.input.shoot) {
      shootArrow();
      state.input.shoot = false;
    }

    ensureNinjaDensity();

    for (let i = ninjas.length - 1; i >= 0; i -= 1) {
      const ninja = ninjas[i];
      ninja.z += dt * ninja.speed * (state.worldSpeed * 0.92 + (ninja.type === "runner" ? 3.5 : 2.3));
      ninja.attackProgress = clamp((ninja.z - 0.78) / 0.18, 0, 1);
      ninja.wiggle += dt * 5;
      ninja.hop += dt * 7;

      if (ninja.hit) {
        ninja.z += dt * 0.6;
      }

      if (!ninja.hit && ninja.z > 0.92 && ninja.lane === player.lane) {
        endGame();
      }

      if (ninja.z > 1.2 || ninja.hit && ninja.z > 1.05) {
        ninjas.splice(i, 1);
        continue;
      }
    }

    for (let i = arrows.length - 1; i >= 0; i -= 1) {
      const arrow = arrows[i];
      arrow.z -= dt * 1.5;
      if (Math.abs(arrow.drift) > 0.001) arrow.lane += arrow.drift * dt * 2.4;

      let hitSomething = false;
      for (const ninja of ninjas) {
        if (ninja.hit) continue;
        const laneDistance = Math.abs(ninja.lane - arrow.lane);
        const depthDistance = Math.abs(ninja.z - arrow.z);
        if (laneDistance < 0.32 && depthDistance < 0.045) {
          ninja.hit = true;
          state.kills += 1;
          state.worldSpeed = Math.min(state.worldSpeed + 0.6, 17);
          state.targetSpeed = Math.min(state.targetSpeed + 0.6, 17);
          hitSomething = true;

          for (let p = 0; p < 12; p += 1) {
            particles.push({
              x: laneToX(Math.round(ninja.lane), ninja.z),
              y: zToY(ninja.z) - 18,
              vx: randomRange(-2.4, 2.4),
              vy: randomRange(-3.2, 1.4),
              life: randomRange(0.28, 0.7),
              color: p % 2 === 0 ? "rgba(231, 200, 125, 0.9)" : "rgba(143, 212, 158, 0.85)",
              size: randomRange(2, 5),
            });
          }

          break;
        }
      }

      if (hitSomething || arrow.z < -0.05) {
        arrows.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.06;
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }

    state.cameraBob = Math.sin(state.t * state.worldSpeed * 0.45) * 4;

  }

  if (player.blinkTime > 0) player.blinkTime -= dt;

  distanceLabel.textContent = `${Math.floor(state.distance)} m`;
  killsLabel.textContent = `${state.kills}`;
  speedLabel.textContent = `${state.mode === "running" ? state.worldSpeed.toFixed(1) : 0}`;
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#234b35");
  sky.addColorStop(0.4, "#173424");
  sky.addColorStop(1, "#08110c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const moonGlow = ctx.createRadialGradient(W * 0.78, 120, 12, W * 0.78, 120, 180);
  moonGlow.addColorStop(0, "rgba(227, 238, 213, 0.9)");
  moonGlow.addColorStop(0.18, "rgba(197, 224, 197, 0.32)");
  moonGlow.addColorStop(1, "rgba(173, 204, 183, 0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(W * 0.78, 120, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(234, 245, 220, 0.9)";
  ctx.beginPath();
  ctx.arc(W * 0.78, 120, 30, 0, Math.PI * 2);
  ctx.fill();
}

function drawMist() {
  mistLayers.forEach((layer, index) => {
    layer.x += layer.speed * 0.016 * (0.3 + state.worldSpeed * 0.03);
    if (layer.x - layer.size > W + 100) layer.x = -layer.size - 100;
    ctx.fillStyle = `rgba(229, 240, 231, ${layer.alpha})`;
    ctx.beginPath();
    ctx.ellipse(layer.x, layer.y + Math.sin(state.t * 0.5 + index) * 16, layer.size, layer.size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFarForest() {
  treesFar.forEach((tree, index) => {
    const x = (tree.x + state.worldSpeed * 0.9 * index * 0.08) % (W + 160) - 80;
    const y = 250 + Math.sin(state.t * 0.8 + tree.phase) * 10;
    const height = 120 * tree.scale;
    const width = 58 * tree.scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(12, 28, 19, 0.88)";
    ctx.fillRect(-6, -height * 0.1, 12, height * 0.58);
    ctx.beginPath();
    ctx.moveTo(0, -height);
    ctx.lineTo(width, 12);
    ctx.lineTo(-width, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawTrail() {
  const path = ctx.createLinearGradient(0, trail.topY, 0, trail.bottomY);
  path.addColorStop(0, "#5a4f3c");
  path.addColorStop(0.35, "#6e624b");
  path.addColorStop(1, "#3f3427");
  ctx.fillStyle = path;

  ctx.beginPath();
  ctx.moveTo(CX - trail.topWidth / 2, trail.topY);
  ctx.lineTo(CX + trail.topWidth / 2, trail.topY);
  ctx.lineTo(CX + trail.bottomWidth / 2, trail.bottomY);
  ctx.lineTo(CX - trail.bottomWidth / 2, trail.bottomY);
  ctx.closePath();
  ctx.fill();

  const edge = ctx.createLinearGradient(0, trail.topY, 0, trail.bottomY);
  edge.addColorStop(0, "rgba(212, 194, 145, 0.28)");
  edge.addColorStop(1, "rgba(51, 34, 17, 0.45)");
  ctx.strokeStyle = edge;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.strokeStyle = "rgba(230, 219, 179, 0.22)";
  ctx.setLineDash([12, 14]);
  ctx.lineWidth = 2;
  for (let lane = -1; lane <= 1; lane += 1) {
    const laneXTop = CX + lane * trail.topWidth * 0.16;
    const laneXBottom = CX + lane * trail.bottomWidth * 0.16;
    ctx.beginPath();
    ctx.moveTo(laneXTop, trail.topY);
    ctx.lineTo(laneXBottom, trail.bottomY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawNearForest() {
  treesNear.forEach((tree, index) => {
    const pathEdge = trail.bottomWidth / 2 + 60;
    const x = CX + tree.side * (pathEdge + 70 + index * 18);
    const sway = Math.sin(state.t * 0.65 + tree.sway) * 9;
    const y = H - 100;
    const scale = tree.scale;
    ctx.save();
    ctx.translate(x + sway, y);
    ctx.fillStyle = "rgba(26, 39, 24, 0.96)";
    ctx.fillRect(-10 * scale, -110 * scale, 20 * scale, 125 * scale);
    ctx.beginPath();
    ctx.moveTo(0, -220 * scale);
    ctx.lineTo(120 * scale, -40 * scale);
    ctx.lineTo(-120 * scale, -40 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawGrassOverlay() {
  const gradient = ctx.createLinearGradient(0, H * 0.55, 0, H);
  gradient.addColorStop(0, "rgba(30, 58, 38, 0)");
  gradient.addColorStop(1, "rgba(7, 17, 10, 0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  for (let i = 0; i < 160; i += 1) {
    const x = (i * 21 + state.t * state.worldSpeed * 38) % (W + 40) - 20;
    const h = 10 + (i % 5) * 5;
    const y = H - (i % 4) * 6;
    ctx.strokeStyle = i % 3 === 0 ? "rgba(129, 181, 132, 0.35)" : "rgba(88, 132, 94, 0.24)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 2) ? -3 : 3), y - h);
    ctx.stroke();
  }
}

function drawRobin(x, y, scale) {
  const blink = Math.sin(state.t * 18) > 0.2 && player.blinkTime > 0;
  ctx.save();
  ctx.translate(x, y + state.cameraBob);
  ctx.scale(scale, scale);

  if (!blink) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 44, 42, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#5f3c24";
  ctx.fillRect(-8, 4, 16, 42);
  ctx.fillRect(-22, 44, 10, 38);
  ctx.fillRect(12, 44, 10, 38);

  ctx.fillStyle = "#2e6b3c";
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.lineTo(26, -8);
  ctx.lineTo(-18, -8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#3b8b52";
  ctx.fillRect(-26, -8, 52, 64);

  ctx.fillStyle = "#2e6b3c";
  ctx.fillRect(-34, 0, 10, 42);
  ctx.fillRect(24, 0, 10, 42);

  ctx.fillStyle = "#c89b6b";
  ctx.beginPath();
  ctx.arc(0, -22, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5b2b19";
  ctx.beginPath();
  ctx.moveTo(-19, -28);
  ctx.quadraticCurveTo(0, -58, 21, -26);
  ctx.lineTo(18, -14);
  ctx.lineTo(-18, -14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#7c522d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-28, 8, 24, -1.2, 1.2);
  ctx.stroke();

  ctx.strokeStyle = "#d7b368";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-30, 8);
  ctx.stroke();

  ctx.fillStyle = "#e8f0e5";
  ctx.beginPath();
  ctx.arc(0, -22, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawNinja(ninja) {
  const y = zToY(ninja.z);
  const x = laneToX(ninja.lane, ninja.z) + Math.sin(ninja.wiggle) * 8 * (1 - ninja.z);
  const scale = zScale(ninja.z);
  const attackLean = ninja.attackProgress * 24;
  const hitRotate = ninja.hit ? Math.sin(state.t * 30) * 0.25 : 0;

  ctx.save();
  ctx.translate(x, y - Math.sin(ninja.hop) * 7 * (1 - ninja.z));
  ctx.scale(scale, scale);
  ctx.rotate(hitRotate);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 42, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ninja.type === "elite" ? "#1e2038" : ninja.type === "runner" ? "#14151f" : "#0c1015";
  ctx.fillRect(-20, -8, 40, 58);
  ctx.fillRect(-25, 6, 8, 34);
  ctx.fillRect(17, 6, 8, 34);
  ctx.fillRect(-16, 48, 10, 28);
  ctx.fillRect(6, 48, 10, 28);

  ctx.fillStyle = "#e6ebef";
  ctx.beginPath();
  ctx.arc(0, -24, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#090a0f";
  ctx.beginPath();
  ctx.moveTo(-20, -28);
  ctx.quadraticCurveTo(0, -54, 20, -28);
  ctx.lineTo(20, -4);
  ctx.lineTo(-20, -4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#bf3648";
  ctx.fillRect(-12, -20, 24, 5);

  ctx.strokeStyle = "#d8dce0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 12);
  ctx.lineTo(40 + attackLean, -4);
  ctx.stroke();

  ctx.restore();
}

function drawArrow(arrow) {
  const y = zToY(arrow.z);
  const x = laneToX(Math.round(arrow.lane), arrow.z);
  const scale = lerp(0.5, 1.02, arrow.z);
  ctx.save();
  ctx.translate(x, y - 16);
  ctx.scale(scale, scale);
  ctx.rotate(-1.15 + Math.sin(state.t * 15 + arrow.z * 10) * 0.03);
  ctx.strokeStyle = "#f1d58b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  ctx.fillStyle = "#f1d58b";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(11, -5);
  ctx.lineTo(11, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHudOnCanvas() {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(34, 34, 290, 78);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(34, 34, 290, 78);
  ctx.fillStyle = "rgba(239,246,239,0.72)";
  ctx.font = "600 18px Inter";
  ctx.fillText("Forest threat level", 56, 64);
  ctx.fillStyle = "#e7c87d";
  ctx.font = "700 30px Cinzel";
  const label = state.mode === "idle" ? "Ready" : state.mode === "ended" ? "Defeat" : `${Math.ceil(state.worldSpeed * 7)}%`;
  ctx.fillText(label, 56, 99);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawMist();
  drawFarForest();
  drawTrail();

  const entities = [
    ...ninjas.map((ninja) => ({ type: "ninja", z: ninja.z, ref: ninja })),
    ...arrows.map((arrow) => ({ type: "arrow", z: arrow.z, ref: arrow })),
    { type: "player", z: 1, ref: player },
  ].sort((a, b) => a.z - b.z);

  for (const entity of entities) {
    if (entity.type === "ninja") drawNinja(entity.ref);
    else if (entity.type === "arrow") drawArrow(entity.ref);
    else drawRobin(player.x, player.y, 1);
  }

  drawNearForest();
  drawGrassOverlay();
  drawParticles();
  drawHudOnCanvas();
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.033);
  previous = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function shiftLane(direction) {
  if (state.mode !== "running") return;
  if (player.moveCooldown > 0) return;
  player.lane = clamp(player.lane + direction, -1, 1);
  player.moveCooldown = 0.14;
}

function setAction(action, active) {
  if (action === "up") state.input.up = active;
  if (action === "down") state.input.down = active;
  if (action === "shoot") state.input.shoot = active;

  if (active && action === "left") shiftLane(-1);
  if (active && action === "right") shiftLane(1);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowUp" || event.code === "KeyW") setAction("up", true);
  if (event.code === "ArrowDown" || event.code === "KeyS") setAction("down", true);
  if (event.code === "ArrowLeft" || event.code === "KeyA") setAction("left", true);
  if (event.code === "ArrowRight" || event.code === "KeyD") setAction("right", true);
  if (event.code === "Space") {
    event.preventDefault();
    state.input.shoot = true;
  }

  if (event.code === "KeyR" && state.mode === "ended") {
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowUp" || event.code === "KeyW") setAction("up", false);
  if (event.code === "ArrowDown" || event.code === "KeyS") setAction("down", false);
  if (event.code === "ArrowLeft" || event.code === "KeyA") setAction("left", false);
  if (event.code === "ArrowRight" || event.code === "KeyD") setAction("right", false);
  if (event.code === "Space") state.input.shoot = false;
});

mobileControls.forEach((button) => {
  const action = button.dataset.action;
  ["pointerdown", "touchstart"].forEach((evt) => {
    button.addEventListener(evt, (event) => {
      event.preventDefault();
      if (action === "shoot") {
        state.input.shoot = true;
      } else {
        setAction(action, true);
      }
    }, { passive: false });
  });

  ["pointerup", "pointerleave", "touchend", "touchcancel"].forEach((evt) => {
    button.addEventListener(evt, (event) => {
      event.preventDefault();
      if (action === "shoot") state.input.shoot = false;
      else setAction(action, false);
    }, { passive: false });
  });
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

resetGame();
render();
requestAnimationFrame(frame);
