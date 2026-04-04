// --- 1. ตั้งค่า Supabase ---
const SUPABASE_URL = 'https://gewmcomtwmjsdduygjxz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdld21jb210d21qc2RkdXlnanh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTc2NTUsImV4cCI6MjA5MDUzMzY1NX0.jS9Jr86-jNG7EltnA1HenSiTXhppw4FG2tGffSZ66RU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. ตัวแปรควบคุมระบบ ---
let currentTab = 'floor2';
let allData = []; 
let isEditMode = false;
let pendingChanges = {}; // เก็บข้อมูลที่ถูกแก้ไข { id: { field: value } }

// --- 3. โครงสร้างฟิลด์ข้อมูล ---
const fieldsConfig = {
    floor2: [
        { id: 'type', type: 'text' },
        { id: 'item', type: 'text' },
        { id: 'serial', type: 'text' }, // เพิ่ม Serial
        { id: 'unit', type: 'text' },
        { id: 'qty', type: 'number' },
        { id: 'date', type: 'date' },
        { id: 'price', type: 'number' },
        { id: 'amount', type: 'number', readonly: true }
    ],
    floor3: [
        { id: 'brand', type: 'text' },
        { id: 'code', type: 'text' },
        { id: 'serial', type: 'text' }, // เพิ่ม Serial
        { id: 'type', type: 'text' },
        { id: 'name', type: 'text' },
        { id: 'color', type: 'text' },
        { id: 'qty', type: 'number' },
        { id: 'price', type: 'number' }
    ],
    old_stock: [
        { id: 'type', type: 'text' },
        { id: 'serial', type: 'text' }, // เพิ่ม Serial
        { id: 'name_detail', type: 'text' },
        { id: 'incoming_date', type: 'date' },
        { id: 'remaining', type: 'number' },
        { id: 'location', type: 'text' }
    ]
};

// ==========================================
//    ระบบ Auth & Navigation
// ==========================================

async function logout() {
    if (confirm("ยืนยันการออกจากระบบ?")) {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }
}

function switchTab(e, tab) {
    if (Object.keys(pendingChanges).length > 0) {
        if (!confirm("คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการเปลี่ยนหน้าโดยไม่บันทึกหรือไม่?")) return;
    }
    currentTab = tab;
    isEditMode = false;
    pendingChanges = {}; 
    
    // จัดการ UI Menu
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    if(e) e.currentTarget.classList.add('active');
    
    const btnEdit = document.querySelector('.btn-edit-mode');
    btnEdit.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
    btnEdit.classList.remove('active');
    
    // สลับการแสดงผลระหว่าง Table กับ Scanner
    const tableContainer = document.querySelector('.table-container');
    const searchContainer = document.querySelector('.search-container');
    const scannerSection = document.getElementById('scanner-section');
    const titleHeader = document.getElementById('title');

    if (tab === 'scanner') {
        tableContainer.style.display = 'none';
        searchContainer.style.display = 'none';
        scannerSection.style.display = 'block';
        titleHeader.innerText = "Barcode Scanner";
        startScanner(); // เริ่มเปิดกล้อง
    } else {
        tableContainer.style.display = 'block';
        searchContainer.style.display = 'flex';
        scannerSection.style.display = 'none';
        
        const titleMap = { floor2: "Floor 2", floor3: "Floor 3", old_stock: "Old Stock Archive" };
        titleHeader.innerText = titleMap[tab];
        
        stopScanner(); // ปิดกล้องเพื่อประหยัดทรัพยากร
        fetchData();
    }
    lucide.createIcons();
}

// ==========================================
//    ส่วนของ POPUP: เพิ่มรายการใหม่ (ADD)
// ==========================================

