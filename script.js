// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmOVgHXXhLAp59JFI0UolZTW9pWyYZuoA",
  authDomain: "finanzas-pagina.firebaseapp.com",
  databaseURL: "https://finanzas-pagina-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "finanzas-pagina",
  storageBucket: "finanzas-pagina.firebasestorage.app",
  messagingSenderId: "138404823610",
  appId: "1:138404823610:web:e404ba1b91c02c71d56b03"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Load data from Firebase
async function loadData() {
    try {
        const snapshot = await get(ref(database, 'financeData'));
        const data = snapshot.val() || { expenses: [], incomes: [], budgets: [], automaticIncomes: [], automaticExpenses: [], monthlyAutomaticExpenses: [] };
        // Ensure arrays exist
        return {
            expenses: Array.isArray(data.expenses) ? data.expenses : [],
            incomes: Array.isArray(data.incomes) ? data.incomes : [],
            budgets: Array.isArray(data.budgets) ? data.budgets : [],
            automaticIncomes: Array.isArray(data.automaticIncomes) ? data.automaticIncomes : [],
            automaticExpenses: Array.isArray(data.automaticExpenses) ? data.automaticExpenses : [],
            monthlyAutomaticExpenses: Array.isArray(data.monthlyAutomaticExpenses) ? data.monthlyAutomaticExpenses : []
        };
    } catch (e) {
        console.error('Error loading data from Firebase:', e);
        return { expenses: [], incomes: [], budgets: [], automaticIncomes: [], automaticExpenses: [], monthlyAutomaticExpenses: [] };
    }
}

// Save data to Firebase
async function saveData(data) {
    try {
        await set(ref(database, 'financeData'), data);
    } catch (e) {
        console.error('Error saving data to Firebase:', e);
    }
}

// Global variables for editing
let editingIndex = -1;
let editingType = '';

// Tab navigation
const tabButtons = document.querySelectorAll('.tab-button');
if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(tab).classList.add('active');
        });
    });
}



// Add expense
const expenseForm = document.getElementById('expense-form');
if (expenseForm) {
    expenseForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const date = document.getElementById('expense-date').value;
        const description = document.getElementById('expense-description').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;

        if (amount <= 0) {
            alert('El monto debe ser positivo.');
            return;
        }
        if (new Date(date) > new Date()) {
            alert('La fecha no puede ser futura.');
            return;
        }

        const data = await loadData();
        if (editingIndex >= 0 && editingType === 'expense') {
            data.expenses[editingIndex] = { date, description, amount, category };
            editingIndex = -1;
            editingType = '';
            document.getElementById('expense-form').querySelector('button[type="submit"]').textContent = 'Agregar Gasto';
        } else {
            data.expenses.push({ date, description, amount, category });
        }
        await saveData(data);

        await displayExpenses();
        await updateDashboard();
        this.reset();
    });
}

// Add income
const incomeForm = document.getElementById('income-form');
if (incomeForm) {
    incomeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const date = document.getElementById('income-date').value;
        const description = document.getElementById('income-description').value;
        const amount = parseFloat(document.getElementById('income-amount').value);
        const category = document.getElementById('income-category').value;

        if (amount <= 0) {
            alert('El monto debe ser positivo.');
            return;
        }
        if (new Date(date) > new Date()) {
            alert('La fecha no puede ser futura.');
            return;
        }

        const data = await loadData();
        if (editingIndex >= 0 && editingType === 'income') {
            data.incomes[editingIndex] = { date, description, amount, category };
            editingIndex = -1;
            editingType = '';
            document.getElementById('income-form').querySelector('button[type="submit"]').textContent = 'Agregar Ingreso';
        } else {
            data.incomes.push({ date, description, amount, category });
        }
        await saveData(data);

        await displayIncomes();
        await updateDashboard();
        this.reset();
    });
}

