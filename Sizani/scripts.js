const PROFILE_API_URL = "https://jogging-garlic-mulled.ngrok-free.dev/api/trader/trader-27677210478/profile";
const STOREFRONT_API_URL = "https://jogging-garlic-mulled.ngrok-free.dev/api/trader/trader-27677210478/storefront";

let salesTimeChartInstance = null;
let salesItemChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    loadStorefront();
    loadDashboardData();
});

async function loadStorefront() {
    try {
        const res = await fetch(STOREFRONT_API_URL, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        
        document.getElementById("headerBusinessName").textContent = data.business_name || "Business Name";
        document.getElementById("headerBusinessCategory").textContent = data.business_category || "";
    } catch (err) {
        document.getElementById("headerBusinessName").textContent = "Business Name";
    }
}

async function loadDashboardData() {
    try {
        const res = await fetch(PROFILE_API_URL, {
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const entries = data.recent_entries || [];

        renderCharts(entries);
    } catch (err) {
        console.error("Failed to load chart data:", err);
    }
}

function renderCharts(entries) {
    // --- 1. Aggregating Data for Line Graph (Sales Over Time) ---
    const salesByDate = {};
    entries.forEach(entry => {
        const dateStr = formatDate(entry.entry_date);
        const amount = parseFloat(entry.amount) || 0;
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + amount;
    });

    // Sort dates chronologically
    const sortedDates = Object.keys(salesByDate).sort((a, b) => new Date(a) - new Date(b));
    const salesTimeData = sortedDates.map(date => salesByDate[date]);

    // --- 2. Aggregating Data for Bar Graph (Sales by Item) ---
    const salesByItem = {};
    entries.forEach(entry => {
        // Strip out debug markers like "(STUB DATA)" for cleaner display
        const desc = entry.item_description.replace(/\(STUB DATA\)/g, "").trim();
        const amount = parseFloat(entry.amount) || 0;
        salesByItem[desc] = (salesByItem[desc] || 0) + amount;
    });

    const itemLabels = Object.keys(salesByItem);
    const itemData = Object.values(salesByItem);

    // --- 3. Render Line Chart (Sales over Time) ---
    const ctxTime = document.getElementById("salesOverTimeChart").getContext("2d");
    if (salesTimeChartInstance) salesTimeChartInstance.destroy();
    
    salesTimeChartInstance = new Chart(ctxTime, {
        type: "line",
        data: {
            labels: sortedDates,
            datasets: [{
                label: "Total Sales (R)",
                data: salesTimeData,
                borderColor: "#1E90FF",
                backgroundColor: "rgba(30, 144, 255, 0.2)",
                fill: true,
                tension: 0.3,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            },
            scales: {
                x: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255, 255, 255, 0.1)" } },
                y: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255, 255, 255, 0.1)" } }
            }
        }
    });

    // --- 4. Render Bar Chart (Sales by Item) ---
    const ctxItem = document.getElementById("salesByItemChart").getContext("2d");
    if (salesItemChartInstance) salesItemChartInstance.destroy();

    salesItemChartInstance = new Chart(ctxItem, {
        type: "bar",
        data: {
            labels: itemLabels,
            datasets: [{
                label: "Sales Value (R)",
                data: itemData,
                backgroundColor: "#8A2BE2",
                borderColor: "#9932CC",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            },
            scales: {
                x: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255, 255, 255, 0.1)" } },
                y: { ticks: { color: "#ffffff" }, grid: { color: "rgba(255, 255, 255, 0.1)" } }
            }
        }
    });
}

function profile() {
    openProfile();
    loadProfile();
}

function openProfile() {
    document.getElementById("profileOverlay").classList.remove("hidden");
}

function closeProfile() {
    document.getElementById("profileOverlay").classList.add("hidden");
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(amount) {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return "R" + num.toFixed(2);
}

function renderProfile(data) {
    const trader = data.trader || {};
    const creditScore = data.credit_score || {};
    const breakdown = creditScore.score_breakdown || {};
    const ledger = data.ledger_summary || {};
    const entries = data.recent_entries || [];

    const computedDate = creditScore.computed_at ? formatDate(creditScore.computed_at) : "-";
    const dateRange = ledger.date_range || {};
    const fromDate = dateRange.from ? formatDate(dateRange.from) : "-";
    const toDate = dateRange.to ? formatDate(dateRange.to) : "-";

    const entriesHtml = entries.map(e => `
        <li class="entry-row">
            <div class="entry-desc">${e.item_description}</div>
            <div class="entry-meta">
                <span class="entry-amount">${formatCurrency(e.amount)}</span>
                <span class="entry-date">${formatDate(e.entry_date)}</span>
            </div>
        </li>
    `).join("");

    const html = `
        <header class="profile-header">
            <h2>${trader.business_name || "Unknown Trader"}</h2>
            <p class="profile-category">${trader.business_category || ""}</p>
        </header>

        <section class="profile-section score-section">
            <div class="score-circle">
                <span class="score-value">${creditScore.score ?? "-"}</span>
                <span class="score-label">Score</span>
            </div>
            <div class="score-breakdown">
                <p style="font-size: 11px; margin: 0 0 6px 0; color: #ccc;">Computed: ${computedDate}</p>
                <div class="breakdown-row">
                    <span class="breakdown-label">Consistency</span>
                    <div class="breakdown-bar"><div class="breakdown-fill" style="width:${(breakdown.consistency || 0) * 100}%"></div></div>
                    <span class="breakdown-pct">${Math.round((breakdown.consistency || 0) * 100)}%</span>
                </div>
                <div class="breakdown-row">
                    <span class="breakdown-label">Frequency</span>
                    <div class="breakdown-bar"><div class="breakdown-fill" style="width:${(breakdown.frequency || 0) * 100}%"></div></div>
                    <span class="breakdown-pct">${Math.round((breakdown.frequency || 0) * 100)}%</span>
                </div>
                <div class="breakdown-row">
                    <span class="breakdown-label">Volume trend</span>
                    <div class="breakdown-bar"><div class="breakdown-fill" style="width:${(breakdown.volume_trend || 0) * 100}%"></div></div>
                    <span class="breakdown-pct">${Math.round((breakdown.volume_trend || 0) * 100)}%</span>
                </div>
            </div>
        </section>

        <section class="profile-section summary-section">
            <div class="summary-item">
                <span class="summary-value">${ledger.total_entries ?? "-"}</span>
                <span class="summary-label">Entries</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${ledger.total_value != null ? formatCurrency(ledger.total_value) : "-"}</span>
                <span class="summary-label">Total value</span>
            </div>
            <div class="summary-item">
                <span class="summary-value small">${fromDate} &rarr; ${toDate}</span>
                <span class="summary-label">Date range</span>
            </div>
        </section>

        <section class="profile-section entries-section">
            <h3>Recent sales</h3>
            <ul class="entries-list">
                ${entriesHtml || "<li class='entry-row'>No entries yet.</li>"}
            </ul>
        </section>
    `;

    document.getElementById("profileContent").innerHTML = html;
}

function renderError(message) {
    document.getElementById("profileContent").innerHTML = `
        <p class="profile-status error">Could not load profile: ${message}</p>
    `;
}

async function loadProfile() {
    document.getElementById("profileContent").innerHTML = `<p class="profile-status">Loading profile...</p>`;
    try {
        const res = await fetch(PROFILE_API_URL, {
            method: "GET",
            headers: {
                "ngrok-skip-browser-warning": "true"
            }
        });
        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Server did not return JSON (got " + (contentType || "unknown content-type") + "). The ngrok tunnel or server may be down.");
        }
        const data = await res.json();
        renderProfile(data);
    } catch (err) {
        const hint = err.message === "Failed to fetch"
            ? "Failed to fetch (check that the ngrok tunnel and server are running, and that CORS is enabled on the server)"
            : err.message;
        renderError(hint);
    }
}