// เพิ่มพารามิเตอร์ defaultSerial
function openAddModal(defaultSerial = "") {
    const modal = document.getElementById("addModal");
    const container = document.getElementById("add-modal-fields");
    const title = document.getElementById("add-modal-title");
    container.innerHTML = "";

    // ตั้งชื่อหัวข้อ Modal ตามตารางที่เลือก
    const tabNames = { floor2: 'Floor 2', floor3: 'Floor 3', old_stock: 'Old Stock' };
    title.innerText = `เพิ่มรายการใหม่ลงใน ${tabNames[currentTab]}`;

    // ดึงโครงสร้างฟิลด์จาก Config
    let fieldsToRender = fieldsConfig[currentTab];

    fieldsToRender.forEach(f => {
        const div = document.createElement('div');
        div.className = 'form-group';
        
        // กำหนดค่าเริ่มต้น (ถ้ามี Serial ส่งมาจาก Scanner ให้ใส่ในช่อง serial)
        let val = "";
        if (f.id === 'serial' && defaultSerial) val = defaultSerial;
        if (f.id === 'date' || f.id === 'incoming_date') val = new Date().toISOString().split('T')[0];

        div.innerHTML = `
            <label>${f.id.toUpperCase()}</label>
            <input type="${f.type}" id="add-${f.id}" ${f.readonly ? 'readonly' : ''} value="${val}" required>
        `;
        container.appendChild(div);
    });

    // สูตรคำนวณราคารวมเฉพาะ Floor 2
    if (currentTab === 'floor2') {
        const calc = () => {
            const q = document.getElementById('add-qty').value;
            const p = document.getElementById('add-price').value;
            document.getElementById('add-amount').value = (q * p).toFixed(2);
        };
        document.getElementById('add-qty').oninput = calc;
        document.getElementById('add-price').oninput = calc;
    }

    modal.style.display = "flex";
    lucide.createIcons();
}

function closeAddModal() {
    document.getElementById("addModal").style.display = "none";
}

document.getElementById('addForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveAdd');
    btn.innerText = "กำลังบันทึก...";
    btn.disabled = true;

    const payload = {};
    // เก็บข้อมูลจากทุกฟิลด์ใน Modal
    fieldsConfig[currentTab].forEach(f => {
        if (f.id === 'amount' && currentTab === 'floor2') {
            const q = parseFloat(document.getElementById('add-qty').value) || 0;
            const p = parseFloat(document.getElementById('add-price').value) || 0;
            payload.amount = q * p;
            return;
        }
        const inputEl = document.getElementById(`add-${f.id}`);
        if (inputEl) {
            const val = inputEl.value;
            payload[f.id] = (f.type === 'number') ? parseFloat(val) || 0 : val;
        }
    });

    const { error } = await supabaseClient.from(currentTab).insert([payload]);
    
    if (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
        btn.innerText = "บันทึกข้อมูลรายการ";
        btn.disabled = false;
    } else {
        // --- ส่วนที่แก้ไขเพื่อความต่อเนื่อง ---
        
        // 1. ปิด Modal
        closeAddModal();
        
        // 2. ถ้าเราอยู่ในหน้า Scanner ให้สั่ง Reset Scanner ทันที
        const scannerSection = document.getElementById('scanner-section');
        if (scannerSection && scannerSection.style.display !== 'none') {
            // แจ้งเตือนสั้นๆ ว่าบันทึกแล้ว (Optional: ใช้ Toast แทน alert จะดีกว่าเพื่อไม่ให้ขัดจังหวะ)
            console.log("บันทึกรายการใหม่สำเร็จ กำลังเตรียมสแกนต่อ...");
            
            // เรียกฟังก์ชันรีเซ็ตสถานะการสแกน
            scanAgain(); 
            
        } else {
            // ถ้าอยู่ในหน้าตารางปกติ ก็แค่โหลดข้อมูลใหม่
            alert("บันทึกข้อมูลสำเร็จ");
            fetchData();
        }
    }
    
    btn.innerText = "บันทึกข้อมูลรายการ";
    btn.disabled = false;
};

// ==========================================
//    ระบบแก้ไขในตาราง (INLINE EDIT & BULK SAVE)
// ==========================================

function trackChange(id, field, value, type) {
    if (!pendingChanges[id]) pendingChanges[id] = {};
    let finalValue = (type === 'number') ? parseFloat(value) || 0 : value;
    pendingChanges[id][field] = finalValue;

    // สูตรคำนวณ Floor 2
    if (currentTab === 'floor2' && (field === 'qty' || field === 'price')) {
        const row = allData.find(d => d.id === id);
        const q = (field === 'qty') ? finalValue : (pendingChanges[id]['qty'] ?? row.qty);
        const p = (field === 'price') ? finalValue : (pendingChanges[id]['price'] ?? row.price);
        const amt = (q * p).toFixed(2);
        const amtDisplay = document.getElementById(`display-${id}-amount`);
        if (amtDisplay) amtDisplay.innerText = Number(amt).toLocaleString();
        pendingChanges[id]['amount'] = parseFloat(amt);
    }
}

async function toggleEditMode() {
    const btn = document.querySelector('.btn-edit-mode');
    if (!isEditMode) {
        isEditMode = true;
        btn.innerHTML = '<i data-lucide="save"></i> บันทึกการแก้ไขทั้งหมด';
        btn.classList.add('active');
        renderTable(allData);
    } else {
        if (Object.keys(pendingChanges).length > 0) {
            await saveBulkChanges();
        } else {
            isEditMode = false;
            btn.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
            btn.classList.remove('active');
            renderTable(allData);
        }
    }
    lucide.createIcons();
}