// Generate monthly summary
const generateSummaryBtn = document.getElementById('generate-summary');
if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', async function() {
        const month = document.getElementById('summary-month').value;
        if (!month) return;

        const data = await loadData();
        const [year, monthNum] = month.split('-');

        const filteredExpenses = data.expenses.filter(e => e.date.startsWith(month));
        const filteredIncomes = data.incomes.filter(i => i.date.startsWith(month));

        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncomes = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncomes - totalExpenses;

        const summaryResult = document.getElementById('summary-result');
        summaryResult.innerHTML = `
            <h3>Resumen para ${month}</h3>
            <p><strong>Total Gastos:</strong> €${totalExpenses.toFixed(2)}</p>
            <p><strong>Total Ingresos:</strong> €${totalIncomes.toFixed(2)}</p>
            <p><strong>Balance:</strong> €${balance.toFixed(2)}</p>
        `;
        summaryResult.style.display = 'block';
    });
}

// Display expenses
async function displayExpenses(search = '', filter = '') {
    const data = await loadData();
    const expensesList = document.getElementById('expenses-list');
    if (!expensesList) return;
    expensesList.innerHTML = '';

    let filteredExpenses = data.expenses.map((expense, index) => ({ ...expense, originalIndex: index }))
        .filter(expense => expense.description.toLowerCase().includes(search.toLowerCase()))
        .filter(expense => !filter || expense.category === filter)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredExpenses.forEach(expense => {
        const expenseDiv = document.createElement('div');
        expenseDiv.className = 'entry expense';
        expenseDiv.innerHTML = `
            <div class="entry-info">
                <strong>${expense.description}</strong>
                <span>${expense.date} • ${expense.category}</span>
            </div>
            <div class="entry-amount">€${expense.amount.toFixed(2)}</div>
            <div class="entry-actions">
                <button class="btn-icon btn-edit" data-type="expense" data-index="${expense.originalIndex}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" data-type="expense" data-index="${expense.originalIndex}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        expensesList.appendChild(expenseDiv);
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.btn-edit[data-type="expense"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            editEntry('expense', index);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.btn-delete[data-type="expense"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteEntry('expense', index);
        });
    });
}

// Display incomes
async function displayIncomes(search = '', filter = '') {
    const data = await loadData();
    const incomesList = document.getElementById('incomes-list');
    if (!incomesList) return;
    incomesList.innerHTML = '';

    let filteredIncomes = data.incomes.map((income, index) => ({ ...income, originalIndex: index }))
        .filter(income => income.description.toLowerCase().includes(search.toLowerCase()))
        .filter(income => !filter || income.category === filter)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredIncomes.forEach(income => {
        const incomeDiv = document.createElement('div');
        incomeDiv.className = 'entry income';
        incomeDiv.innerHTML = `
            <div class="entry-info">
                <strong>${income.description}</strong>
                <span>${income.date} • ${income.category}</span>
            </div>
            <div class="entry-amount">€${income.amount.toFixed(2)}</div>
            <div class="entry-actions">
                <button class="btn-icon btn-edit" data-type="income" data-index="${income.originalIndex}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" data-type="income" data-index="${income.originalIndex}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        incomesList.appendChild(incomeDiv);
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.btn-edit[data-type="income"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            editEntry('income', index);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.btn-delete[data-type="income"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteEntry('income', index);
        });
    });
}

// Edit entry
async function editEntry(type, index) {
    const data = await loadData();
    let entry;
    if (type === 'expense') {
        entry = data.expenses[index];
        document.getElementById('expense-date').value = entry.date;
        document.getElementById('expense-description').value = entry.description;
        document.getElementById('expense-amount').value = entry.amount;
        document.getElementById('expense-category').value = entry.category;
        document.getElementById('expense-form').querySelector('button[type="submit"]').textContent = 'Actualizar Gasto';
    } else if (type === 'income') {
        entry = data.incomes[index];
        document.getElementById('income-date').value = entry.date;
        document.getElementById('income-description').value = entry.description;
        document.getElementById('income-amount').value = entry.amount;
        document.getElementById('income-category').value = entry.category;
        document.getElementById('income-form').querySelector('button[type="submit"]').textContent = 'Actualizar Ingreso';
    }
    editingIndex = index;
    editingType = type;
}

