// Backlog Product Integration
function getProducts() {
    return window.storageService.getItem('productsCatalog', []);
}

function updateProductDropdown() {
    const select = document.getElementById('taskProduct');
    if (!select) return;
    select.innerHTML = '';
    const products = getProducts();
    products.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

function computeTaskFields() {
    const products = getProducts();
    const select = document.getElementById('taskProduct');
    const meters = parseFloat(document.getElementById('taskMeters').value) || 0;
    const productIdx = select ? parseInt(select.value) : -1;
    if (productIdx < 0 || !products[productIdx]) {
        document.getElementById('taskWorkTime').value = '';
        document.getElementById('taskSetupTime').value = '';
        document.getElementById('taskTotalTime').value = '';
        document.getElementById('taskTotalCost').value = '';
        return;
    }
    const product = products[productIdx];
    const workTime = meters / product.speed;
    const setupTime = product.setupTime;
    const totalTime = setupTime + workTime;
    const totalCost = totalTime * product.employeesPerHour * product.employeeCostPerHour;
    document.getElementById('taskWorkTime').value = workTime.toFixed(2);
    document.getElementById('taskSetupTime').value = setupTime.toFixed(2);
    document.getElementById('taskTotalTime').value = totalTime.toFixed(2);
    document.getElementById('taskTotalCost').value = totalCost.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
    updateProductDropdown();
    document.getElementById('taskProduct').addEventListener('change', computeTaskFields);
    document.getElementById('taskMeters').addEventListener('input', computeTaskFields);
});