async function saveBulkChanges() {
    const btn = document.querySelector('.btn-edit-mode');
    btn.innerHTML = "กำลังบันทึก...";
    btn.disabled = true;

    try {
        const promises = Object.keys(pendingChanges).map(id => 
            supabaseClient.from(currentTab).update(pendingChanges[id]).eq('id', id)
        );
        await Promise.all(promises);
        alert(`บันทึกการแก้ไขทั้งหมด ${Object.keys(pendingChanges).length} รายการสำเร็จ`);
        pendingChanges = {};
        isEditMode = false;
        btn.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
        btn.classList.remove('active');
        fetchData();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
        btn.disabled = false;
    }
}

// ==========================================
//    ระบบจัดการตารางและการแสดงผล
// ==========================================

async function fetchData() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>กำลังโหลดข้อมูล...</td></tr>";
    const { data, error } = await supabaseClient.from(currentTab).select("*").order('type', { ascending: true }); 
    if (error) return;
    allData = data;
    renderTable(data);
}

function renderTable(data) {
    const thead = document.getElementById("thead");
    const tbody = document.getElementById("tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    let headers = [];
    // เพิ่ม Serial เข้าไปใน headers ของแต่ละ tab
    if (currentTab === "floor2") headers = ["No.", "Type", "Item", "Serial", "Unit", "QTY", "Date", "Price", "Amount"];
    else if (currentTab === "floor3") headers = ["No.", "Brand", "Code", "Serial", "Type", "Name", "Color", "QTY", "Price"];
    else if (currentTab === "old_stock") headers = ["No.", "Type", "Serial", "Detail", "Incoming", "Remaining", "Location"];

    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}${isEditMode ? '' : '<th class="manage-column">Manage</th>'}</tr>`;

    data.forEach((r, index) => {
    const tr = document.createElement("tr");
    
    // เพิ่ม CSS ให้เมาส์เป็นรูปมือ และเมื่อคลิกจะไปหน้ารายละเอียด (ยกเว้นตอนกดปุ่มแก้ไข)
    tr.style.cursor = "pointer";
    tr.onclick = (e) => {
        // ถ้าคลิกโดนปุ่มแก้ไข หรืออยู่ในโหมดแก้ไข ไม่ต้องไปหน้าใหม่
        if (e.target.closest('.manage-column') || isEditMode) return;
        window.location.href = `item_details.html?id=${r.id}&tab=${currentTab}`;
    };
        let html = `<td>${index + 1}</td>`;
        
        fieldsConfig[currentTab].forEach(f => {
            let val = r[f.id] ?? '-';
            if (isEditMode && f.id !== 'amount') {
                html += `<td><input type="${f.type}" class="inline-edit-input" value="${val}" oninput="trackChange('${r.id}', '${f.id}', this.value, '${f.type}')"></td>`;
            } else {
                let displayVal = (f.id === 'amount') ? `<span id="display-${r.id}-amount">${Number(val).toLocaleString()}</span>` : (typeof val === 'number' ? val.toLocaleString() : val);
                html += `<td>${displayVal}</td>`;
            }
        });

        if (!isEditMode) {
            html += `<td class="manage-column" style="text-align:center;"><button class="btn-row-edit" onclick="isEditMode=false; toggleEditMode();"><i data-lucide="edit-2"></i></button></td>`;
        }
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function handleSearch() {
    const keyword = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allData.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(keyword)));
    renderTable(filtered);
}

window.onload = fetchData;

// --- เพิ่ม/แก้ไข ฟังก์ชันเหล่านี้ใน script.js ---

async function loadUserProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        // แสดง Email
        document.getElementById('userEmail').innerText = user.email;

        // ดึงรูปโปรไฟล์จาก metadata
        const avatarUrl = user.user_metadata?.avatar_url;
        const avatarImg = document.getElementById('userAvatar');
        
        if (avatarUrl) {
            avatarImg.src = avatarUrl;
        } else {
            // ถ้าไม่มีรูป ให้ใช้ชื่อย่อจาก Email สร้างรูป
            avatarImg.src = `https://ui-avatars.com/api/?name=${user.email}&background=random&color=fff`;
        }
    }
}