// Delete entry
async function deleteEntry(type, index) {
    if (!confirm('¿Estás seguro de eliminar esta entrada?')) return;
    const data = await loadData();
    if (type === 'expense') {
        data.expenses.splice(index, 1);
    } else if (type === 'income') {
        data.incomes.splice(index, 1);
    }
    await saveData(data);
    if (type === 'expense') {
        await displayExpenses();
    } else {
        await displayIncomes();
    }
    await updateDashboard();
}

// Update dashboard
async function updateDashboard() {
    console.log('updateDashboard called');
    const data = await loadData();
    console.log('Loaded data:', data);
    const totalIncomes = data.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncomes - totalExpenses;
    console.log('Totals:', { totalIncomes, totalExpenses, balance });

    const totalIncomesEl = document.getElementById('total-incomes');
    const totalExpensesEl = document.getElementById('total-expenses');
    const balanceEl = document.getElementById('balance');

    if (totalIncomesEl) totalIncomesEl.textContent = `€${totalIncomes.toFixed(2)}`;
    if (totalExpensesEl) totalExpensesEl.textContent = `€${totalExpenses.toFixed(2)}`;
    if (balanceEl) balanceEl.textContent = `€${balance.toFixed(2)}`;

    await displayBudgets();
    await renderChart();
}

// Display budgets
async function displayBudgets() {
    const data = await loadData();
    const budgetsList = document.getElementById('budgets-list');
    if (!budgetsList) return;
    budgetsList.innerHTML = '';

    if (!Array.isArray(data.budgets)) {
        console.error('data.budgets is not an array:', data.budgets);
        return;
    }

    data.budgets.forEach((budget, index) => {
        const spent = data.expenses.filter(e => e.category === budget.category).reduce((sum, e) => sum + e.amount, 0);
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        let statusClass = 'budget-good';
        if (percentage >= 100) {
            statusClass = 'budget-over';
        } else if (percentage >= 80) {
            statusClass = 'budget-warning';
        }

        const budgetDiv = document.createElement('div');
        budgetDiv.className = `budget-item ${statusClass}`;
        budgetDiv.innerHTML = `
            <div class="budget-header">
                <strong>${budget.category}</strong>
                <div class="budget-actions">
                    <button class="btn-icon btn-edit-budget" data-index="${index}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete-budget" data-index="${index}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="budget-details">
                <div class="budget-amounts">
                    <span class="spent">€${spent.toFixed(2)} gastado</span>
                    <span class="budget">€${budget.amount.toFixed(2)} presupuesto</span>
                </div>
            <div class="remaining">
                    ${remaining >= 0 ? `€${remaining.toFixed(2)} restante` : `<span class="budget-exceeded-indicator">⚠️</span>€${Math.abs(remaining).toFixed(2)} excedido <span class="budget-exceeded-indicator">⚠️</span>`}
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="budget-percentage">${percentage.toFixed(1)}%</div>
        `;
        budgetsList.appendChild(budgetDiv);
    });

    // Add event listeners for edit budget buttons
    document.querySelectorAll('.btn-edit-budget').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            editBudget(index);
        });
    });

    // Add event listeners for delete budget buttons
    document.querySelectorAll('.btn-delete-budget').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteBudget(index);
        });
    });
}

// Edit budget
async function editBudget(index) {
    const data = await loadData();
    const budget = data.budgets[index];
    document.getElementById('budget-category').value = budget.category;
    document.getElementById('budget-amount').value = budget.amount;
    document.getElementById('budget-form').querySelector('button[type="submit"]').textContent = 'Actualizar Presupuesto';
    editingIndex = index;
    editingType = 'budget';
}

