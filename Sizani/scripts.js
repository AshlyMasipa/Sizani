const PROFILE_API_URL = "https://jogging-garlic-mulled.ngrok-free.dev/api/trader/trader-27677210478/profile";
const STOREFRONT_API_URL = "https://jogging-garlic-mulled.ngrok-free.dev/api/trader/trader-27677210478/storefront";

let cachedStorefrontData = null;
let salesTimeChartInstance = null;
let salesItemChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    loadStorefrontPageData();
});

async function loadStorefrontPageData() {
    try {
        const [storefrontRes, profileRes] = await Promise.all([
            fetch(STOREFRONT_API_URL, { headers: { "ngrok-skip-browser-warning": "true" } }),
            fetch(PROFILE_API_URL, { headers: { "ngrok-skip-browser-warning": "true" } })
        ]);

        if (storefrontRes.ok) {
            cachedStorefrontData = await storefrontRes.json();
            document.getElementById("headerBusinessName").textContent = cachedStorefrontData.business_name || "Business Name";
            document.getElementById("headerBusinessCategory").textContent = cachedStorefrontData.business_category || "";
        }

        if (profileRes.ok) {
            const profileData = await profileRes.json();
            renderProfileDataOnStorefront(profileData);
            renderCharts(profileData.recent_entries || []);
        }
    } catch (err) {
        console.error("Error loading storefront data:", err);
    }
}

function renderProfileDataOnStorefront(data) {
    const score = data.credit_score || {};
    const breakdown = score.score_breakdown || {};
    const ledger = data.ledger_summary || {};
    const entries = data.recent_entries || [];

    // 1. Credit Score Section
    document.getElementById("scoreValue").textContent = score.score ?? "-";
    document.getElementById("scoreComputedAt").textContent = score.computed_at ? "Computed: " + formatDate(score.computed_at) : "Computed: -";

    const consistencyPct = Math.round((breakdown.consistency || 0) * 100);
    const frequencyPct = Math.round((breakdown.frequency || 0) * 100);
    const volumePct = Math.round((breakdown.volume_trend || 0) * 100);

    document.getElementById("barConsistency").style.width = consistencyPct + "%";
    document.getElementById("pctConsistency").textContent = consistencyPct + "%";

    document.getElementById("barFrequency").style.width = frequencyPct + "%";
    document.getElementById("pctFrequency").textContent = frequencyPct + "%";

    document.getElementById("barVolume").style.width = volumePct + "%";
    document.getElementById("pctVolume").textContent = volumePct + "%";

    // 2. Ledger Summary Stats
    document.getElementById("totalEntries").textContent = ledger.total_entries ?? "-";
    document.getElementById("totalValue").textContent = ledger.total_value != null ? formatCurrency(ledger.total_value) : "-";

    const dateRange = ledger.date_range || {};
    const fromDate = dateRange.from ? formatDate(dateRange.from) : "-";
    const toDate = dateRange.to ? formatDate(dateRange.to) : "-";
    document.getElementById("dateRange").innerHTML = `${fromDate} &rarr; ${toDate}`;

    // 3. Recent Entries List
    const entriesList = document.getElementById("entriesList");
    if (entries.length === 0) {
        entriesList.innerHTML = `<li class="entry-row">No ledger entries found.</li>`;
    } else {
        entriesList.innerHTML = entries.map(e => `
            <li class="entry-row">
                <div class="entry-desc">${e.item_description}</div>
                <div class="entry-meta">
                    <span class="entry-amount">${formatCurrency(e.amount)}</span>
                    <span class="entry-date">${formatDate(e.entry_date)}</span>
                </div>
            </li>
        `).join("");
    }
}

