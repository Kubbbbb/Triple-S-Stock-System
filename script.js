const SUPABASE_URL = 'https://gewmcomtwmjsdduygjxz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdld21jb210d21qc2RkdXlnanh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTc2NTUsImV4cCI6MjA5MDUzMzY1NX0.jS9Jr86-jNG7EltnA1HenSiTXhppw4FG2tGffSZ66RU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTab = 'floor2';
let allData = []; 
let isEditMode = false; // ตัวแปรเช็คสถานะโหมดแก้ไข

// --- ระบบ Auth ---
async function logout() {
    if (confirm("ยืนยันการออกจากระบบ?")) {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }
}

// --- การนำทางและแท็บ ---
function switchTab(e, tab) {
    currentTab = tab;
    isEditMode = false; // ปิดโหมดแก้ไขทุกครั้งที่เปลี่ยนหน้า
    
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // รีเซ็ตปุ่มแก้ไขด้านบน
    const btnEdit = document.querySelector('.btn-edit-mode');
    if(btnEdit) {
        btnEdit.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
        btnEdit.classList.remove('active');
    }
    document.querySelector('.main-content').classList.remove('edit-active');

    // ล้างค่าค้นหา
    document.getElementById("searchInput").value = "";

    const titleMap = { floor2: "Floor 2", floor3: "Floor 3", old_stock: "Old Stock Archive" };
    document.getElementById("title").innerText = titleMap[tab];
    fetchData();
}

function goToAddPage() {
    window.location.href = `add_item.html?tab=${currentTab}`;
}

let currentEditId = null; // เก็บ ID ที่กำลังแก้ไข

// --- ฟังก์ชันเปิด Modal เพื่อแก้ไข ---
function editItem(id) {
    currentEditId = id;
    const item = allData.find(d => d.id === id);
    if (!item) return;


    const modal = document.getElementById("editModal");
    const container = document.getElementById("modal-fields");
    container.innerHTML = "";

    const config = {
        floor2: [
            { label: 'Type', key: 'type', type: 'text' },
            { label: 'Item', key: 'item', type: 'text' },
            { label: 'Unit', key: 'unit', type: 'text' },
            { label: 'QTY', key: 'qty', type: 'number' },
            { label: 'Price', key: 'price', type: 'number' },
            { label: 'Amount (Auto)', key: 'amount', type: 'number', readonly: true, required: false },
            { label: 'Date', key: 'date', type: 'date' }
        ],
        floor3: [
            { label: 'Brand', key: 'brand', type: 'text' },
            { label: 'Code', key: 'code', type: 'text' },
            { label: 'Type', key: 'type', type: 'text' },
            { label: 'Name', key: 'name', type: 'text' },
            { label: 'Color', key: 'color', type: 'text' },
            { label: 'QTY', key: 'qty', type: 'number' },
            { label: 'Price', key: 'price', type: 'number' }
        ],
        old_stock: [
            { label: 'Type', key: 'type', type: 'text' },
            { label: 'Detail', key: 'name_detail', type: 'text' },
            { label: 'Incoming Date', key: 'incoming_date', type: 'date' },
            { label: 'Remaining', key: 'remaining', type: 'number' },
            { label: 'Location', key: 'location', type: 'text' }
        ]
    };

    const fields = config[currentTab];

    fields.forEach(f => {
        container.innerHTML += `
            <div class="form-group">
                <label>${f.label}</label>
                <input 
                    type="${f.type}" 
                    id="edit-${f.key}" 
                    value="${item[f.key] ?? ''}" 
                    ${f.readonly ? 'readonly style="background:#f8fafc;cursor:not-allowed;"' : ''}
                    ${f.required === false ? '' : 'required'}
                >
            </div>
        `;
    });

    // ✅ Auto calculate (Floor 2)
    if (currentTab === 'floor2') {
        const qInput = document.getElementById('edit-qty');
        const pInput = document.getElementById('edit-price');
        const aInput = document.getElementById('edit-amount');

        const calc = () => {
            const q = parseFloat(qInput.value) || 0;
            const p = parseFloat(pInput.value) || 0;
            aInput.value = (q * p).toFixed(2);
        };

        qInput.oninput = calc;
        pInput.oninput = calc;
    }

modal.style.display = "flex";
lucide.createIcons();


}


function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
}

/// --- ฟังก์ชันบันทึกข้อมูลที่แก้ไขไปยัง Supabase ---
document.getElementById("editForm").onsubmit = async (e) => {
    e.preventDefault();


    const btn = document.getElementById("btnSaveModal");
    btn.innerText = "กำลังบันทึก...";
    btn.disabled = true;

    // รวบรวมข้อมูลจาก Modal
    const updateData = {};
    const inputs = document.querySelectorAll("#modal-fields input");

    inputs.forEach(input => {
        const key = input.id.replace("edit-", "");

        if (key === 'amount') return; // 🚨 แก้ตรงนี้ (สำคัญมาก)

        const val = input.value;
        updateData[key] = (input.type === 'number') ? parseFloat(val) || 0 : val;
    });

    // ส่งคำสั่ง Update ไปยัง Supabase
    const { error } = await supabaseClient
        .from(currentTab)
        .update(updateData)
        .eq('id', currentEditId);

    if (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
        btn.innerText = "บันทึกการเปลี่ยนแปลง";
        btn.disabled = false;
    } else {
        alert("แก้ไขข้อมูลสำเร็จ!");
        closeEditModal();
        fetchData();
    }


};