// Delete budget
async function deleteBudget(index) {
    if (!confirm('¿Estás seguro de eliminar este presupuesto?')) return;
    const data = await loadData();
    data.budgets.splice(index, 1);
    await saveData(data);
    await displayBudgets();
}

// Render chart
async function renderChart() {
    console.log('renderChart called');
    const data = await loadData();
    const totalIncomes = data.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    console.log('Chart data:', { totalIncomes, totalExpenses });

    const ctx = document.getElementById('finance-chart');
    if (!ctx) {
        console.log('finance-chart canvas not found');
        return;
    }

    if (typeof Chart === 'undefined') {
        console.log('Chart.js not loaded');
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                label: 'Monto',
                data: [totalIncomes, totalExpenses],
                backgroundColor: ['#4CAF50', '#f44336'],
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    await renderCategoryChart();
    await renderTrendChart();
}

// Render category chart
async function renderCategoryChart() {
    const data = await loadData();
    const categoryTotals = {};
    data.expenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    const labels = Object.keys(categoryTotals);
    const values = Object.values(categoryTotals);

    const ctx = document.getElementById('category-chart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
            }]
        },
        options: {
            responsive: true,
        }
    });
}

// Render trend chart
async function renderTrendChart() {
    const data = await loadData();
    const monthlyData = {};

    // Aggregate incomes by month
    data.incomes.forEach(income => {
        const month = income.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { incomes: 0, expenses: 0 };
        }
        monthlyData[month].incomes += income.amount;
    });

    // Aggregate expenses by month
    data.expenses.forEach(expense => {
        const month = expense.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { incomes: 0, expenses: 0 };
        }
        monthlyData[month].expenses += expense.amount;
    });

    // Sort months
    const sortedMonths = Object.keys(monthlyData).sort();

    const labels = sortedMonths;
    const incomesData = sortedMonths.map(month => monthlyData[month].incomes);
    const expensesData = sortedMonths.map(month => monthlyData[month].expenses);

    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos',
                data: incomesData,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.1
            }, {
                label: 'Gastos',
                data: expensesData,
                borderColor: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Export expenses to CSV
async function exportExpenses() {
    const data = await loadData();
    let csv = 'Fecha,Descripción,Monto,Categoría\n';
    data.expenses.forEach(expense => {
        csv += `${expense.date},"${expense.description.replace(/"/g, '""')}",${expense.amount},${expense.category}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gastos.csv';
    a.click();
}

// Export incomes to CSV
async function exportIncomes() {
    const data = await loadData();
    let csv = 'Fecha,Descripción,Monto,Categoría\n';
    data.incomes.forEach(income => {
        csv += `${income.date},"${income.description.replace(/"/g, '""')}",${income.amount},${income.category}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ingresos.csv';
    a.click();
}

// Delete all expenses
async function deleteAllExpenses() {
    if (!confirm('¿Estás seguro de eliminar TODOS los gastos? Esta acción no se puede deshacer.')) return;
    const data = await loadData();
    data.expenses = [];
    await saveData(data);
    await displayExpenses();
    await updateDashboard();
    updateMonthlyExpensesSummary();
}

// Delete all incomes
async function deleteAllIncomes() {
    if (!confirm('¿Estás seguro de eliminar TODOS los ingresos? Esta acción no se puede deshacer.')) return;
    const data = await loadData();
    data.incomes = [];
    await saveData(data);
    await displayIncomes();
    await updateDashboard();
    await updateMonthlyIncomesSummary();
}

// Calculate time remaining until next occurrence
function getTimeRemaining(dayOfMonth, hour = 0, minute = 0) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Create target date for this month
    let targetDate = new Date(currentYear, currentMonth, dayOfMonth, hour, minute);

    // If the target date has passed this month, move to next month
    if (targetDate <= now) {
        targetDate = new Date(currentYear, currentMonth + 1, dayOfMonth, hour, minute);
    }

    const timeDiff = targetDate - now;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, targetDate };
}

