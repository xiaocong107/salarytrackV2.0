let workLogs = JSON.parse(localStorage.getItem('workLogs')) || [];
let monthlySummaryRecords = JSON.parse(localStorage.getItem('monthlySummaryRecords')) || []; 
let globalSelectedDate = null; 

// --- 輔助函數：安全地讀取數字輸入框的值 ---
function getNumericValue(id) {
    const element = document.getElementById(id);
    // 檢查元素是否存在，且值不為空字串，然後解析。否則返回 0。
    return (element && element.value !== '') ? parseFloat(element.value) || 0 : 0;
}


// 頁面載入時執行初始化
window.onload = function() {
    const now = new Date();
    
    // 1. 初始化時薪和扣款金額 (從 storage 讀取並設置到輸入框)
    document.getElementById('hourlyRate').value = localStorage.getItem('hourlyRate') || '183';
    document.getElementById('insuranceDeduction').value = localStorage.getItem('insuranceDeduction') || '1000';
    document.getElementById('workHoursInput').value = 0; // 重置工時輸入
    document.getElementById('workMinutesInput').value = 0;

    // 2. 設定月份追蹤器
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('monthTracker').value = currentMonth;
    
    // 3. 集中綁定所有事件
    bindEvents();

    // 4. 初始化顯示
    renderAll();
    renderHistoryPage(); 
    
    // 5. 預設隱藏編輯區
    document.getElementById('editPanel').style.display = 'none';
};


/**
 * 集中綁定所有事件監聽器
 */
function bindEvents() {
    // 設定變動
    document.getElementById('hourlyRate').addEventListener('change', updateSettings);
    document.getElementById('insuranceDeduction').addEventListener('change', updateSettings);

    // 月份導航
    document.getElementById('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => changeMonth(1));

    // 編輯按鈕
    document.getElementById('saveWorkBtn').addEventListener('click', () => saveDailyLog('工時'));
    document.getElementById('saveOffBtn').addEventListener('click', () => saveDailyLog('排休'));
    document.getElementById('saveLeaveBtn').addEventListener('click', () => saveDailyLog('請假'));
    document.getElementById('clearDayBtn').addEventListener('click', clearDailyLog);

    // 歷史紀錄按鈕
    document.getElementById('saveMonthlySummaryBtn').addEventListener('click', saveCurrentMonthSummary);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearAllHistory);
}

/**
 * 監聽設定區的變動，將數據存入 localStorage，並重新渲染頁面。
 */
function updateSettings() {
    localStorage.setItem('hourlyRate', document.getElementById('hourlyRate').value);
    localStorage.setItem('insuranceDeduction', document.getElementById('insuranceDeduction').value);
    renderAll();
}

/**
 * 核心渲染函數：處理篩選、渲染日曆和總結。
 */
function renderAll() {
    const selectedMonth = document.getElementById('monthTracker').value;
    if (!selectedMonth) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    
    // *** 修正點：確保頂部標題隨著月份變更而更新 ***
    document.getElementById('currentMonthTitle').textContent = `${year}年${month}月`;

    const filteredLogs = workLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate.getFullYear() === year && (logDate.getMonth() + 1) === month;
    });

    updateSummary(filteredLogs);   
    renderCalendar(year, month, filteredLogs); 
    saveLogs();
}

/**
 * 處理月份切換的邏輯。
 */
function changeMonth(delta) {
    const monthTrackerInput = document.getElementById('monthTracker');
    const currentMonthValue = monthTrackerInput.value; 

    const [year, month] = currentMonthValue.split('-').map(Number);
    const date = new Date(year, month - 1, 1); 

    date.setMonth(date.getMonth() + delta);

    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    
    const newMonthValue = `${newYear}-${newMonth}`;

    monthTrackerInput.value = newMonthValue;
    renderAll();
    
    document.getElementById('editPanel').style.display = 'none';
}


/**
 * 點擊日期方塊時觸發的函數 (使用數字輸入框)
 */