async function uploadAvatar(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const avatarImg = document.getElementById('userAvatar');
    const originalSrc = avatarImg.src;
    avatarImg.style.opacity = "0.4"; // แสดงสถานะกำลังโหลด

    try {
        const fileExt = file.name.split('.').pop();
        const filePath = `private/${user.id}-${Date.now()}.${fileExt}`;

        // 1. อัปโหลดไปที่ Storage (Bucket: profiles)
        const { error: uploadError } = await supabaseClient.storage
            .from('profiles')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. ดึง URL สาธารณะ
        const { data: { publicUrl } } = supabaseClient.storage
            .from('profiles')
            .getPublicUrl(filePath);

        // 3. อัปเดตข้อมูล User Metadata
        const { error: updateError } = await supabaseClient.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        if (updateError) throw updateError;

        avatarImg.src = publicUrl;
        alert("อัปเดตโปรไฟล์สำเร็จ");

    } catch (error) {
        alert("อัปโหลดไม่สำเร็จ: " + error.message);
        avatarImg.src = originalSrc;
    } finally {
        avatarImg.style.opacity = "1";
    }
}

// เรียกใช้งานเมื่อโหลดหน้า
const currentOnload = window.onload;
window.onload = () => {
    if (currentOnload) currentOnload();
    loadUserProfile();
    lucide.createIcons();
};

// --- ส่วนของ Scanner Logic (แก้ไขให้หยุดเมื่อสแกนติด) ---

// --- ส่วนของ Scanner Logic (เปิดกล้องค้างไว้ แต่หยุดรับข้อมูลชั่วคราว) ---

let html5QrCode = null;
let isScanningPaused = false; // ตัวแปรควบคุมการรับข้อมูล

async function switchTab(e, tab) {
    // 1. ตรวจสอบการแก้ไขที่ยังไม่ได้บันทึก (Logic เดิม)
    if (Object.keys(pendingChanges).length > 0) {
        if (!confirm("คุณมีการแก้ไขที่ยังไม่ได้บันทึก ต้องการเปลี่ยนหน้าโดยไม่บันทึกหรือไม่?")) return;
    }

    // 2. หยุดกล้องถ้าเปลี่ยนออกจากหน้า Scanner (Logic เดิม)
    if (currentTab === 'scanner' && tab !== 'scanner') {
        stopScanner();
    }

    // 3. อัปเดตสถานะ Tab ปัจจุบัน
    currentTab = tab;
    isEditMode = false;
    pendingChanges = {}; 

    // --- ส่วนจัดการสี Sidebar ---
    // ลบ class 'active' ออกจากปุ่มเมนูทั้งหมด
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.remove('active');
    });

    // เพิ่ม class 'active' ให้กับปุ่มที่ถูกเลือก
    if (e && e.currentTarget) {
        // กรณีเปลี่ยนจากการคลิกปุ่มโดยตรง
        e.currentTarget.classList.add('active');
    } else {
        // กรณีเรียกผ่านโค้ด (เช่น ตอนโหลดหน้าแรก หรือเปลี่ยน Tab อัตโนมัติ)
        // ค้นหาปุ่มที่มี onclick ตรงกับชื่อ tab นั้นๆ
        const targetBtn = document.querySelector(`.menu-item[onclick*="'${tab}'"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }
    // -------------------------

    // 4. จัดการการแสดงผล Main Content (Logic เดิมที่ปรับปรุงเรื่อง Scanner)
    const normalUI = document.querySelectorAll('.search-container, .table-container');
    const scannerUI = document.getElementById('scanner-section');

    if (tab === 'scanner') {
        normalUI.forEach(el => el.style.display = 'none');
        scannerUI.style.display = 'block';
        document.getElementById("title").innerText = "Scanner";
        isScanningPaused = false;
        startScanner(); 
    } else {
        normalUI.forEach(el => el.style.display = '');
        document.querySelector('.search-container').style.display = 'flex';
        scannerUI.style.display = 'none';
        
        const titleMap = { floor2: "Floor 2", floor3: "Floor 3", old_stock: "Old Stock Archive" };
        document.getElementById("title").innerText = titleMap[tab] || "System";
        fetchData();
    }

    const btnEdit = document.querySelector('.btn-edit-mode');
    if (btnEdit) {
        btnEdit.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
        btnEdit.classList.remove('active');
    }

    document.getElementById("searchInput").value = "";
    lucide.createIcons();
}

async function startScanner() {
    resetScannerUI();
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    if (!html5QrCode.isScanning) {
        try {
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config,
                (decodedText) => {
                    // ตรวจสอบว่าอยู่ในช่วงพักการสแกนหรือไม่
                    if (isScanningPaused) return; 
                    
                    // ถ้าไม่พัก ให้ดำเนินการต่อและสั่งพักทันที
                    isScanningPaused = true; 
                    handleScanSuccess(decodedText);
                }
            );
        } catch (err) {
            console.error("Scanner Error:", err);
        }
    }
}

async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.error("Stop Error:", err);
        }
    }
}

function scanAgain() {
    isScanningPaused = false; // ปลดล็อกให้กล้องทำงาน
    
    // ซ่อนการ์ดผลลัพธ์
    const resultCard = document.getElementById('scan-result-card');
    if (resultCard) resultCard.style.display = 'none';
    
    // แสดง Placeholder "รอผลการสแกน"
    const placeholder = document.getElementById('scan-placeholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <i data-lucide="package-search" style="width: 48px; height: 48px; color: #cbd5e1;"></i>
            <p style="margin-top:10px; color: #94a3b8;">รอผลการสแกนข้อมูล...</p>
        `;
    }
    
    // รีเฟรชไอคอน Lucide
    lucide.createIcons();
}