// Process automatic entries that are due
async function processAutomaticEntries() {
    const data = await loadData();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    let updated = false;

    // Process automatic incomes
    data.automaticIncomes.forEach(autoIncome => {
        const timeRemaining = getTimeRemaining(autoIncome.day, autoIncome.hour || 0, autoIncome.minute || 0);
        if (timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && autoIncome.lastProcessed !== today) {
            // Add to regular incomes
            data.incomes.push({
                date: today,
                description: autoIncome.description,
                amount: autoIncome.amount,
                category: autoIncome.category
            });
            // Increment count
            autoIncome.count = (autoIncome.count || 0) + 1;
            // Mark as processed today
            autoIncome.lastProcessed = today;
            updated = true;
        }
    });

    // Process automatic expenses
    data.automaticExpenses.forEach(autoExpense => {
        const timeRemaining = getTimeRemaining(autoExpense.day, autoExpense.hour || 0, autoExpense.minute || 0);
        if (timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && autoExpense.lastProcessed !== today) {
            // Add to regular expenses
            data.expenses.push({
                date: today,
                description: autoExpense.description,
                amount: autoExpense.amount,
                category: autoExpense.category
            });
            // Increment count
            autoExpense.count = (autoExpense.count || 0) + 1;
            // Mark as processed today
            autoExpense.lastProcessed = today;
            updated = true;
        }
    });

    if (updated) {
        await saveData(data);
        await updateDashboard();
        if (window.location.pathname.includes('incomes.html')) {
            await displayIncomes();
            await displayAutomaticIncomes();
        }
        if (window.location.pathname.includes('expenses.html')) {
            await displayExpenses();
            await displayAutomaticExpenses();
        }
    }
}

// Add automatic income
const automaticIncomeForm = document.getElementById('automatic-income-form');
if (automaticIncomeForm) {
    automaticIncomeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const description = document.getElementById('auto-income-description').value;
        const amount = parseFloat(document.getElementById('auto-income-amount').value);
        const category = document.getElementById('auto-income-category').value;
        const day = parseInt(document.getElementById('auto-income-day').value);
        const hour = parseInt(document.getElementById('auto-income-hour').value);
        const minute = parseInt(document.getElementById('auto-income-minute').value);

        if (amount <= 0) {
            alert('El monto debe ser positivo.');
            return;
        }
        if (day < 1 || day > 31) {
            alert('El día debe estar entre 1 y 31.');
            return;
        }
        if (hour < 0 || hour > 23) {
            alert('La hora debe estar entre 0 y 23.');
            return;
        }
        if (minute < 0 || minute > 59) {
            alert('El minuto debe estar entre 0 y 59.');
            return;
        }

        const data = await loadData();
        if (editingIndex >= 0 && editingType === 'auto-income') {
            data.automaticIncomes[editingIndex] = { description, amount, category, day, hour, minute, count: data.automaticIncomes[editingIndex].count || 0 };
            editingIndex = -1;
            editingType = '';
            document.getElementById('automatic-income-form').querySelector('button[type="submit"]').textContent = 'Agregar Ingreso Automático';
        } else {
            data.automaticIncomes.push({ description, amount, category, day, hour, minute, count: 0 });
        }
        await saveData(data);

        displayAutomaticIncomes();
        this.reset();
    });
}