function selectDate(date) {
    globalSelectedDate = date;
    const editPanel = document.getElementById('editPanel');
    
    document.getElementById('selectedDateTitle').textContent = date;
    editPanel.style.display = 'block';

    // 移除所有日期選擇樣式並選中當前日期
    document.querySelectorAll('.calendar-day').forEach(cell => cell.classList.remove('selected'));
    document.querySelector(`.calendar-day[data-date="${date}"]`).classList.add('selected');

    // 查找並顯示當前紀錄狀態
    const log = workLogs.find(l => l.date === date);
    const infoDisplay = document.getElementById('currentLogInfo');

    let defaultHours = 0;
    let defaultMinutes = 0;

    if (log && log.type === '工時') {
        infoDisplay.innerHTML = `✔️ 紀錄: ${log.totalHours.toFixed(1)}h | **未扣款收入**: NT$ ${log.salary.toFixed(0)}`;
        
        // 解析工時並設定輸入框初始值
        defaultHours = Math.floor(log.totalHours);
        defaultMinutes = Math.round((log.totalHours - defaultHours) * 60);

    } else if (log && (log.type === '請假' || log.type === '排休')) {
        infoDisplay.innerHTML = `⚠️ 狀態: ${log.type}`;
    } else {
        infoDisplay.innerHTML = `➕ 該日尚無紀錄。`;
    }
    
    // 關鍵同步：將數據同步到數字輸入框
    document.getElementById('workHoursInput').value = defaultHours;
    document.getElementById('workMinutesInput').value = defaultMinutes;
}

/**
 * 儲存/更新工時或請假紀錄 (使用數字輸入框)
 */
function saveDailyLog(type) {
    if (!globalSelectedDate) {
        alert("請先點擊日曆中的日期！");
        return;
    }
    
    const existingIndex = workLogs.findIndex(l => l.date === globalSelectedDate);
    let newLog;

    if (type === '工時') {
        const hourlyRate = getNumericValue('hourlyRate'); 
        const workHours = getNumericValue('workHoursInput'); 
        const workMinutes = getNumericValue('workMinutesInput');

        if (!hourlyRate) {
            alert("請先設定時薪！");
            return;
        }
        if (workHours === 0 && workMinutes === 0) {
            alert("請設定工時！");
            return;
        }

        const totalHours = workHours + (workMinutes / 60.0);
        const calculatedSalary = totalHours * hourlyRate;

        newLog = {
            date: globalSelectedDate,
            type: '工時',
            totalHours: totalHours,
            salary: calculatedSalary,
        };
    } else {
        // 請假或排休
        newLog = {
            date: globalSelectedDate,
            type: type, 
            totalHours: 0,
            salary: 0
        };
    }


    if (existingIndex !== -1) {
        workLogs[existingIndex] = newLog;
    } else {
        workLogs.push(newLog);
    }
    
    renderAll();
    selectDate(globalSelectedDate); 
}

/**
 * 清除當日工時/請假紀錄
 */
function clearDailyLog() {
    if (!globalSelectedDate) return;

    const index = workLogs.findIndex(l => l.date === globalSelectedDate);
    if (index !== -1) {
        if (confirm(`確定要清除 ${globalSelectedDate} 的紀錄嗎？`)) {
            workLogs.splice(index, 1);
            renderAll();
            selectDate(globalSelectedDate); 
        }
    } else {
        alert("該日無紀錄可清除。");
    }
}

/**
 * 更新頂部總結區塊的數據 (包含扣款計算)
 */
function updateSummary(logs) {
    let totalHoursAccumulated = logs.reduce((sum, log) => sum + log.totalHours, 0);
    let totalSalaryAccumulated = logs.reduce((sum, log) => sum + log.salary, 0);
    
    const insuranceDeduction = getNumericValue('insuranceDeduction');
    
    const netSalary = Math.max(0, totalSalaryAccumulated - insuranceDeduction);
    
    document.getElementById('totalHoursDisplay').textContent = totalHoursAccumulated.toFixed(1) + 'h';
    document.getElementById('totalSalaryDisplay').textContent = totalSalaryAccumulated.toFixed(0) + '元';
    document.getElementById('netSalaryDisplay').textContent = netSalary.toFixed(0) + '元'; 
}

// ------------------------------------------------------------------
// 歷史紀錄功能
// ------------------------------------------------------------------

/**
 * 儲存本月結算總結為歷史紀錄
 */