async function handleScanSuccess(decodedText) {
    isScanningPaused = true; 
    const placeholder = document.getElementById('scan-placeholder');
    const resultCard = document.getElementById('scan-result-card');
    
    resultCard.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `<div class="loader"></div><p style="margin-top:10px;">กำลังค้นหา Serial: ${decodedText}...</p>`;
    
    let foundItem = null;
    let tableFound = '';
    const tables = ['floor2', 'floor3', 'old_stock'];
    
    for (const table of tables) {
        const { data } = await supabaseClient.from(table).select('*').eq('serial', decodedText).maybeSingle();
        if (data) { foundItem = data; tableFound = table; break; }
    }

    if (foundItem) {
        // ถ้าเจอ -> อัปเดตจำนวนอัตโนมัติ (+1 หรือ -1)
        await processAutoUpdate(foundItem, tableFound);
    } else {
        // ถ้าไม่เจอ
        if (scanOperation === 'minus') {
            placeholder.innerHTML = `
                <i data-lucide="alert-triangle" style="color: #ef4444; width: 54px; height: 54px;"></i>
                <h3 style="margin-top:15px;">ไม่พบสินค้าที่จะลดจำนวน</h3>
                <p>Serial: <strong>${decodedText}</strong></p>
                <button class="btn-cancel" onclick="scanAgain()" style="margin-top:15px;"><i data-lucide="refresh-cw"></i> สแกนใหม่</button>
            `;
            lucide.createIcons();
        } else {
            // ถ้าโหมดเป็น "บวก" (เพิ่มจำนวน) แล้วหาไม่เจอ -> ให้ถามเพื่อสร้างใหม่
            showNotFoundAndAddUI(decodedText);
        }
    }
}

function displayScanResult(data, tableName, isUpdated = false, newQty = null) {
    // ลบตัวนับเวลาเก่า (ถ้ามี)
    const oldTimer = document.getElementById('resume-timer');
    if (oldTimer) oldTimer.remove();

    document.getElementById('scan-placeholder').style.display = 'none';
    const card = document.getElementById('scan-result-card');
    card.style.display = 'block';

    const qtyField = (tableName === 'old_stock') ? 'remaining' : 'qty';
    const titleMap = { floor2: 'Floor 2', floor3: 'Floor 3', old_stock: 'Old Stock' };
    
    document.getElementById('res-tab-label').innerText = titleMap[tableName];
    
    let titleHtml = data.item || data.name || data.name_detail || 'No Name';
    if (isUpdated) {
        const badgeColor = (scanOperation === 'plus') ? '#10b981' : '#ef4444';
        const badgeText = (scanOperation === 'plus') ? '+1 สำเร็จ' : '-1 สำเร็จ';
        titleHtml += ` <span style="background:${badgeColor}; color:white; padding:4px 10px; border-radius:6px; font-size:14px; margin-left:10px;">${badgeText}</span>`;
    }
    document.getElementById('res-title').innerHTML = titleHtml;

    const detailsGrid = document.getElementById('res-details-list');
    detailsGrid.innerHTML = '';

    // แสดงเฉพาะข้อมูลสำคัญเพื่อให้ดูง่ายตอนสแกนไวๆ
    const importantFields = ['serial', qtyField, 'type', 'brand', 'location'];
    fieldsConfig[tableName].forEach(f => {
        if (!importantFields.includes(f.id)) return;
        
        let val = (isUpdated && f.id === qtyField) ? newQty : data[f.id];
        if (val !== undefined) {
            const row = document.createElement('div');
            row.className = 'res-info-row';
            row.innerHTML = `<span class="label">${f.id.toUpperCase()}</span><span class="value">${val}</span>`;
            detailsGrid.appendChild(row);
        }
    });

    document.getElementById('btn-go-detail').onclick = () => {
        isScanningPaused = true; // หยุดสแกนแน่นอนถ้าจะไปหน้ารายละเอียด
        window.location.href = `item_details.html?id=${data.id}&tab=${tableName}`;
    };
    lucide.createIcons();
}

