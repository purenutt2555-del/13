
const CRITERIA = [
  ["discipline", "วินัยและความรับผิดชอบ", "ตรงต่อเวลาและปฏิบัติตามระเบียบ"],
  ["law", "ความรู้ทางกฎหมาย", "เข้าใจหลักกฎหมายและอธิบายได้"],
  ["documents", "การจัดทำเอกสารและรายงาน", "ความถูกต้องและครบถ้วน"],
  ["teamwork", "การสื่อสารและทำงานเป็นทีม", "ประสานงานและร่วมมือกับผู้อื่น"],
  ["ethics", "ความประพฤติและจริยธรรม", "ซื่อสัตย์ สุภาพ และเป็นกลาง"]
];

const STORAGE_KEY = "dla-training-evaluations-v1";
let ratings = Object.fromEntries(CRITERIA.map(c => [c[0], 0]));
let records = [];
let db = null;

const $ = selector => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function totalScore(record) {
  return CRITERIA.reduce(
    (sum, item) => sum + Number(record.scores?.[item[0]] || 0), 0
  );
}

function averageScore(record) {
  return totalScore(record) / CRITERIA.length;
}

function scoreLevel(score) {
  if (score >= 22) return "ดีเยี่ยม";
  if (score >= 18) return "ดีมาก";
  if (score >= 14) return "ผ่าน";
  if (score >= 10) return "ควรพัฒนา";
  return "ต้องปรับปรุง";
}