function saveCurrentMonthSummary() {
    const month = document.getElementById('monthTracker').value;
    const totalSalary = parseFloat(document.getElementById('totalSalaryDisplay').textContent.replace('元', '')) || 0;
    
    if (totalSalary === 0) {
        alert("本月無收入，無需儲存結算紀錄。");
        return;
    }

    const record = {
        month: month,
        hours: parseFloat(document.getElementById('totalHoursDisplay').textContent.replace('h', '')),
        gross: totalSalary,
        deduction: getNumericValue('insuranceDeduction'),
        net: parseFloat(document.getElementById('netSalaryDisplay').textContent.replace('元', '')),
        dateSaved: new Date().toLocaleDateString('zh-TW')
    };

    const existingIndex = monthlySummaryRecords.findIndex(r => r.month === month);
    if (existingIndex !== -1) {
        monthlySummaryRecords[existingIndex] = record;
        alert(`${month} 結算紀錄已更新！`);
    } else {
        monthlySummaryRecords.push(record);
        monthlySummaryRecords.sort((a, b) => (a.month < b.month) ? 1 : -1);
        alert(`${month} 結算紀錄已儲存！`);
    }

    localStorage.setItem('monthlySummaryRecords', JSON.stringify(monthlySummaryRecords));
    renderHistoryPage(); 
}

/**
 * 渲染歷史紀錄清單頁面 (月曆卡片網格)
 */
function renderHistoryPage() {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (monthlySummaryRecords.length === 0) {
        grid.innerHTML = '<p class="no-record">尚無歷史結算紀錄。請先儲存當前月份的結算。</p>';
        return;
    }

    monthlySummaryRecords.forEach((record) => {
        const [year, month] = record.month.split('-');
        
        const card = document.createElement('div');
        card.className = 'history-month-card';
        card.innerHTML = `
            <div class="card-title">${year}年${month}月</div>
            <div class="card-detail">工時: ${record.hours.toFixed(1)}h</div>
            <div class="card-detail">應領: ${record.gross.toFixed(0)}元</div>
            <div class="card-net">實拿: <strong>${record.net.toFixed(0)}元</strong></div>
        `;
        grid.appendChild(card);
    });
}

/**
 * 清除所有歷史紀錄
 */
function clearAllHistory() {
    if (confirm("警告：確定要清除所有歷史結算紀錄嗎？此操作不可逆轉！")) {
        monthlySummaryRecords = [];
        localStorage.removeItem('monthlySummaryRecords');
        renderHistoryPage();
        alert("歷史結算紀錄已清除。");
    }
}


// ------------------------------------------------------------------
// 日曆渲染
// ------------------------------------------------------------------

function renderCalendar(year, month, logs) {
    const calendarDisplay = document.getElementById('calendarDisplay');
    calendarDisplay.innerHTML = '';

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData = {};

    logs.forEach(log => {
        const day = new Date(log.date).getDate();
        if (!dailyData[day]) {
            dailyData[day] = { hours: 0, salary: 0, type: '無紀錄', logs: [] };
        }
        
        if (log.type === '工時') {
            dailyData[day].hours += log.totalHours;
            dailyData[day].salary += log.salary;
            dailyData[day].type = '工時';
        } else {
            dailyData[day].type = log.type; 
        }
    });

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); 
    
    for (let i = 0; i < firstDayOfMonth; i++) { 
         const emptyCell = document.createElement('div');
         emptyCell.className = 'calendar-day empty';
         calendarDisplay.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.setAttribute('data-date', dateString);
        dayCell.onclick = () => selectDate(dateString);
        
        const data = dailyData[day];

        dayCell.innerHTML = `<span class="day-number">${day}</span>`; 

        if (data && data.type !== '無紀錄') {
            if (data.type === '工時') {
                 dayCell.classList.add('day-work');
                 dayCell.innerHTML += `
                    <span class="day-info hour">${data.hours.toFixed(1)}h</span>
                    <span class="day-info salary">${data.salary.toFixed(0)}</span>
                `;
            } else if (data.type === '排休') {
                dayCell.classList.add('day-off');
                dayCell.innerHTML += `<span class="day-info status">${data.type}</span>`;
            } else if (data.type === '請假') {
                dayCell.classList.add('day-leave');
                dayCell.innerHTML += `<span class="day-info status">${data.type}</span>`;
            }
        }
        calendarDisplay.appendChild(dayCell);
    }
}

function saveLogs() { localStorage.setItem('workLogs', JSON.stringify(workLogs)); }