function resetScannerUI() {
    document.getElementById('scan-result-card').style.display = 'none';
    const placeholder = document.getElementById('scan-placeholder');
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <i data-lucide="package-search" style="width: 48px; height: 48px; color: #cbd5e1;"></i>
        <p style="margin-top:10px;">รอผลการสแกนข้อมูล...</p>
    `;
    lucide.createIcons();
}

// --- เพิ่มตัวแปรที่ส่วนบนของไฟล์ ---
let scanTargetTable = 'floor2'; // ค่าเริ่มต้น

// --- ฟังก์ชันสำหรับเลือกตารางในหน้า Scanner ---
function setScanTarget(tableName, btn) {
    scanTargetTable = tableName;
    // เปลี่ยนสีปุ่มที่เลือก
    document.querySelectorAll('.tab-select').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // รีเซ็ต UI ผลลัพธ์เดิม
    resetScannerUI();
    console.log("เป้าหมายการสแกนถูกเปลี่ยนเป็น:", tableName);
}


// --- ปรับปรุง handleScanSuccess ให้เรียกใช้ processAutoUpdate ---
async function handleScanSuccess(decodedText) {
    isScanningPaused = true; 
    const placeholder = document.getElementById('scan-placeholder');
    const resultCard = document.getElementById('scan-result-card');
    resultCard.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `<div class="loader"></div><p style="margin-top:10px;">กำลังค้นหา Serial: ${decodedText}...</p>`;
    
    let foundItem = null;
    let tableFound = '';
    const tables = ['floor2', 'floor3', 'old_stock'];
    
    for (const table of tables) {
        try {
            const { data } = await supabaseClient.from(table).select('*').eq('serial', decodedText).maybeSingle();
            if (data) { foundItem = data; tableFound = table; break; }
        } catch (e) {}
    }

    if (foundItem) {
        // เรียกใช้ฟังก์ชันอัปเดต (บวกหรือลดตามโหมด)
        await processAutoUpdate(foundItem, tableFound);
    } else {
        // ถ้าไม่เจอ และอยู่ในโหมด "ลดจำนวน" อาจจะแค่แจ้งว่าไม่พบ
        if (scanOperation === 'minus') {
            placeholder.innerHTML = `
                <i data-lucide="alert-triangle" style="color: #ef4444; width: 54px; height: 54px;"></i>
                <h3 style="margin-top:15px;">ไม่พบสินค้าที่จะลดจำนวน</h3>
                <p>Serial: ${decodedText}</p>
                <button class="btn-cancel" onclick="scanAgain()" style="margin-top:15px;"><i data-lucide="refresh-cw"></i> สแกนใหม่</button>
            `;
        } else {
            showNotFoundAndAddUI(decodedText);
        }
    }
    lucide.createIcons();
}


// ฟังก์ชันอัปเดตจำนวนสต็อก (+1)
async function processIncrementStock(item, tableName) {
    const placeholder = document.getElementById('scan-placeholder');
    // ตรวจสอบชื่อฟิลด์จำนวน (Floor2/3 ใช้ qty, Old Stock ใช้ remaining)
    const qtyField = (tableName === 'old_stock') ? 'remaining' : 'qty';
    const currentQty = item[qtyField] || 0;
    const newQty = currentQty + 1;

    placeholder.innerHTML = `<div class="loader"></div><p style="margin-top:10px;">พบสินค้า! กำลังอัปเดตจำนวน (+1)...</p>`;

    try {
        const { error } = await supabaseClient
            .from(tableName)
            .update({ [qtyField]: newQty })
            .eq('id', item.id);

        if (error) throw error;

        // แสดงผลลัพธ์ว่าอัปเดตสำเร็จ
        displayScanResult(item, tableName, true); // ส่ง true เพื่อบอกว่าเป็นการอัปเดต
    } catch (err) {
        alert("อัปเดตจำนวนไม่สำเร็จ: " + err.message);
        displayScanResult(item, tableName, false);
    }
}

function showNotFoundAndAddUI(serial) {
    const placeholder = document.getElementById('scan-placeholder');
    // อ้างอิงชื่อตารางจากตัวแปร scanTargetTable ที่เลือกไว้ในหน้า Scanner
    const targetTitle = scanTargetTable === 'floor2' ? 'Floor 2' : (scanTargetTable === 'floor3' ? 'Floor 3' : 'Old Stock');
    
    placeholder.innerHTML = `
        <div style="text-align:center; padding: 10px;">
            <i data-lucide="help-circle" style="color: #f59e0b; width: 64px; height: 64px; margin-bottom:15px;"></i>
            <h3 style="color: #1e293b; margin-bottom:5px;">ไม่พบ Serial นี้ในระบบ</h3>
            <p style="color: #64748b; margin-bottom: 20px;">ต้องการเพิ่ม <strong>${serial}</strong><br>ลงในตาราง <strong>${targetTitle}</strong> หรือไม่?</p>
            
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button class="btn-add" onclick="confirmAndOpenAdd('${serial}')" style="width:100%; justify-content:center; height:50px; font-size:1rem;">
                    <i data-lucide="plus-circle"></i> ใช่, เพิ่มรายการใหม่
                </button>
                <button class="btn-cancel" onclick="scanAgain()" style="width:100%; justify-content:center; height:50px; border: 1px solid #e2e8f0; font-size:1rem;">
                    <i data-lucide="refresh-cw"></i> ไม่ใช่, ลองสแกนใหม่
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function confirmAndOpenAdd(serial) {
    // 1. เปลี่ยน Tab หลักให้ตรงกับที่เลือกไว้ใน Scanner เพื่อให้ Modal สร้างฟิลด์ถูกตาราง
    currentTab = scanTargetTable;
    // 2. เปิด Modal พร้อมส่ง Serial เข้าไป
    openAddModal(serial);
}

// ฟังก์ชันเปิด Modal เพิ่มรายการใหม่ โดยใส่ Serial ให้เลย
function openAddModalWithSerial(serial) {
    // เปลี่ยนหน้าไปตารางที่เลือกไว้ก่อน (จากตัวเลือกบนหน้า Scanner)
    // แล้วเปิด Modal
    openAddModal();
    
    // หน่วงเวลาเล็กน้อยให้ Modal สร้างฟิลด์เสร็จ แล้วค่อยเซ็ตค่า Serial
    setTimeout(() => {
        const serialInput = document.getElementById('add-serial');
        if (serialInput) {
            serialInput.value = serial;
            serialInput.classList.add('highlight-input'); // เพิ่ม class ให้รู้ว่าเติมให้แล้ว
        }
    }, 100);
}

// --- ปรับปรุง displayScanResult เพื่อแสดงสถานะ บวก/ลด ---
function displayScanResult(data, tableName, isUpdated = false, newQty = null) {
    document.getElementById('scan-placeholder').style.display = 'none';
    const card = document.getElementById('scan-result-card');
    card.style.display = 'block';

    const qtyField = (tableName === 'old_stock') ? 'remaining' : 'qty';
    const titleMap = { floor2: 'Floor 2', floor3: 'Floor 3', old_stock: 'Old Stock' };
    
    document.getElementById('res-tab-label').innerText = titleMap[tableName];
    
    let titleHtml = data.item || data.name || data.name_detail || 'No Name';
    if (isUpdated) {
        const badgeColor = (scanOperation === 'plus') ? '#10b981' : '#ef4444';
        const badgeText = (scanOperation === 'plus') ? '+1 สำเร็จ' : '-1 สำเร็จ';
        titleHtml += ` <span style="background:${badgeColor}; color:white; padding:2px 8px; border-radius:4px; font-size:12px; vertical-align:middle;">${badgeText}</span>`;
    }
    document.getElementById('res-title').innerHTML = titleHtml;

    const detailsGrid = document.getElementById('res-details-list');
    detailsGrid.innerHTML = '';

    const config = fieldsConfig[tableName];
    config.forEach(f => {
        let val = (isUpdated && f.id === qtyField) ? newQty : data[f.id];
        if (val !== undefined) {
            const row = document.createElement('div');
            row.className = 'res-info-row';
            row.innerHTML = `<span class="label">${f.id.toUpperCase()}</span><span class="value">${typeof val === 'number' ? val.toLocaleString() : val}</span>`;
            detailsGrid.appendChild(row);
        }
    });

    document.getElementById('btn-go-detail').onclick = () => {
        window.location.href = `item_details.html?id=${data.id}&tab=${tableName}`;
    };
    lucide.createIcons();
}

// --- เพิ่มตัวแปรสถานะที่ส่วนบน ---
let scanOperation = 'plus'; // 'plus' หรือ 'minus'

// --- ฟังก์ชันเลือกโหมดการสแกน ---
function setScanOperation(op, btn) {
    scanOperation = op;
    document.querySelectorAll('.op-select').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    resetScannerUI();
}

async function processAutoUpdate(item, tableName) {
    const placeholder = document.getElementById('scan-placeholder');
    const qtyField = (tableName === 'old_stock') ? 'remaining' : 'qty';
    
    let currentQty = item[qtyField] || 0;
    let newQty = (scanOperation === 'plus') ? currentQty + 1 : currentQty - 1;
    if (newQty < 0) newQty = 0;

    try {
        const updatePayload = { [qtyField]: newQty };
        if (tableName === 'floor2' && item.price) {
            updatePayload.amount = newQty * item.price;
        }

        const { error } = await supabaseClient.from(tableName).update(updatePayload).eq('id', item.id);
        if (error) throw error;

        // เล่นเสียง Beep สั้นๆ (ถ้าเบราว์เซอร์อนุญาต)
        try { new Audio('https://assets.mixkit.co/active_storage/sfx/701/701-preview.mp3').play(); } catch(e){}

        // 1. แสดงผลลัพธ์บนหน้าจอ
        displayScanResult(item, tableName, true, newQty);

        // 2. *** ส่วนสำคัญ: Auto Resume หลังจาก 2 วินาที ***
        // สร้างแถบสถานะบอกผู้ใช้ว่ากำลังจะสแกนต่อ
        const resumeTimerDiv = document.createElement('div');
        resumeTimerDiv.id = "resume-timer";
        resumeTimerDiv.style = "margin-top:15px; font-size:0.8rem; color:#10b981; font-weight:500;";
        resumeTimerDiv.innerHTML = `<i data-lucide="loader-2" class="spin"></i> กำลังเตรียมสแกนชิ้นถัดไป...`;
        document.getElementById('scan-result-card').appendChild(resumeTimerDiv);
        lucide.createIcons();

        setTimeout(() => {
            if (isScanningPaused) { // ตรวจสอบว่ายังอยู่ในโหมดสแกน (ไม่ได้กดไปหน้าอื่น)
                scanAgain(); 
            }
        }, 2000); // รอ 2 วินาทีเพื่อให้ผู้ใช้ดูผลลัพธ์ว่า +1 หรือ -1 สำเร็จจริง

    } catch (err) {
        alert("อัปเดตล้มเหลว: " + err.message);
        displayScanResult(item, tableName, false);
    }
}

// --- เพิ่มฟังก์ชันควบคุม Sidebar ---

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const isOpen = sidebar.classList.toggle('active');
    if (overlay) {
        if (isOpen) {
            overlay.style.display = 'block';
            requestAnimationFrame(() => overlay.classList.add('visible'));
        } else {
            overlay.classList.remove('visible');
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.remove('active');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
}

// ปิด Sidebar อัตโนมัติบนมือถือเมื่อเปลี่ยน Tab
const originalSwitchTab = switchTab; 
switchTab = (e, tab) => {
    originalSwitchTab(e, tab);
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    lucide.createIcons();
}


// เพิ่มการตั้งค่า Lucide Icons ให้รองรับปุ่มเมนูใหม่
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});