// Add automatic expense
const automaticExpenseForm = document.getElementById('automatic-expense-form');
if (automaticExpenseForm) {
    automaticExpenseForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const description = document.getElementById('auto-expense-description').value;
        const amount = parseFloat(document.getElementById('auto-expense-amount').value);
        const category = document.getElementById('auto-expense-category').value;
        const day = parseInt(document.getElementById('auto-expense-day').value);
        const hour = parseInt(document.getElementById('auto-expense-hour').value);
        const minute = parseInt(document.getElementById('auto-expense-minute').value);

        if (amount <= 0) {
            alert('El monto debe ser positivo.');
            return;
        }
        if (day < 1 || day > 31) {
            alert('El día debe estar entre 1 y 31.');
            return;
        }
        if (hour < 0 || hour > 23) {
            alert('La hora debe estar entre 0 y 23.');
            return;
        }
        if (minute < 0 || minute > 59) {
            alert('El minuto debe estar entre 0 y 59.');
            return;
        }

        const data = await loadData();
        if (editingIndex >= 0 && editingType === 'auto-expense') {
            data.automaticExpenses[editingIndex] = { description, amount, category, day, hour, minute, count: data.automaticExpenses[editingIndex].count || 0 };
            editingIndex = -1;
            editingType = '';
            document.getElementById('automatic-expense-form').querySelector('button[type="submit"]').textContent = 'Agregar Gasto Automático';
        } else {
            data.automaticExpenses.push({ description, amount, category, day, hour, minute, count: 0 });
        }
        await saveData(data);

        displayAutomaticExpenses();
        this.reset();
    });
}

