let jobs = JSON.parse(localStorage.getItem('jobs')) || []; 
let workLogs = JSON.parse(localStorage.getItem('workLogs')) || [];
let monthlySummaryRecords = JSON.parse(localStorage.getItem('monthlySummaryRecords')) || []; 
let globalSelectedDate = null; 

// --- 輔助函數：安全地讀取數字輸入框的值 ---
function getNumericValue(id) {
    const element = document.getElementById(id);
    return (element && element.value !== '') ? parseFloat(element.value) || 0 : 0;
}


// 頁面載入時執行初始化
window.onload = function() {
    const now = new Date();
    
    // 1. 初始化打工清單。如果本地沒有打工，自動創建一個預設的
    if (jobs.length === 0) {
        jobs.push({
            id: Date.now(),
            name: '預設打工',
            hourlyRate: 183,
            category: '其他'
        });
        localStorage.setItem('jobs', JSON.stringify(jobs));
    }
    
    // 2. 初始化輸入框
    document.getElementById('workHoursInput').value = 0; 
    document.getElementById('workMinutesInput').value = 0;

    // 3. 設定月份追蹤器
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('monthTracker').value = currentMonth;
    
    // 4. 渲染所有設定頁和日曆
    renderJobsList(); 
    bindEvents();
    renderAll();
    renderHistoryPage(); 
    
    // 5. 初始顯示紀錄頁
    showPage('calendarWrapper'); 
    document.getElementById('editPanel').style.display = 'none';
};


/**
 * 集中綁定所有事件監聽器
 */
function bindEvents() {
    // 導航按鈕綁定
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', () => {
            showPage(button.getAttribute('data-page'));
        });
    });

    // NEW: 打工管理按鈕
    document.getElementById('addNewJobBtn').addEventListener('click', addNewJob);

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
 * 頁面切換核心邏輯
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });

    document.getElementById(pageId).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-page') === pageId) {
            button.classList.add('active');
        }
    });
    
    if (pageId === 'historyPage') {
        renderHistoryPage();
    }
    
    document.getElementById('editPanel').style.display = 'none';
}


/**
 * 核心渲染函數：處理篩選、渲染日曆和總結。
 */