// เพิ่มการเรียกใช้ loadUserProfile() ในส่วนที่เกี่ยวข้อง
async function loadUserProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        document.getElementById('userEmail').innerText = user.email;
        const avatarUrl = user.user_metadata?.avatar_url;
        const avatarImg = document.getElementById('userAvatar');
        
        if (avatarUrl) {
            avatarImg.src = avatarUrl;
        } else {
            avatarImg.src = `https://ui-avatars.com/api/?name=${user.email}&background=random&color=fff`;
        }
    }
    // สำคัญ: สร้างไอคอน Lucide ใหม่หลังจากโหลดข้อมูลเสร็จ
    lucide.createIcons();
}

// แก้ไขบรรทัดนี้ในฟังก์ชัน uploadAvatar ในไฟล์ script.js
async function uploadAvatar(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const avatarImg = document.getElementById('userAvatar');
    avatarImg.style.opacity = "0.3"; 

    try {
        const fileExt = file.name.split('.').pop();
        
        // --- แก้ไขบรรทัดข้างล่างนี้ จาก avatars/ เป็น private/ ---
        const filePath = `private/${user.id}-${Date.now()}.${fileExt}`; 

        const { error: uploadError } = await supabaseClient.storage
            .from('profiles')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('profiles')
            .getPublicUrl(filePath);

        await supabaseClient.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        avatarImg.src = publicUrl;
        alert("อัปเดตโปรไฟล์สำเร็จ");
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        avatarImg.style.opacity = "1";
    }
}