// Display automatic incomes
async function displayAutomaticIncomes() {
    const data = await loadData();
    const automaticIncomesList = document.getElementById('automatic-incomes-list');
    if (!automaticIncomesList) return;
    automaticIncomesList.innerHTML = '';

    data.automaticIncomes.forEach((autoIncome, index) => {
        const timeRemaining = getTimeRemaining(autoIncome.day, autoIncome.hour || 0, autoIncome.minute || 0);
        const count = autoIncome.count || 0;
        const autoIncomeDiv = document.createElement('div');
        autoIncomeDiv.className = 'entry income';
        autoIncomeDiv.innerHTML = `
            <div class="entry-info">
                <strong>${autoIncome.description}</strong>
                <span>Día ${autoIncome.day} a las ${autoIncome.hour || 0}:${String(autoIncome.minute || 0).padStart(2, '0')} • ${autoIncome.category}</span>
                <div class="countdown" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                    <i class="fas fa-clock"></i> Próximo: ${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m
                </div>
                <div class="count" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                    <i class="fas fa-hashtag"></i> Registrado: ${count} veces
                </div>
            </div>
            <div class="entry-amount">€${autoIncome.amount.toFixed(2)}</div>
            <div class="entry-actions">
                <button class="btn-icon btn-edit-auto" data-type="income" data-index="${index}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete-auto" data-type="income" data-index="${index}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        automaticIncomesList.appendChild(autoIncomeDiv);
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.btn-edit-auto[data-type="income"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            editAutomaticEntry('income', index);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.btn-delete-auto[data-type="income"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteAutomaticEntry('income', index);
        });
    });
}

// Display automatic expenses
async function displayAutomaticExpenses() {
    const data = await loadData();
    const automaticExpensesList = document.getElementById('automatic-expenses-list');
    if (!automaticExpensesList) return;
    automaticExpensesList.innerHTML = '';

    data.automaticExpenses.forEach((autoExpense, index) => {
        const timeRemaining = getTimeRemaining(autoExpense.day, autoExpense.hour || 0, autoExpense.minute || 0);
        const count = autoExpense.count || 0;
        const autoExpenseDiv = document.createElement('div');
        autoExpenseDiv.className = 'entry expense';
        autoExpenseDiv.innerHTML = `
            <div class="entry-info">
                <strong>${autoExpense.description}</strong>
                <span>Día ${autoExpense.day} a las ${autoExpense.hour || 0}:${String(autoExpense.minute || 0).padStart(2, '0')} • ${autoExpense.category}</span>
                <div class="countdown" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                    <i class="fas fa-clock"></i> Próximo: ${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m
                </div>
                <div class="count" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                    <i class="fas fa-hashtag"></i> Registrado: ${count} veces
                </div>
            </div>
            <div class="entry-amount">€${autoExpense.amount.toFixed(2)}</div>
            <div class="entry-actions">
                <button class="btn-icon btn-edit-auto" data-type="expense" data-index="${index}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete-auto" data-type="expense" data-index="${index}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        automaticExpensesList.appendChild(autoExpenseDiv);
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.btn-edit-auto[data-type="expense"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            editAutomaticEntry('expense', index);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.btn-delete-auto[data-type="expense"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteAutomaticEntry('expense', index);
        });
    });
}

// Edit automatic entry
async function editAutomaticEntry(type, index) {
    const data = await loadData();
    let entry;
    if (type === 'income') {
        entry = data.automaticIncomes[index];
        document.getElementById('auto-income-description').value = entry.description;
        document.getElementById('auto-income-amount').value = entry.amount;
        document.getElementById('auto-income-category').value = entry.category;
        document.getElementById('auto-income-day').value = entry.day;
        document.getElementById('auto-income-hour').value = entry.hour || 0;
        document.getElementById('auto-income-minute').value = entry.minute || 0;
        document.getElementById('automatic-income-form').querySelector('button[type="submit"]').textContent = 'Actualizar Ingreso Automático';
    } else if (type === 'expense') {
        entry = data.automaticExpenses[index];
        document.getElementById('auto-expense-description').value = entry.description;
        document.getElementById('auto-expense-amount').value = entry.amount;
        document.getElementById('auto-expense-category').value = entry.category;
        document.getElementById('auto-expense-day').value = entry.day;
        document.getElementById('auto-expense-hour').value = entry.hour || 0;
        document.getElementById('auto-expense-minute').value = entry.minute || 0;
        document.getElementById('automatic-expense-form').querySelector('button[type="submit"]').textContent = 'Actualizar Gasto Automático';
    }
    editingIndex = index;
    editingType = 'auto-' + type;
}

// Delete automatic entry
async function deleteAutomaticEntry(type, index) {
    if (!confirm('¿Estás seguro de eliminar esta entrada automática?')) return;
    const data = await loadData();
    if (type === 'income') {
        data.automaticIncomes.splice(index, 1);
        displayAutomaticIncomes();
    } else if (type === 'expense') {
        data.automaticExpenses.splice(index, 1);
        displayAutomaticExpenses();
    }
    await saveData(data);
}

// Update countdown timers
function updateCountdowns() {
    const countdowns = document.querySelectorAll('.countdown');
    countdowns.forEach(countdown => {
        // This would need to be updated with the specific logic for each entry
        // For now, we'll update all countdowns by re-rendering the lists
    });

    // Re-render automatic lists to update countdowns
    if (document.getElementById('automatic-incomes-list')) {
        displayAutomaticIncomes();
    }
    if (document.getElementById('automatic-expenses-list')) {
        displayAutomaticExpenses();
    }
}

// Update monthly expenses summary
async function updateMonthlyExpensesSummary() {
    const data = await loadData();
    if (!data || !Array.isArray(data.expenses)) {
        console.error('Failed to load data or expenses is not an array');
        return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    const monthlyExpenses = data.expenses.filter(expense => expense.date.startsWith(currentMonth));
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const monthlyExpensesCount = monthlyExpenses.length;

    const totalEl = document.getElementById('monthly-expenses-total');
    const countEl = document.getElementById('monthly-expenses-count');

    if (totalEl) totalEl.textContent = `€${totalMonthlyExpenses.toFixed(2)}`;
    if (countEl) countEl.textContent = monthlyExpensesCount.toString();
}

// Update monthly incomes summary
async function updateMonthlyIncomesSummary() {
    const data = await loadData();
    if (!data || !Array.isArray(data.incomes)) {
        console.error('Failed to load data or incomes is not an array');
        return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    const monthlyIncomes = data.incomes.filter(income => income.date.startsWith(currentMonth));
    const totalMonthlyIncomes = monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
    const monthlyIncomesCount = monthlyIncomes.length;

    const totalEl = document.getElementById('monthly-incomes-total');
    const countEl = document.getElementById('monthly-incomes-count');

    if (totalEl) totalEl.textContent = `€${totalMonthlyIncomes.toFixed(2)}`;
    if (countEl) countEl.textContent = monthlyIncomesCount.toString();
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', async function() {
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    const expenseDateInput = document.getElementById('expense-date');
    const incomeDateInput = document.getElementById('income-date');
    if (expenseDateInput) expenseDateInput.value = today;
    if (incomeDateInput) incomeDateInput.value = today;



    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path.endsWith('PROYECTO/')) {
        updateDashboard();
    } else if (path.includes('expenses.html')) {
        displayExpenses();
        displayAutomaticExpenses();
        await updateMonthlyExpensesSummary();
        // Event listeners for search and filter
        const expenseSearch = document.getElementById('expense-search');
        const expenseFilter = document.getElementById('expense-filter');
        const exportExpensesBtn = document.getElementById('export-expenses');

        if (expenseSearch) {
            expenseSearch.addEventListener('input', function() {
                const search = this.value;
                const filter = expenseFilter ? expenseFilter.value : '';
                displayExpenses(search, filter);
            });
        }
        if (expenseFilter) {
            expenseFilter.addEventListener('change', function() {
                const search = expenseSearch ? expenseSearch.value : '';
                const filter = this.value;
                displayExpenses(search, filter);
            });
        }
        if (exportExpensesBtn) {
            exportExpensesBtn.addEventListener('click', exportExpenses);
        }
    } else if (path.includes('incomes.html')) {
        displayIncomes();
        displayAutomaticIncomes();
        await updateMonthlyIncomesSummary();
        // Similar for incomes
        const incomeSearch = document.getElementById('income-search');
        const incomeFilter = document.getElementById('income-filter');
        const exportIncomesBtn = document.getElementById('export-incomes');

        if (incomeSearch) {
            incomeSearch.addEventListener('input', function() {
                const search = this.value;
                const filter = incomeFilter ? incomeFilter.value : '';
                displayIncomes(search, filter);
            });
        }
        if (incomeFilter) {
            incomeFilter.addEventListener('change', function() {
                const search = incomeSearch ? incomeSearch.value : '';
                const filter = this.value;
                displayIncomes(search, filter);
            });
        }
        if (exportIncomesBtn) {
            exportIncomesBtn.addEventListener('click', exportIncomes);
        }
        const deleteAllIncomesBtn = document.getElementById('delete-all-incomes');
        if (deleteAllIncomesBtn) {
            deleteAllIncomesBtn.addEventListener('click', deleteAllIncomes);
        }
    }

    // Set up automatic entry processing and countdown updates
    processAutomaticEntries(); // Check for due entries on page load
    setInterval(processAutomaticEntries, 60000); // Check every minute
    setInterval(updateCountdowns, 60000); // Update countdowns every minute

    // Budget form
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        budgetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const category = document.getElementById('budget-category').value;
            const amount = parseFloat(document.getElementById('budget-amount').value);
            if (amount <= 0) {
                alert('El monto del presupuesto debe ser positivo.');
                return;
            }
            const data = await loadData();

            if (editingIndex >= 0 && editingType === 'budget') {
                // Update existing budget
                data.budgets[editingIndex] = { category, amount };
                editingIndex = -1;
                editingType = '';
                document.getElementById('budget-form').querySelector('button[type="submit"]').textContent = 'Guardar Presupuesto';
            } else {
                // Check if budget for this category already exists
                const existingIndex = data.budgets.findIndex(b => b.category === category);
                if (existingIndex >= 0) {
                    data.budgets[existingIndex].amount = amount;
                } else {
                    data.budgets.push({ category, amount });
                }
            }
            await saveData(data);
            displayBudgets();
            this.reset();
        });
    }
});