function formatDate(date) {
  if (!date) return "—";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function notify(message) {
  const toast = $("#toast");
  if (!toast) {
    alert(message);
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function setupCriteria() {
  const container = $("#criteriaList");
  if (!container) return;

  container.innerHTML = CRITERIA.map(c => `
    <div class="criterion">
      <div>
        <b>${escapeHTML(c[1])}</b>
        <small>${escapeHTML(c[2])}</small>
      </div>
      <div class="rating">
        ${[1, 2, 3, 4, 5].map(n => `
          <button type="button" data-key="${c[0]}" data-value="${n}"
            aria-label="${escapeHTML(c[1])} ${n} คะแนน">${n}</button>
        `).join("")}
      </div>
    </div>
  `).join("");

  container.addEventListener("click", event => {
    const button = event.target.closest("[data-key]");
    if (!button) return;

    ratings[button.dataset.key] = Number(button.dataset.value);

    container.querySelectorAll(
      `[data-key="${button.dataset.key}"]`
    ).forEach(item => {
      item.classList.toggle(
        "selected",
        Number(item.dataset.value) === ratings[button.dataset.key]
      );
    });

    updateScorePreview();
  });
}

function updateScorePreview() {
  const total = Object.values(ratings).reduce((sum, value) => sum + value, 0);
  if ($("#scoreTotal")) $("#scoreTotal").textContent = `${total} / 25`;
  if ($("#scoreLevel")) {
    $("#scoreLevel").textContent = total ? scoreLevel(total) : "ยังไม่ได้ให้คะแนน";
  }
}

function normalizeRemote(row) {
  return {
    id: row.id,
    name: row.trainee_name,
    code: row.trainee_code || "",
    unit: row.unit_name || "",
    evaluator: row.evaluator_name,
    date: row.evaluation_date,
    course: row.course,
    scores: row.scores || {},
    notes: row.notes || "",
    created: row.created_at
  };
}

function toRemote(record) {
  return {
    trainee_name: record.name,
    trainee_code: record.code || null,
    unit_name: record.unit || null,
    evaluator_name: record.evaluator,
    evaluation_date: record.date,
    course: record.course,
    scores: record.scores,
    notes: record.notes || null
  };
}

function loadLocalRecords() {
  try {
    records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    records = [];
  }
}

function saveLocalRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

async function loadRecords() {
  if (db) {
    const { data, error } = await db
      .from("evaluations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    records = (data || []).map(normalizeRemote);
  } else {
    loadLocalRecords();
  }
  renderAll();
}

function recordsTable(list) {
  if (!list.length) return '<div class="empty">ยังไม่มีข้อมูล</div>';

  return `
    <table>
      <thead>
        <tr>
          <th>ผู้เข้ารับการฝึก</th><th>หน่วย</th><th>ผู้ประเมิน</th>
          <th>วันที่</th><th>คะแนน</th><th>ระดับ</th><th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(r => {
          const score = totalScore(r);
          return `
            <tr>
              <td><b>${escapeHTML(r.name)}</b><br>${escapeHTML(r.code || "")}</td>
              <td>${escapeHTML(r.unit || "—")}</td>
              <td>${escapeHTML(r.evaluator)}</td>
              <td>${formatDate(r.date)}</td>
              <td>${score}/25</td>
              <td><span class="pill ${score < 14 ? "low" : ""}">${scoreLevel(score)}</span></td>
              <td><button type="button" class="delete" data-delete="${escapeHTML(r.id)}">ลบ</button></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderAll() {
  const count = records.length;
  const mean = count
    ? records.reduce((sum, r) => sum + averageScore(r), 0) / count
    : 0;

  if ($("#totalCount")) {
    $("#totalCount").textContent =
      new Set(records.map(r => (r.name || "").trim().toLowerCase())).size;
  }
  if ($("#evalCount")) $("#evalCount").textContent = count;
  if ($("#averageScore")) {
    $("#averageScore").textContent = count ? `${mean.toFixed(2)} / 5` : "—";
  }
  if ($("#recentTable")) {
    $("#recentTable").innerHTML = recordsTable(records.slice(0, 5));
  }

  const query = ($("#searchInput")?.value || "").toLowerCase().trim();
  const filtered = records.filter(r =>
    [r.name, r.code, r.unit, r.evaluator, r.course]
      .join(" ").toLowerCase().includes(query)
  );

  if ($("#recordsTable")) $("#recordsTable").innerHTML = recordsTable(filtered);
  if ($("#reportCount")) $("#reportCount").textContent = count;
  if ($("#reportAverage")) {
    $("#reportAverage").textContent = count ? `${mean.toFixed(2)} / 5` : "—";
  }
  if ($("#highCount")) {
    $("#highCount").textContent = records.filter(r => averageScore(r) >= 4).length;
  }

  const courses = [...new Set(records.map(r => r.course))];
  if ($("#courseSummary")) {
    $("#courseSummary").innerHTML = courses.length
      ? courses.map(course => {
          const group = records.filter(r => r.course === course);
          const avg = group.reduce((sum, r) => sum + averageScore(r), 0) / group.length;
          return `
            <div class="summaryrow">
              <span>${escapeHTML(course)}</span>
              <div class="bar"><span style="width:${avg / 5 * 100}%"></span></div>
              <b>${avg.toFixed(2)} / 5</b>
            </div>
          `;
        }).join("")
      : '<div class="empty">ยังไม่มีข้อมูลสำหรับรายงาน</div>';
  }
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll("[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  const titles = {
    dashboard: "ภาพรวมระบบ",
    evaluate: "ประเมินผู้เข้ารับการฝึก",
    records: "ทะเบียนผลประเมิน",
    reports: "รายงานผล"
  };

  if ($("#pageTitle")) $("#pageTitle").textContent = titles[pageId] || "ระบบประเมินผล";
  history.replaceState(null, "", "#" + pageId);
  renderAll();
}

function resetRatings() {
  ratings = Object.fromEntries(CRITERIA.map(c => [c[0], 0]));
  document.querySelectorAll("#criteriaList .rating button").forEach(button => {
    button.classList.remove("selected");
  });
  updateScorePreview();
}

async function saveEvaluation(event) {
  event.preventDefault();

  if (Object.values(ratings).some(value => value < 1 || value > 5)) {
    notify("กรุณาให้คะแนนครบทั้ง 5 ด้าน");
    return;
  }

  const form = event.currentTarget;
  const data = new FormData(form);

  const record = {
    id: String(Date.now()),
    name: String(data.get("name") || "").trim(),
    code: String(data.get("code") || "").trim(),
    unit: String(data.get("unit") || "").trim(),
    evaluator: String(data.get("evaluator") || "").trim(),
    date: String(data.get("date") || ""),
    course: String(data.get("course") || ""),
    notes: String(data.get("notes") || "").trim(),
    scores: { ...ratings },
    created: new Date().toISOString()
  };

  try {
    if (db) {
      const { error } = await db.from("evaluations").insert(toRemote(record));
      if (error) throw error;
      await loadRecords();
    } else {
      records.unshift(record);
      saveLocalRecords();
      renderAll();
    }

    form.reset();
    $("#evaluationForm").querySelector('[name="date"]').value =
      new Date().toISOString().slice(0, 10);
    resetRatings();
    showPage("records");
    notify(db
      ? "บันทึกข้อมูลออนไลน์แล้ว"
      : "บันทึกในอุปกรณ์นี้แล้ว ข้อมูลยังไม่แชร์กับเครื่องอื่น");
  } catch (error) {
    console.error(error);
    notify("บันทึกไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าฐานข้อมูล");
  }
}

async function deleteRecord(id) {
  if (!confirm("ยืนยันว่าต้องการลบรายการนี้หรือไม่?")) return;

  try {
    if (db) {
      const { error } = await db.from("evaluations").delete().eq("id", id);
      if (error) throw error;
      await loadRecords();
    } else {
      records = records.filter(record => String(record.id) !== String(id));
      saveLocalRecords();
      renderAll();
    }
    notify("ลบรายการแล้ว");
  } catch (error) {
    console.error(error);
    notify("ลบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูล");
  }
}

function exportCSV() {
  if (!records.length) {
    notify("ยังไม่มีข้อมูลสำหรับส่งออก");
    return;
  }

  const headers = [
    "ชื่อผู้ฝึก", "รหัส", "หน่วย", "ผู้ประเมิน", "วันที่", "หัวข้อ",
    ...CRITERIA.map(c => c[1]), "คะแนนรวม", "ระดับ", "ข้อเสนอแนะ"
  ];

  const lines = records.map(r => [
    r.name, r.code, r.unit, r.evaluator, r.date, r.course,
    ...CRITERIA.map(c => r.scores[c[0]] || 0),
    totalScore(r), scoreLevel(totalScore(r)), r.notes
  ]);

  const csv = "\uFEFF" + [headers, ...lines].map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "training-evaluation.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function initializeDatabase() {
  const config = window.APP_CONFIG;
  if (!config || !window.supabase) return;

  const url = config.SUPABASE_URL || "";
  const key = config.SUPABASE_ANON_KEY || "";

  if (url.startsWith("https://") && key.length > 20 &&
      !url.includes("ที่นี่") && !key.includes("ที่นี่")) {
    db = window.supabase.createClient(url, key);
  }
}

function startApp() {
  initializeDatabase();
  setupCriteria();

  const dateInput = $('#evaluationForm [name="date"]');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  $("#evaluationForm")?.addEventListener("submit", saveEvaluation);
  $("#searchInput")?.addEventListener("input", renderAll);
  $("#exportCsv")?.addEventListener("click", exportCSV);
  $("#printReport")?.addEventListener("click", () => window.print());
  $("#menuButton")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));

  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-page]");
    if (nav) {
      event.preventDefault();
      showPage(nav.dataset.page);
      $("#sidebar")?.classList.remove("open");
    }

    const shortcut = event.target.closest("[data-go]");
    if (shortcut) showPage(shortcut.dataset.go);

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) deleteRecord(deleteButton.dataset.delete);
  });

  loadRecords()
    .then(() => {
      const page = location.hash.slice(1);
      showPage(["dashboard", "evaluate", "records", "reports"].includes(page)
        ? page : "dashboard");
    })
    .catch(error => {
      console.error(error);
      notify("โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบ Supabase");
    });
}

document.addEventListener("DOMContentLoaded", startApp);
    