function renderAll() {
    const selectedMonth = document.getElementById('monthTracker').value;
    if (!selectedMonth) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    
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
 * 點擊日期方塊時觸發的函數
 */
function selectDate(date) {
    globalSelectedDate = date;
    const editPanel = document.getElementById('editPanel');
    const infoDisplay = document.getElementById('currentLogInfo');
    
    document.getElementById('selectedDateTitle').textContent = date;
    
    // 確保在日曆頁時才顯示編輯面板
    if (document.getElementById('calendarWrapper').classList.contains('hidden')) {
        editPanel.style.display = 'none';
    } else {
        editPanel.style.display = 'block';
    }

    document.querySelectorAll('.calendar-day').forEach(cell => cell.classList.remove('selected'));
    document.querySelector(`.calendar-day[data-date="${date}"]`).classList.add('selected');

    // 取得當日所有紀錄 (因為現在一天可以有多份工)
    const dailyLogs = workLogs.filter(l => l.date === date);

    infoDisplay.innerHTML = '';
    
    if (dailyLogs.length > 0) {
        
        infoDisplay.innerHTML = `<h4 style="margin: 0; padding-bottom: 5px;">當日總紀錄 (${dailyLogs.length}筆):</h4>` + dailyLogs.map(log => {
            const job = jobs.find(j => j.id === log.jobId) || {name: '未知打工', category: '其他'};
            const jobColor = getCategoryColor(job.category); // 使用輔助函數
            
            return `<p style="margin: 5px 0; font-size: 0.9em; border-bottom: 1px dotted #555;">
                        <strong style="color:${jobColor}">${job.name}</strong>: ${log.type === '工時' ? 
                        `${log.totalHours.toFixed(1)}h | NT$ ${log.salary.toFixed(0)}` : 
                        `狀態: ${log.type}`}
                    </p>`;
        }).join('');

    } else {
        infoDisplay.innerHTML = `➕ 該日尚無紀錄。`;
    }
    
    // 重置工時輸入框
    document.getElementById('workHoursInput').value = 0;
    document.getElementById('workMinutesInput').value = 0;
}

/**
 * 儲存/更新工時或請假紀錄
 */
function saveDailyLog(type) {
    if (!globalSelectedDate) {
        alert("請先點擊日曆中的日期！");
        return;
    }
    
    const selectedJobId = parseInt(document.getElementById('jobSelector').value);
    const selectedJob = jobs.find(j => j.id === selectedJobId);
    
    if (!selectedJob) {
        alert("請先到設定頁新增或選擇一份打工！");
        return;
    }
    
    let newLog;

    if (type === '工時') {
        const hourlyRate = selectedJob.hourlyRate; 
        const workHours = getNumericValue('workHoursInput'); 
        const workMinutes = getNumericValue('workMinutesInput');

        if (workHours === 0 && workMinutes === 0) {
            alert("請設定工時！");
            return;
        }

        const totalHours = workHours + (workMinutes / 60.0);
        const calculatedSalary = totalHours * hourlyRate;
        
        // 查找是否已經有同一天、同一打工的工時紀錄 (用於取代)
        const existingIndex = workLogs.findIndex(l => 
            l.date === globalSelectedDate && 
            l.jobId === selectedJobId &&
            l.type === '工時'
        );

        newLog = {
            date: globalSelectedDate,
            jobId: selectedJobId, 
            type: '工時',
            totalHours: totalHours,
            salary: calculatedSalary,
        };
        
        if (existingIndex !== -1) {
            // 如果存在，取代舊紀錄
            workLogs[existingIndex] = newLog;
        } else {
            // 如果不存在，新增紀錄
            workLogs.push(newLog);
        }
        
    } else {
        // 請假或排休 (這類紀錄只應該有一份，因為是針對日期本身的狀態)
        // 由於一天可以有多份工，我們允許在不同的工上設置不同的狀態，但這可能導致邏輯混亂。
        // 為簡化，我們只新增狀態紀錄。如果用戶需要刪除，請使用清除按鈕。
        
        // 檢查是否已經有同一天、同一打工的狀態紀錄，如果是，則取代
        const existingIndex = workLogs.findIndex(l => 
            l.date === globalSelectedDate && 
            l.jobId === selectedJobId &&
            (l.type === '請假' || l.type === '排休')
        );

        newLog = {
            date: globalSelectedDate,
            jobId: selectedJobId, 
            type: type, 
            totalHours: 0,
            salary: 0
        };

        if (existingIndex !== -1) {
             workLogs[existingIndex] = newLog;
        } else {
             workLogs.push(newLog);
        }
    }

    renderAll();
    selectDate(globalSelectedDate); 
}

/**
 * 清除當日工時/請假紀錄
 */
function clearDailyLog() {
    if (!globalSelectedDate) return;
    
    const selectedJobId = parseInt(document.getElementById('jobSelector').value);
    
    // 找出所有與該日和該打工相關的紀錄
    const recordsToDelete = workLogs.filter(l => l.date === globalSelectedDate && l.jobId === selectedJobId);

    if (recordsToDelete.length > 0) {
        if (confirm(`確定要清除 ${globalSelectedDate} 對應此打工的所有紀錄 (${recordsToDelete.length}筆) 嗎？`)) {
            // 過濾掉要刪除的紀錄
            workLogs = workLogs.filter(log => !(log.date === globalSelectedDate && log.jobId === selectedJobId));
            saveLogs();
            renderAll();
            selectDate(globalSelectedDate); 
        }
    } else {
        alert("該日該打工無紀錄可清除。");
    }
}


/**
 * 更新頂部總結區塊的數據
 */
function updateSummary(logs) {
    let totalHoursAccumulated = logs.reduce((sum, log) => sum + log.totalHours, 0);
    let totalSalaryAccumulated = logs.reduce((sum, log) => sum + log.salary, 0);
    
    // 由於取消了固定扣款，我們暫時假設淨收入等於總收入
    const netSalary = totalSalaryAccumulated; 
    
    document.getElementById('totalHoursDisplay').textContent = totalHoursAccumulated.toFixed(1) + 'h';
    document.getElementById('totalSalaryDisplay').textContent = totalSalaryAccumulated.toFixed(0) + '元';
    document.getElementById('netSalaryDisplay').textContent = netSalary.toFixed(0) + '元'; 
}

// ------------------------------------------------------------------
// 設定頁 打工管理功能 (已補回)
// ------------------------------------------------------------------

/**
 * 將打工清單渲染到設定頁和選擇下拉選單
 */
function renderJobsList() {
    const listContainer = document.getElementById('jobsListContainer');
    const selector = document.getElementById('jobSelector');
    if (!listContainer || !selector) return;

    listContainer.innerHTML = '';
    selector.innerHTML = '';

    jobs.forEach(job => {
        // 渲染設定頁卡片
        const card = document.createElement('div');
        card.className = 'job-card';
        card.setAttribute('data-job-id', job.id);
        
        const categoryColor = getCategoryColor(job.category);
        card.style.borderLeftColor = categoryColor;

        card.innerHTML = `
            <div class="job-info">
                <span class="job-name">${job.name}</span>
                <span class="job-rate">時薪: NT$ ${job.hourlyRate}</span>
                <span class="job-category">類別: ${job.category}</span>
            </div>
            <button class="btn-clear delete-job-btn" onclick="deleteJob(${job.id})">刪除</button>
        `;
        listContainer.appendChild(card);

        // 渲染日曆編輯區的下拉選單
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = `${job.name} (NT$ ${job.hourlyRate}/hr)`;
        selector.appendChild(option);
    });
    
    // 如果沒有工作，禁用儲存按鈕，並提示用戶
    if (jobs.length === 0) {
        selector.innerHTML = '<option value="0">請先在設定頁新增打工</option>';
        document.getElementById('saveWorkBtn').disabled = true;
    } else {
        document.getElementById('saveWorkBtn').disabled = false;
    }
}

/**
 * 新增一份打工
 */
function addNewJob() {
    const name = document.getElementById('newJobName').value.trim();
    const rate = getNumericValue('newJobHourlyRate');
    const category = document.getElementById('newJobCategory').value;

    if (!name || rate <= 0) {
        alert("請輸入有效的打工名稱和時薪！");
        return;
    }

    const newJob = {
        id: Date.now(),
        name: name,
        hourlyRate: rate,
        category: category
    };

    jobs.push(newJob);
    localStorage.setItem('jobs', JSON.stringify(jobs));

    // 清空輸入框
    document.getElementById('newJobName').value = '';
    document.getElementById('newJobHourlyRate').value = 183;
    
    renderJobsList(); 
    alert(`打工 "${name}" 已新增！`);
}

/**
 * 刪除一份打工
 */
function deleteJob(jobId) {
    if (jobs.length === 1) {
        alert("這是您的最後一份打工，無法刪除！請新增一份新的後再刪除。");
        return;
    }
    
    const jobToDelete = jobs.find(j => j.id === jobId);
    
    if (confirm(`警告：確定要刪除打工 "${jobToDelete.name}" 嗎？所有相關的日曆紀錄將會保留，但可能會顯示為「未知打工」。`)) {
        jobs = jobs.filter(j => j.id !== jobId);
        localStorage.setItem('jobs', JSON.stringify(jobs));
        // 同時清理掉 workLogs 中那些被刪除 job 的工時紀錄，避免累積無用數據
        workLogs = workLogs.filter(log => log.jobId !== jobId);
        saveLogs(); 
        renderJobsList();
        renderAll(); // 重新渲染日曆
    }
}

/**
 * 輔助函數：根據類別獲取顏色 (用於卡片左側條)
 */
function getCategoryColor(category) {
    // 確保這裡的顏色定義與 CSS 中的顏色變數相符或相近
    switch(category) {
        case '餐飲': return '#ffcc80';
        case '服務': return '#03dac6';
        case '行政': return '#cf6679';
        default: return '#6200ee'; 
    }
}


// ------------------------------------------------------------------
// 歷史紀錄功能
// ------------------------------------------------------------------

/**
 * 儲存本月結算總結為歷史紀錄
 */
function saveCurrentMonthSummary() {
    // NEW: 結算時從輸入框讀取扣款金額
    const deduction = getNumericValue('deductionInput');
    
    const month = document.getElementById('monthTracker').value;
    const totalHours = parseFloat(document.getElementById('totalHoursDisplay').textContent.replace('h', '')) || 0;
    const totalSalary = parseFloat(document.getElementById('totalSalaryDisplay').textContent.replace('元', '')) || 0;
    
    if (totalSalary === 0) {
        alert("本月無收入，無需儲存結算紀錄。");
        return;
    }
    
    const netSalaryFinal = Math.max(0, totalSalary - deduction);

    // 找出本月的所有打工紀錄，並整理出詳細資訊
    const currentMonthLogs = workLogs.filter(log => log.date.startsWith(month));
    const jobSummaries = {};
    
    currentMonthLogs.forEach(log => {
        const job = jobs.find(j => j.id === log.jobId);
        const jobName = job ? job.name : '未知打工';
        
        if (!jobSummaries[jobName]) {
            jobSummaries[jobName] = { hours: 0, salary: 0, typeCounts: {} };
        }
        
        jobSummaries[jobName].hours += log.totalHours;
        jobSummaries[jobName].salary += log.salary;
        jobSummaries[jobName].typeCounts[log.type] = (jobSummaries[jobName].typeCounts[log.type] || 0) + 1;
    });

    const jobDetails = Object.keys(jobSummaries).map(name => ({
        name: name,
        hours: jobSummaries[name].hours.toFixed(1),
        salary: jobSummaries[name].salary.toFixed(0),
        status: Object.keys(jobSummaries[name].typeCounts).join('/')
    }));


    const record = {
        month: month,
        hours: totalHours,
        gross: totalSalary,
        deduction: deduction, // NEW: 儲存本次結算時的扣款金額
        net: netSalaryFinal,
        jobDetails: jobDetails, 
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
    
    // 儲存後清空扣款輸入框
    document.getElementById('deductionInput').value = 0;
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
        
        // 生成打工詳細資訊列表
        const detailsHtml = record.jobDetails.map(detail => 
            `<div class="job-summary-line">
                <span class="job-name-sm">【${detail.name}】</span>
                <span>${detail.hours}h / ${detail.salary}元</span>
            </div>`
        ).join('');
        
        const card = document.createElement('div');
        card.className = 'history-month-card';
        card.innerHTML = `
            <div class="card-title">${year}年${month}月 (扣款: ${record.deduction}元)</div>
            <div class="card-detail">總工時: ${record.hours.toFixed(1)}h | 總應領: ${record.gross.toFixed(0)}元</div>
            <div class="job-details-section">${detailsHtml}</div>
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
// 日曆渲染 (Calendar Grid Logic)
// ------------------------------------------------------------------

function renderCalendar(year, month, logs) {
    const calendarDisplay = document.getElementById('calendarDisplay');
    calendarDisplay.innerHTML = '';

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData = {};

    logs.forEach(log => {
        const day = new Date(log.date).getDate();
        if (!dailyData[day]) {
            dailyData[day] = { hours: 0, salary: 0, hasWork: false, hasLeave: false, hasOff: false };
        }
        
        if (log.type === '工時') {
            dailyData[day].hours += log.totalHours;
            dailyData[day].salary += log.salary;
            dailyData[day].hasWork = true;
        } else if (log.type === '排休') {
            dailyData[day].hasOff = true;
        } else if (log.type === '請假') {
            dailyData[day].hasLeave = true;
        }
    });

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sunday, 1=Monday...
    
    // 填充空白日期 (Padding)
    for (let i = 0; i < firstDayOfMonth; i++) { 
         const emptyCell = document.createElement('div');
         emptyCell.className = 'calendar-day empty';
         calendarDisplay.appendChild(emptyCell);
    }
    
    // 渲染實際日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.setAttribute('data-date', dateString);
        dayCell.onclick = () => selectDate(dateString);
        
        const data = dailyData[day];

        dayCell.innerHTML = `<span class="day-number">${day}</span>`; 

        if (data && (data.hasWork || data.hasLeave || data.hasOff)) {
             // 優先顯示工時，然後請假，最後排休 (透過不同的背景顏色區分)
            if (data.hasWork) {
                 dayCell.classList.add('day-work');
                 dayCell.innerHTML += `
                    <span class="day-info hour">${data.hours.toFixed(1)}h</span>
                    <span class="day-info salary">${data.salary.toFixed(0)}</span>
                `;
            } else if (data.hasLeave) {
                dayCell.classList.add('day-leave');
                dayCell.innerHTML += `<span class="day-info status">請假</span>`;
            } else if (data.hasOff) {
                dayCell.classList.add('day-off');
                dayCell.innerHTML += `<span class="day-info status">排休</span>`;
            }
        }
        calendarDisplay.appendChild(dayCell);
    }
}

function saveLogs() { localStorage.setItem('workLogs', JSON.stringify(workLogs)); }
