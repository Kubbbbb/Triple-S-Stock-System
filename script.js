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
        { id: 'unit', type: 'text' },
        { id: 'qty', type: 'number' },
        { id: 'date', type: 'date' },
        { id: 'price', type: 'number' },
        { id: 'amount', type: 'number', readonly: true }
    ],
    floor3: [
        { id: 'brand', type: 'text' },
        { id: 'code', type: 'text' },
        { id: 'type', type: 'text' },
        { id: 'name', type: 'text' },
        { id: 'color', type: 'text' },
        { id: 'qty', type: 'number' },
        { id: 'price', type: 'number' }
    ],
    old_stock: [
        { id: 'type', type: 'text' },
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
    
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    if(e) e.currentTarget.classList.add('active');
    
    const btnEdit = document.querySelector('.btn-edit-mode');
    btnEdit.innerHTML = '<i data-lucide="edit-3"></i> แก้ไขรายการ';
    btnEdit.classList.remove('active');
    
    document.getElementById("searchInput").value = "";
    const titleMap = { floor2: "Floor 2", floor3: "Floor 3", old_stock: "Old Stock Archive" };
    document.getElementById("title").innerText = titleMap[tab];
    fetchData();
}

// ==========================================
//    ส่วนของ POPUP: เพิ่มรายการใหม่ (ADD)
// ==========================================

function openAddModal() {
    const modal = document.getElementById("addModal");
    const container = document.getElementById("add-modal-fields");
    container.innerHTML = "";

    const addFields = [
        { label: 'ประเภท (Type)', id: 'type', type: 'text' },
        { label: 'ชื่อรายการ (Item)', id: 'item', type: 'text' },
        { label: 'หน่วย (Unit)', id: 'unit', type: 'text' },
        { label: 'จำนวน (QTY)', id: 'qty', type: 'number' },
        { label: 'ราคาต่อหน่วย (Price)', id: 'price', type: 'number' },
        { label: 'ราคารวม (Amount)', id: 'amount', type: 'number', readonly: true, required: false },
        { label: 'วันที่ (Date)', id: 'date', type: 'date', value: new Date().toISOString().split('T')[0] }
    ];

    // หมายเหตุ: ใช้ config เฉพาะสำหรับการ Add เพื่อความสวยงามใน Modal
    let fieldsToRender = (currentTab === 'floor2') ? addFields : fieldsConfig[currentTab].map(f => ({...f, label: f.id.toUpperCase()}));

    fieldsToRender.forEach(f => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${f.label || f.id}</label>
            <input type="${f.type}" id="add-${f.id}" ${f.readonly ? 'readonly' : ''} ${f.value ? `value="${f.value}"` : ''} required>
        `;
        container.appendChild(div);
    });

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
    fieldsConfig[currentTab].forEach(f => {
        if (f.id === 'amount') return;
        const val = document.getElementById(`add-${f.id}`).value;
        payload[f.id] = (f.type === 'number') ? parseFloat(val) || 0 : val;
    });

    const { error } = await supabaseClient.from(currentTab).insert([payload]);
    if (error) alert(error.message);
    else { alert("บันทึกสำเร็จ"); closeAddModal(); fetchData(); }
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
    if (currentTab === "floor2") headers = ["No.", "Type", "Item", "Unit", "QTY", "Date", "Price", "Amount"];
    else if (currentTab === "floor3") headers = ["No.", "Brand", "Code", "Type", "Name", "Color", "QTY", "Price"];
    else if (currentTab === "old_stock") headers = ["No.", "Type", "Detail", "Incoming", "Remaining", "Location"];

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