// --- ฟังก์ชันเปิด/ปิดโหมดแก้ไข (แสดง/ซ่อนดินสอ) ---
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.querySelector('.btn-edit-mode');
    const mainContent = document.querySelector('.main-content');

    if (isEditMode) {
        btn.innerHTML = '<i data-lucide="check-circle"></i> เสร็จสิ้นการแก้ไข';
        btn.classList.add('active');
        mainContent.classList.add('edit-active'); // CSS จะสั่งให้ .manage-column แสดงผล
    } else {
        btn.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
        btn.classList.remove('active');
        mainContent.classList.remove('edit-active'); // CSS จะสั่งให้ .manage-column ซ่อนไป
    }
    lucide.createIcons();
}

// --- จัดการข้อมูล ---
async function fetchData() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>กำลังโหลดข้อมูล...</td></tr>";

    const { data, error } = await supabaseClient.from(currentTab).select("*");
    
    if (error) {
        console.error(error);
        tbody.innerHTML = "<tr><td colspan='12' style='text-align:center; color:red;'>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>";
        return;
    }

    allData = data;
    renderTable(data);
}

function handleSearch() {
    const keyword = document.getElementById("searchInput").value.toLowerCase();
    const filteredData = allData.filter(item => {
        return Object.values(item).some(val => 
            String(val).toLowerCase().includes(keyword)
        );
    });
    renderTable(filteredData);
}

// --- แสดงผลตาราง ---
function renderTable(data) {
    const thead = document.getElementById("thead");
    const tbody = document.getElementById("tbody");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='12' style='text-align:center; padding: 40px;'>ไม่พบข้อมูล</td></tr>";
        return;
    }

    // สร้างหัวตาราง (เพิ่มคลาส manage-column เพื่อรอการซ่อน/แสดง)
    if (currentTab === "floor2") {
        thead.innerHTML = `<tr>
            <th style="width: 50px;">No.</th>
            <th>Type</th><th>Item</th><th>Unit</th><th>QTY</th><th>Date</th><th>Price</th><th>Amount</th>
            <th class="manage-column" style="width: 80px; text-align:center;">Manage</th>
        </tr>`;
    } else if (currentTab === "floor3") {
        thead.innerHTML = `<tr>
            <th style="width: 50px;">No.</th>
            <th>Brand</th><th>Code</th><th>Type</th><th>Name</th><th>Color</th><th>QTY</th><th>Price</th>
            <th class="manage-column" style="width: 80px; text-align:center;">Manage</th>
        </tr>`;
    } else if (currentTab === "old_stock") {
        thead.innerHTML = `<tr>
            <th style="width: 50px;">No.</th>
            <th>Type</th><th>Detail</th><th>Incoming</th><th>Remaining</th><th>Location</th>
            <th class="manage-column" style="width: 80px; text-align:center;">Manage</th>
        </tr>`;
    }

    // สร้างแถวข้อมูล
    data.forEach((r, index) => {
        let rowHTML = `<tr><td>${index + 1}</td>`;

        if (currentTab === "floor2") {
            rowHTML += `<td>${r.type || '-'}</td><td>${r.item || '-'}</td><td>${r.unit || '-'}</td><td>${Number(r.qty || 0).toLocaleString()}</td><td>${r.date || '-'}</td><td>${Number(r.price || 0).toLocaleString()}</td><td>${Number(r.amount || 0).toLocaleString()}</td>`;
        } else if (currentTab === "floor3") {
            rowHTML += `<td>${r.brand || '-'}</td><td><code style="background:#f1f5f9;padding:2px 5px;border-radius:4px;">${r.code || '-'}</code></td><td>${r.type || '-'}</td><td>${r.name || '-'}</td><td>${r.color || '-'}</td><td>${Number(r.qty || 0).toLocaleString()}</td><td>${Number(r.price || 0).toLocaleString()}</td>`;
        } else if (currentTab === "old_stock") {
            rowHTML += `<td>${r.type || '-'}</td><td>${r.name_detail || '-'}</td><td>${r.incoming_date || '-'}</td><td><b style="color:#e11d48;">${Number(r.remaining || 0).toLocaleString()}</b></td><td><span style="background:#e2e8f0;padding:2px 8px;border-radius:10px;font-size:0.85rem;">${r.location || '-'}</span></td>`;
        }

        // เพิ่มปุ่มแก้ไข (มีคลาส manage-column เพื่อให้ซ่อน/แสดง)
        rowHTML += `
            <td class="manage-column" style="text-align:center;">
                <button class="btn-row-edit" onclick="editItem('${r.id}')" title="แก้ไขรายการ">
                    <i data-lucide="edit-2"></i>
                </button>
            </td>
        </tr>`;

        tbody.innerHTML += rowHTML;
    });

    lucide.createIcons();
}

// โหลดข้อมูลครั้งแรก
fetchData();

