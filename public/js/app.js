class AirdropTracker {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.monthlyData = {};
        this.selectedDate = null;
        this.monthsToRender = 6; // 预渲染的月份数量减少，避免过度加载
        this.currentOffset = 0; // 当前偏移量
        this.isLoading = false; // 是否正在加载数据
        this.isNavigating = false; // 是否正在切换年份
        this.scrollContainer = null;
        this.slider = null;
        this.currentVisibleMonth = null; // 当前可见的月份
        this.lastScrollTop = 0;
        this.scrollTimeout = null;
        
        this.init();
    }

    async init() {
        this.scrollContainer = document.getElementById('calendarScrollContainer');
        this.slider = document.getElementById('calendarSlider');
        
        this.bindEvents();
        
        try {
            this.showLoading(true);
            await this.loadAllYearData(); // 一次性加载当前年份所有月份数据
            this.updateMonthlyStats();
            await this.renderCalendarSlider();
            this.scrollToToday();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showToast('初始化失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    bindEvents() {
        // 年份导航按钮事件（左箭头切换到上一年，右箭头切换到下一年）
        document.getElementById('prevMonth').addEventListener('click', async () => {
            await this.navigateToYear(-1);
        });

        document.getElementById('nextMonth').addEventListener('click', async () => {
            await this.navigateToYear(1);
        });

        // 回到今天按钮事件
        document.getElementById('todayButton').addEventListener('click', () => {
            this.scrollToToday();
        });

        // 登出按钮事件
        document.getElementById('logoutButton').addEventListener('click', async () => {
            if (confirm('确定要登出吗？')) {
                try {
                    const response = await fetch('/api/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        window.location.href = '/login.html';
                    }
                } catch (error) {
                    console.error('登出失败:', error);
                    alert('登出失败，请重试');
                }
            }
        });

        // 模态框事件
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeRecordModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeRecordModal();
        });

        // 点击模态框背景关闭
        document.getElementById('recordModal').addEventListener('click', (e) => {
            if (e.target.id === 'recordModal') {
                this.closeRecordModal();
            }
        });

        // 表单提交
        document.getElementById('recordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRecord();
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeRecordModal();
            }
        });

        // 滚动事件处理 - 使用节流来优化性能
        this.scrollContainer.addEventListener('scroll', () => {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.handleScroll();
                this.updateCurrentVisibleMonth();
            }, 100);
        });
        
        // 统计切换按钮事件
        const statsToggleBtn = document.getElementById('statsToggleBtn');
        const monthlyStats = document.getElementById('monthlyStats');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (statsToggleBtn) {
            statsToggleBtn.addEventListener('click', () => {
                monthlyStats.classList.toggle('collapsed');
                toggleIcon.classList.toggle('rotated');
            });
        }
        
        // 触摸事件已移除，使用纯滚动代替，避免手机上自动弹回
        
        // 禁止复制、粘贴和选择
        document.addEventListener('copy', (e) => e.preventDefault());
        document.addEventListener('cut', (e) => e.preventDefault());
        document.addEventListener('paste', (e) => e.preventDefault());
        document.addEventListener('selectstart', (e) => e.preventDefault());
        
        // 禁止双击放大（移动端）
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }
    
    // 处理滚动事件，实现无限滚动（仅当前年份）
    async handleScroll() {
        if (this.isLoading) return;
        
        const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer;
        
        // 接近底部时，检查是否还能继续加载（不超过当前年份12月）
        if (scrollTop + clientHeight > scrollHeight - clientHeight * 1) {
            const lastMonth = document.querySelector('.calendar-grid:last-child');
            if (lastMonth) {
                const lastYear = parseInt(lastMonth.dataset.year);
                const lastMonthNum = parseInt(lastMonth.dataset.month);
                
                // 只有在当前年份且未到12月时才加载更多
                if (lastYear === this.currentYear && lastMonthNum < 11) {
                    this.isLoading = true;
                    this.monthsToRender = 2;
                    this.currentOffset = lastMonthNum + 1;
                    await this.renderMoreMonths();
                    this.isLoading = false;
                }
            }
        }
    }
    
    // 更新当前可见的月份并更新顶部显示
    updateCurrentVisibleMonth() {
        const monthElements = document.querySelectorAll('.calendar-grid');
        const containerTop = 0;
        const containerMiddle = this.scrollContainer.clientHeight / 2;
        
        for (const monthEl of monthElements) {
            const rect = monthEl.getBoundingClientRect();
            const monthTop = rect.top - this.scrollContainer.getBoundingClientRect().top;
            const monthHeight = rect.height;
            
            // 检查月份是否在视图中间区域
            if (monthTop <= containerMiddle && monthTop + monthHeight > containerMiddle) {
                const year = parseInt(monthEl.dataset.year);
                const month = parseInt(monthEl.dataset.month);
                
                // 只有当月份发生变化时才更新显示和加载数据
                if (!this.currentVisibleMonth || 
                    this.currentVisibleMonth.year !== year || 
                    this.currentVisibleMonth.month !== month) {
                    
                    this.currentVisibleMonth = { year, month };
                    this.updateMonthYearDisplay(year, month);
                    
                    // 加载当前可见月份的数据
                    this.loadMonthData(year, month);
                    
                    // 更新月度统计（根据当前可见月份）
                    this.updateMonthlyStats(year, month);
                }
                break;
            }
        }
    }
    
    // 更新顶部的年月显示
    updateMonthYearDisplay(year, month) {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                           '7月', '8月', '9月', '10月', '11月', '12月'];
        
        const displayElement = document.getElementById('currentMonthYear');
        if (displayElement) {
            displayElement.textContent = `${year}年${monthNames[month]}`;
        }
    }
    
    // 导航到指定月份
    navigateToMonth(direction) {
        const monthHeight = this.calculateMonthHeight();
        this.scrollContainer.scrollBy({ top: -direction * monthHeight, behavior: 'smooth' });
    }
    
    // 导航到指定年份
    async navigateToYear(direction) {
        // 防止重复点击
        if (this.isNavigating) {
            console.log('正在切换年份，请稍候...');
            return;
        }
        
        try {
            this.isNavigating = true;
            this.showLoading(true);
            
            // 更新年份
            this.currentYear += direction;
            this.currentMonth = 0; // 切换年份后默认显示1月
            
            console.log(`切换到年份: ${this.currentYear}`);
            
            // 清空现有数据
            this.monthlyData = {};
            
            // 重新加载该年份的数据
            await this.loadAllYearData();
            
            console.log('数据加载完成，准备渲染日历');
            
            // 重新渲染日历
            await this.renderCalendarSlider();
            
            console.log('日历渲染完成');
            
            // 立即更新顶部年月显示
            this.updateMonthYearDisplay(this.currentYear, this.currentMonth);
            
            // 更新当前可见月份
            this.currentVisibleMonth = { year: this.currentYear, month: this.currentMonth };
            
            // 滚动到该年份的第一个月
            setTimeout(() => {
                this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                console.log('滚动到顶部');
            }, 100);
            
            // 更新统计
            this.updateMonthlyStats(this.currentYear, 0);
            
            console.log('年份切换完成');
        } catch (error) {
            console.error('切换年份失败:', error);
            this.showToast('切换年份失败', 'error');
        } finally {
            this.showLoading(false);
            this.isNavigating = false;
        }
    }
    
    // 滚动到今天的日期
    scrollToToday() {
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.currentOffset = 0;
        
        this.renderCalendarSlider().then(() => {
            setTimeout(() => {
                const todayElement = document.querySelector('.calendar-day.today');
                if (todayElement) {
                    const monthElement = todayElement.closest('.calendar-grid');
                    const monthTop = monthElement.offsetTop;
                    const monthHeight = monthElement.offsetHeight;
                    const containerHeight = this.scrollContainer.clientHeight;
                    
                    // 将今天所在的月份日历居中显示在容器中
                    this.scrollContainer.scrollTo({
                        top: monthTop + (monthHeight / 2) - (containerHeight / 1.5),
                        behavior: 'smooth'
                    });
                }
            }, 100);
        });
    }
    
    // 计算一个月日历的高度
    calculateMonthHeight() {
        const monthElement = document.querySelector('.calendar-grid');
        return monthElement ? monthElement.offsetHeight : 500; // 默认高度
    }

    // 一次性加载当前年份所有月份数据
    async loadAllYearData() {
        try {
            const currentYear = this.currentYear;
            const currentMonth = this.currentMonth;
            
            // 加载当前年份所有12个月的数据
            const promises = [];
            for (let month = 0; month < 12; month++) {
                promises.push(this.loadMonthData(currentYear, month));
            }
            
            // 如果当前月份靠后，也加载去年最后几个月的数据（最多3个月）
            const today = new Date();
            const threeMonthsAgo = new Date(today);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            
            if (threeMonthsAgo.getFullYear() < currentYear) {
                const lastYear = currentYear - 1;
                const startMonth = threeMonthsAgo.getMonth();
                for (let month = startMonth; month < 12; month++) {
                    promises.push(this.loadMonthData(lastYear, month));
                }
            }
            
            await Promise.all(promises);
        } catch (error) {
            console.error('加载年度数据失败:', error);
            this.showToast('加载数据失败', 'error');
        }
    }

    async loadCurrentMonth() {
        try {
            await this.loadMonthData(this.currentYear, this.currentMonth);
        } catch (error) {
            console.error('加载月度数据失败:', error);
            this.showToast('加载数据失败', 'error');
        }
    }
    
    // 加载指定月份的数据
    async loadMonthData(year, month) {
        try {
            // 获取指定月份的数据
            const response = await fetch(`/api/stats/${year}/${month + 1}`);
            const result = await response.json();
            
            if (result.success) {
                // 只更新当前月份的数据，不覆盖其他月份
                const monthKey = `${year}-${month}`;
                
                // 初始化该月份的数据对象
                if (!this.monthlyData[monthKey]) {
                    this.monthlyData[monthKey] = {};
                }
                
                // 更新数据
                result.data.forEach(record => {
                    const date = new Date(record.date).getDate();
                    this.monthlyData[monthKey][date] = record;
                });
                
                // 如果是当前显示的月份，更新统计
                if (year === this.currentYear && month === this.currentMonth) {
                    this.updateMonthlyStats();
                }
                
                // 刷新该月份的显示
                this.updateMonthDisplay(year, month);
            }
            
            // 获取15天内的额外数据
            await this.loadFifteenDayData();
        } catch (error) {
            console.error(`加载${year}年${month + 1}月数据失败:`, error);
        }
    }
    
    // 更新指定月份的显示
    updateMonthDisplay(year, month) {
        const monthElement = document.querySelector(`[data-year="${year}"][data-month="${month}"]`);
        if (monthElement) {
            const dayElements = monthElement.querySelectorAll('.calendar-day');
            const monthKey = `${year}-${month}`;
            const monthData = this.monthlyData[monthKey] || {};
            
            dayElements.forEach(dayElement => {
                const dateStr = dayElement.dataset.date;
                if (dateStr) {
                    const date = new Date(dateStr);
                    const day = date.getDate();
                    
                    // 移除现有的统计信息
                    const existingStats = dayElement.querySelector('.day-stats');
                    if (existingStats) {
                        existingStats.remove();
                    }
                    
                    // 如果有该日期的数据，添加统计信息（优化：固定3行，去掉名称，单位改为U）
                    if (monthData[day]) {
                        const record = monthData[day];
                        const statsDiv = document.createElement('div');
                        statsDiv.className = 'day-stats';

                        // 收入（绿色）
                        const incomeDiv = document.createElement('div');
                        incomeDiv.className = 'stat-item stat-income';
                        incomeDiv.textContent = record.income > 0 ? `${parseFloat(record.income).toFixed(2)}U` : '-';
                        statsDiv.appendChild(incomeDiv);

                        // 损耗（红色）
                        const lossDiv = document.createElement('div');
                        lossDiv.className = 'stat-item stat-loss';
                        lossDiv.textContent = record.loss > 0 ? `${parseFloat(record.loss).toFixed(2)}U` : '-';
                        statsDiv.appendChild(lossDiv);

                        // 净积分（蓝色）
                        const netDiv = document.createElement('div');
                        netDiv.className = 'stat-item stat-net';
                        netDiv.textContent = `${record.net_points || 0}`;
                        statsDiv.appendChild(netDiv);

                        dayElement.appendChild(statsDiv);
                    }
                }
            });
        }
    }

    async loadFifteenDayData() {
        try {
            // 获取15天前的日期
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            const fifteenDaysAgoStr = this.formatDate(fifteenDaysAgo);
            
            // 获取今天
            const today = new Date();
            const todayStr = this.formatDate(today);
            
            // 如果15天前不在当前月份，需要额外获取数据
            const fifteenDaysAgoMonth = fifteenDaysAgo.getMonth();
            const fifteenDaysAgoYear = fifteenDaysAgo.getFullYear();
            const fifteenDaysAgoKey = `${fifteenDaysAgoYear}-${fifteenDaysAgoMonth}`;
            
            if (fifteenDaysAgoMonth !== this.currentMonth || fifteenDaysAgoYear !== this.currentYear) {
                const response = await fetch(`/api/stats/${fifteenDaysAgoYear}/${fifteenDaysAgoMonth + 1}`);
                const result = await response.json();
                
                if (result.success) {
                    // 初始化该月份的数据对象
                    if (!this.monthlyData[fifteenDaysAgoKey]) {
                        this.monthlyData[fifteenDaysAgoKey] = {};
                    }
                    
                    result.data.forEach(record => {
                        if (record.date >= fifteenDaysAgoStr && record.date <= todayStr) {
                            const date = new Date(record.date).getDate();
                            this.monthlyData[fifteenDaysAgoKey][date] = record;
                        }
                    });
                    
                    // 更新该月份的显示
                    this.updateMonthDisplay(fifteenDaysAgoYear, fifteenDaysAgoMonth);
                }
            }
        } catch (error) {
            console.error('加载15天数据失败:', error);
        }
    }
    
    // 更新月度统计（根据指定月份或当前可见月份）
    updateMonthlyStats(year = null, month = null) {
        // 如果没有指定年月，使用当前可见月份或默认当前月份
        const targetYear = year !== null ? year : (this.currentVisibleMonth ? this.currentVisibleMonth.year : this.currentYear);
        const targetMonth = month !== null ? month : (this.currentVisibleMonth ? this.currentVisibleMonth.month : this.currentMonth);
        
        let totalIncome = 0;
        let totalLoss = 0;
        let totalNet = 0;
        let fifteenDayNet = 0;

        // 获取15天前的日期
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const fifteenDaysAgoStr = this.formatDate(fifteenDaysAgo);
        
        // 统计指定月份的数据
        const targetMonthKey = `${targetYear}-${targetMonth}`;
        const targetMonthData = this.monthlyData[targetMonthKey] || {};

        Object.values(targetMonthData).forEach(record => {
            totalIncome += parseFloat(record.income || 0);
            totalLoss += parseFloat(record.loss || 0);
            totalNet += parseInt(record.net_points || 0);
        });
        
        // 计算15天内的净积分（跨月份统计）
        const allData = [];
        Object.keys(this.monthlyData).forEach(monthKey => {
            Object.values(this.monthlyData[monthKey]).forEach(record => {
                if (record.date >= fifteenDaysAgoStr) {
                    fifteenDayNet += parseInt(record.net_points || 0);
                }
            });
        });

        // 更新UI显示
        if (document.getElementById('monthlyIncome')) {
            document.getElementById('monthlyIncome').textContent = totalIncome.toFixed(2) + ' USDT';
        }
        if (document.getElementById('monthlyLoss')) {
            document.getElementById('monthlyLoss').textContent = totalLoss.toFixed(2) + ' USDT';
        }
        if (document.getElementById('monthlyNet')) {
            document.getElementById('monthlyNet').textContent = totalNet;
        }
        if (document.getElementById('fifteenDayNet')) {
            document.getElementById('fifteenDayNet').textContent = fifteenDayNet;
        }
    }

    async renderCalendarSlider() {
        // 清空现有内容
        this.slider.innerHTML = '';
        
        // 只渲染当前年份的1月到12月
        const currentYear = this.currentYear;
        for (let month = 0; month < 12; month++) {
            const monthElement = this.createMonthElement(currentYear, month);
            this.slider.appendChild(monthElement);
        }
    }
    
    // 新增方法：动态加载更多月份（仅用于向下滚动）
    async renderMoreMonths() {
        const lastMonth = document.querySelector('.calendar-grid:last-child');
        if (!lastMonth) return;
        
        const lastYear = parseInt(lastMonth.dataset.year);
        const lastMonthNum = parseInt(lastMonth.dataset.month);
        
        // 只在当前年份内添加
        if (lastYear === this.currentYear && lastMonthNum < 11) {
            for (let i = 1; i <= this.monthsToRender && lastMonthNum + i < 12; i++) {
                const existingMonth = document.querySelector(`[data-year="${lastYear}"][data-month="${lastMonthNum + i}"]`);
                if (!existingMonth) {
                    const monthElement = this.createMonthElement(lastYear, lastMonthNum + i);
                    this.slider.appendChild(monthElement);
                }
            }
        }
    }
    
    createMonthElement(year, month) {
        const monthElement = document.createElement('div');
        monthElement.className = 'calendar-grid';
        monthElement.dataset.year = year;
        monthElement.dataset.month = month;
        
        // 星期标题行
        const weekdayHeader = document.createElement('div');
        weekdayHeader.className = 'weekday-header';
        
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            const weekdayEl = document.createElement('div');
            weekdayEl.className = 'weekday';
            weekdayEl.textContent = day;
            weekdayHeader.appendChild(weekdayEl);
        });
        
        monthElement.appendChild(weekdayHeader);
        
        // 日期网格
        const calendarBody = document.createElement('div');
        calendarBody.className = 'calendar-body';
        
        // 获取月份的第一天和最后一天
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 获取第一天是星期几
        const firstDayOfWeek = firstDay.getDay();
        
        // 只生成当月的天数，前面用空白格子填充
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty-day';
            calendarBody.appendChild(emptyCell);
        }
        
        // 生成当月的天数
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dayElement = this.createDayElement(date, year, month);
            calendarBody.appendChild(dayElement);
        }
        
        monthElement.appendChild(calendarBody);
        
        return monthElement;
    }

    createDayElement(date, year, month) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.dataset.date = date.toISOString();
        
        const isCurrentMonth = date.getMonth() === month;
        const isToday = this.isToday(date);
        const currentDate = new Date();
        const isFuture = date > currentDate;
        
        // 确保只有当前月的日期才会被显示（非空白）
        if (!isCurrentMonth) {
            dayDiv.classList.add('empty-day');
            return dayDiv;
        }
        
        if (isToday) {
            dayDiv.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayDiv.appendChild(dayNumber);

        // 添加统计数据（优化：固定3行，去掉名称，单位改为U）
        const monthKey = `${year}-${month}`;
        const monthData = this.monthlyData[monthKey] || {};
        
        if (isCurrentMonth && !isFuture && monthData[date.getDate()]) {
            const record = monthData[date.getDate()];
            const statsDiv = document.createElement('div');
            statsDiv.className = 'day-stats';

            // 收入（绿色）
            const incomeDiv = document.createElement('div');
            incomeDiv.className = 'stat-item stat-income';
            incomeDiv.textContent = record.income > 0 ? `${parseFloat(record.income).toFixed(2)}U` : '-';
            statsDiv.appendChild(incomeDiv);

            // 损耗（红色）
            const lossDiv = document.createElement('div');
            lossDiv.className = 'stat-item stat-loss';
            lossDiv.textContent = record.loss > 0 ? `${parseFloat(record.loss).toFixed(2)}U` : '-';
            statsDiv.appendChild(lossDiv);

            // 净积分（蓝色）
            const netDiv = document.createElement('div');
            netDiv.className = 'stat-item stat-net';
            netDiv.textContent = `${record.net_points || 0}`;
            statsDiv.appendChild(netDiv);

            dayDiv.appendChild(statsDiv);
        }

        // 点击和长按事件 - 只允许点击当前月份的日期
        if (isCurrentMonth && !isFuture) {
            let pressTimer = null;
            
            // 触摸开始
            dayDiv.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    // 长按触发删除确认
                    if (monthData[date.getDate()]) {
                        this.confirmDeleteRecord(date);
                    }
                }, 500); // 500ms为长按时间
            });
            
            // 触摸结束
            dayDiv.addEventListener('touchend', (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            });
            
            // 触摸取消
            dayDiv.addEventListener('touchcancel', (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            });
            
            // 点击事件（编辑）
            dayDiv.addEventListener('click', () => {
                this.selectedDate = date;
                this.openRecordModal(date);
            });
            dayDiv.style.cursor = 'pointer';
        }

        return dayDiv;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    openRecordModal(date = null) {
        const modal = document.getElementById('recordModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('recordForm');
        const dateInput = document.getElementById('recordDate');

        // 设置日期 - 使用中国北京时间
        if (date) {
            dateInput.value = this.formatDate(date);
            modalTitle.textContent = `编辑 ${this.formatDate(date)} 的记录`;
        } else {
            // 获取中国北京时间
            const beijingDate = this.getBeijingTime();
            
            if (beijingDate && beijingDate !== 'Invalid Date') {
                // 使用 setTimeout 确保 DOM 更新完成后再设置值
                setTimeout(() => {
                    dateInput.value = beijingDate;
                }, 10);
            } else {
                // 备用方案：使用当前本地时间
                const today = new Date();
                const fallbackDate = this.formatDate(today);
                setTimeout(() => {
                    dateInput.value = fallbackDate;
                }, 10);
            }
            
            modalTitle.textContent = '添加今日交易记录';
        }

        // 如果是编辑模式，加载现有数据
        if (date) {
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthKey = `${year}-${month}`;
            const monthData = this.monthlyData[monthKey] || {};
            
            if (monthData[date.getDate()]) {
                this.loadRecordData(monthData[date.getDate()]);
            } else {
                // 只重置非日期字段
                document.getElementById('volume').value = '';
                document.getElementById('pointsBalance').value = 2;
                document.getElementById('pointsTrading').value = 0;
                document.getElementById('pointsConsumed').value = 0;
                document.getElementById('loss').value = '';
                document.getElementById('income').value = '';
            }
        } else {
            // 只重置非日期字段
            document.getElementById('volume').value = '';
            document.getElementById('pointsBalance').value = 2;
            document.getElementById('pointsTrading').value = 0;
            document.getElementById('pointsConsumed').value = 0;
            document.getElementById('loss').value = '';
            document.getElementById('income').value = '';
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeRecordModal() {
        const modal = document.getElementById('recordModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        this.resetForm();
    }

    resetForm() {
        const form = document.getElementById('recordForm');
        const dateValue = document.getElementById('recordDate').value; // 保存日期值
        
        form.reset();
        
        // 恢复日期值
        if (dateValue) {
            document.getElementById('recordDate').value = dateValue;
        }
        
        document.getElementById('pointsBalance').value = 2;
        document.getElementById('pointsTrading').value = 0;
        document.getElementById('pointsConsumed').value = 0;
    }

    loadRecordData(record) {
        document.getElementById('volume').value = record.volume ? parseFloat(record.volume).toFixed(2) : '';
        document.getElementById('pointsBalance').value = record.points_balance || 2;
        document.getElementById('pointsTrading').value = record.points_trading || 0;
        document.getElementById('pointsConsumed').value = record.points_consumed || 0;
        document.getElementById('loss').value = record.loss ? parseFloat(record.loss).toFixed(2) : '';
        document.getElementById('income').value = record.income ? parseFloat(record.income).toFixed(2) : '';
    }

    async saveRecord() {
        try {
            this.showLoading(true);
            
            const formData = new FormData(document.getElementById('recordForm'));
            const recordData = {
                date: formData.get('date'),
                volume: parseFloat(formData.get('volume')) || 0,
                points_balance: parseInt(formData.get('points_balance')) || 2,
                points_trading: parseInt(formData.get('points_trading')) || 0,
                points_consumed: parseInt(formData.get('points_consumed')) || 0,
                loss: parseFloat(formData.get('loss')) || 0,
                income: parseFloat(formData.get('income')) || 0
            };

            const response = await fetch('/api/records', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(recordData)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('记录保存成功', 'success');
                this.closeRecordModal();
                
                // 重新加载当前月份数据并更新统计
                await this.loadCurrentMonth();
                
                // 如果保存的记录不在当前月，还需要加载对应月份的数据
                const savedDate = new Date(recordData.date);
                const savedYear = savedDate.getFullYear();
                const savedMonth = savedDate.getMonth();
                
                if (savedYear !== this.currentYear || savedMonth !== this.currentMonth) {
                    await this.loadMonthData(savedYear, savedMonth);
                }
            } else {
                this.showToast(result.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存记录失败:', error);
            this.showToast('保存失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 确认删除记录
    confirmDeleteRecord(date) {
        const dateStr = this.formatDate(date);
        const confirmed = confirm(`确定要删除 ${dateStr} 的交易记录吗？`);
        
        if (confirmed) {
            this.deleteRecord(dateStr);
        }
    }
    
    // 删除记录
    async deleteRecord(dateStr) {
        try {
            this.showLoading(true);
            
            // 调用删除API
            const response = await fetch(`/api/records/${dateStr}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('记录已删除', 'success');
                
                // 从本地缓存中删除数据
                const date = new Date(dateStr);
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.getDate();
                const monthKey = `${year}-${month}`;
                
                if (this.monthlyData[monthKey] && this.monthlyData[monthKey][day]) {
                    delete this.monthlyData[monthKey][day];
                }
                
                // 立即更新页面显示
                this.updateMonthDisplay(year, month);
                
                // 更新统计
                if (this.currentVisibleMonth && 
                    this.currentVisibleMonth.year === year && 
                    this.currentVisibleMonth.month === month) {
                    this.updateMonthlyStats(year, month);
                }
            } else {
                this.showToast(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除记录失败:', error);
            this.showToast('删除失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 获取中国北京时间
    getBeijingTime() {
        const now = new Date();
        
        // 方法1：尝试使用 toLocaleDateString
        try {
            const beijingDateString = now.toLocaleDateString("en-CA", {
                timeZone: "Asia/Shanghai"
            });
            if (beijingDateString && beijingDateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return beijingDateString;
            }
        } catch (e) {
            console.log('toLocaleDateString with timeZone not supported:', e);
        }
        
        // 方法2：手动计算北京时间 (UTC+8)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const beijingTime = new Date(utc + (8 * 3600000));
        
        const year = beijingTime.getFullYear();
        const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
        const day = String(beijingTime.getDate()).padStart(2, '0');
        
        const result = `${year}-${month}-${day}`;
        return result;
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('show');
        } else {
            loading.classList.remove('show');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new AirdropTracker();
});
