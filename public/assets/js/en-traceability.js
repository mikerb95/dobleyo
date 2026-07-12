/** EN traceability lookup + QR scanner. Externalized for the strict CSP (no 'unsafe-inline'). */
function initEnTraceability() {
  const rootEl = document.getElementById("lookupBtn") || document.getElementById("qrVideo");
  if (!rootEl || rootEl.dataset.jsInit) return;
  rootEl.dataset.jsInit = "1";

const FIELD_LABELS = {
  farm: "Farm",
  producer: "Producer",
  altitude: "Altitude",
  process: "Process",
  variety: "Variety",
  region: "Region",
  harvest_date: "Harvest date",
  roast_date: "Roast date",
  roast_profile: "Roast profile",
  cupping_score: "Cupping score (SCA)",
  notes: "Notes",
  lot_code: "Lot code",
};

async function lookupLot(code) {
  const errorEl = document.getElementById("lotError");
  const emptyEl = document.getElementById("resultEmpty");
  const resultEl = document.getElementById("result");
  errorEl.style.display = "none";
  resultEl.style.display = "none";
  emptyEl.style.display = "block";

  if (!code.trim()) return;

  try {
    const res = await fetch(`/api/labels/lookup/${encodeURIComponent(code.trim())}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "Not found");

    const data = json.data;
    document.getElementById("resName").textContent =
      data.product_name || data.lot_code || code;
    document.getElementById("resLot").textContent = data.lot_code ?? "";

    const chips = document.getElementById("resChips");
    chips.innerHTML = [data.process, data.variety, data.region]
      .filter(Boolean)
      .map((v) => `<span class="trace-chip">${v}</span>`)
      .join("");

    const dl = document.getElementById("resDetails");
    const fields = [
      "farm",
      "producer",
      "altitude",
      "harvest_date",
      "roast_date",
      "roast_profile",
      "cupping_score",
      "notes",
    ];
    dl.innerHTML = fields
      .filter((k) => data[k])
      .map(
        (k) => `
        <dt>${FIELD_LABELS[k] ?? k}</dt>
        <dd>${k === "altitude" ? data[k] + " masl" : data[k]}</dd>`
      )
      .join("");

    emptyEl.style.display = "none";
    resultEl.style.display = "block";
  } catch (err) {
    errorEl.textContent = `Lot not found: ${code}. Check the code and try again.`;
    errorEl.style.display = "block";
  }
}

document.getElementById("lookupBtn")?.addEventListener("click", () => {
  const val = document.getElementById("lotInput")?.value;
  lookupLot(val || "");
});

document.getElementById("lotInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = e.target.value;
    lookupLot(val);
  }
});

// QR Scanner
let stream = null;
const video = document.getElementById("qrVideo");
const canvas = document.getElementById("qrOverlay");
const status = document.getElementById("scanStatus");

async function startScan() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    video.srcObject = stream;
    status.textContent = "Scanning… point camera at QR code.";
    requestAnimationFrame(scanFrame);
  } catch {
    status.textContent = "Camera access denied. Enter code manually.";
  }
}

function stopScan() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  status.textContent = "Scanner stopped.";
}

function scanFrame() {
  if (!stream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
  }
  requestAnimationFrame(scanFrame);
}

document.getElementById("startScan")?.addEventListener("click", startScan);
document.getElementById("stopScan")?.addEventListener("click", stopScan);
document.getElementById("restartScan")?.addEventListener("click", startScan);