function renderCharts(entries) {
    // --- 1. Aggregating Sales Over Time ---
    const salesByDate = {};
    entries.forEach(entry => {
        const dateStr = formatDate(entry.entry_date);
        const amount = parseFloat(entry.amount) || 0;
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + amount;
    });

    const sortedDates = Object.keys(salesByDate).sort((a, b) => new Date(a) - new Date(b));
    const salesTimeData = sortedDates.map(date => salesByDate[date]);

    // --- 2. Extracting & Normalizing Individual Items & Quantities ---
    const itemQuantities = {};

    entries.forEach(entry => {
        // Remove stub notes and split combo strings like "2x White Bread, 1x Milk 2L"
        const cleanDesc = entry.item_description.replace(/\(STUB DATA\)/gi, "").trim();
        const parts = cleanDesc.split(",");

        parts.forEach(part => {
            const itemString = part.trim();
            if (!itemString) return;

            // Match patterns like "2x White Bread", "1x Milk", or fallback to implicit quantity "1"
            const match = itemString.match(/^(?:(\d+)\s*x\s*)?(.*)$/i);
            
            let qty = 1;
            let itemName = itemString;

            if (match) {
                if (match[1]) qty = parseInt(match[1], 10);
                if (match[2]) itemName = match[2].trim();
            }

            // Normalize item names (e.g., lowercase / capitalize standard names, consolidate variations)
            itemName = normalizeItemName(itemName);

            if (itemName) {
                itemQuantities[itemName] = (itemQuantities[itemName] || 0) + qty;
            }
        });
    });

    // Sort items by highest quantity sold
    const sortedItemKeys = Object.keys(itemQuantities).sort((a, b) => itemQuantities[b] - itemQuantities[a]);
    const itemQuantityData = sortedItemKeys.map(key => itemQuantities[key]);

    // --- 3. Line Chart (Sales Over Time) ---
    const ctxTime = document.getElementById("salesOverTimeChart").getContext("2d");
    if (salesTimeChartInstance) salesTimeChartInstance.destroy();

    const gradientBlue = ctxTime.createLinearGradient(0, 0, 0, 250);
    gradientBlue.addColorStop(0, "rgba(56, 189, 248, 0.4)");
    gradientBlue.addColorStop(1, "rgba(56, 189, 248, 0.0)");

    salesTimeChartInstance = new Chart(ctxTime, {
        type: "line",
        data: {
            labels: sortedDates,
            datasets: [{
                label: "Total Sales (R)",
                data: salesTimeData,
                borderColor: "#38bdf8",
                borderWidth: 3,
                backgroundColor: gradientBlue,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#38bdf8",
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
                y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }
            }
        }
    });

    // --- 4. Bar Chart (Quantity Sold by Individual Item) ---
    const ctxItem = document.getElementById("salesByItemChart").getContext("2d");
    if (salesItemChartInstance) salesItemChartInstance.destroy();

    salesItemChartInstance = new Chart(ctxItem, {
        type: "bar",
        data: {
            labels: sortedItemKeys,
            datasets: [{
                label: "Units Sold",
                data: itemQuantityData,
                backgroundColor: "#c084fc",
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` Quantity: ${context.raw} units`
                    }
                }
            },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                y: { 
                    ticks: { color: "#94a3b8", precision: 0 }, 
                    grid: { color: "#334155" },
                    title: { display: true, text: "Units Sold", color: "#94a3b8" }
                }
            }
        }
    });
}

/**
 * Standardize item names so variations aggregate into single bars
 */
function normalizeItemName(rawName) {
    let name = rawName.trim();

    // Standardize common items across spelling/volume variations
    if (/bread/i.test(name)) return "Bread";
    if (/milk/i.test(name)) return "Milk";
    if (/coca|coke|soda/i.test(name)) return "Soda / Drinks";
    if (/egg/i.test(name)) return "Eggs";
    if (/sugar/i.test(name)) return "Sugar";
    if (/maize|pap/i.test(name)) return "Maize Meal";

    // Capitalize first letter if not caught by filters
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function profile() {
    openProfile();
    renderProfileModal();
}

function openProfile() {
    document.getElementById("profileOverlay").classList.remove("hidden");
}

function closeProfile() {
    document.getElementById("profileOverlay").classList.add("hidden");
}

function renderProfileModal() {
    const name = cachedStorefrontData?.business_name || "Thabo's Spaza Shop";
    const category = cachedStorefrontData?.business_category || "Spaza Shop";

    const html = `
        <header class="profile-header">
            <div class="profile-avatar-large">
                <img src="MdiLightAccount.svg" alt="Avatar" width="60" height="60">
            </div>
            <h2>${name}</h2>
            <span class="profile-category">${category}</span>
        </header>

        <section class="profile-details-section">
            <div class="detail-group">
                <label>Owner Name</label>
                <p>Thabo Mokoena</p>
            </div>
            <div class="detail-group">
                <label>Email Address</label>
                <p>thabo.mokoena@spaza.co.za</p>
            </div>
            <div class="detail-group">
                <label>Phone Number</label>
                <p>+27 82 555 0192</p>
            </div>
            <div class="detail-group">
                <label>Physical Address</label>
                <p>1042 Vilakazi Street, Soweto, Johannesburg</p>
            </div>
            <div class="detail-group">
                <label>Registration Number</label>
                <p>2021/849201/07</p>
            </div>
            <div class="detail-group">
                <label>Account Status</label>
                <p><span class="status-badge active">Verified Active Trader</span></p>
            </div>
        </section>
    `;

    document.getElementById("profileContent").innerHTML = html;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(amount) {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return "R" + num.toFixed(2);
}