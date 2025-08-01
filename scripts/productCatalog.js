// Product Catalog Logic
const productsKey = 'productsCatalog';

function getProducts() {
    return JSON.parse(localStorage.getItem(productsKey) || '[]');
}

function saveProducts(products) {
    localStorage.setItem(productsKey, JSON.stringify(products));
}

function renderProducts() {
    const products = getProducts();
    const list = document.getElementById('productsList');
    list.innerHTML = '';
    if (products.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align:center; color: var(--text-light);">No products added yet.</td>';
        list.appendChild(row);
        return;
    }
    products.forEach((product, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.description}</td>
            <td>${product.speed}</td>
            <td>${product.setupTime}</td>
            <td>${product.employeesPerHour}</td>
            <td>$${product.employeeCostPerHour}</td>
            <td style="text-align: center;">
                <button class="action-btn delete-btn" data-idx="${idx}" title="Delete Product">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09a2.09 2.09 0 00-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            </td>
        `;
        list.appendChild(row);
    });
}

function addProduct() {
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const speed = parseFloat(document.getElementById('productSpeed').value);
    const setupTime = parseFloat(document.getElementById('productSetupTime').value);
    const employeesPerHour = parseInt(document.getElementById('productEmployees').value);
    const employeeCostPerHour = parseFloat(document.getElementById('productEmployeeCost').value);
    if (!name || !description || isNaN(speed) || isNaN(setupTime) || isNaN(employeesPerHour) || isNaN(employeeCostPerHour)) {
        showBanner('Please fill all fields correctly.', 'error');
        return;
    }
    const products = getProducts();
    products.push({ name, description, speed, setupTime, employeesPerHour, employeeCostPerHour });
    saveProducts(products);
    renderProducts();
    document.getElementById('productForm').querySelectorAll('input').forEach(i => i.value = '');
    showBanner('Product added!', 'success');
}

function showBanner(message, type) {
    let banner = document.getElementById('banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner';
        banner.className = 'banner';
        document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.className = 'banner ' + type;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 2000);
}

function confirmDelete(idx) {
    showConfirmBanner('Delete this product?', () => {
        const products = getProducts();
        products.splice(idx, 1);
        saveProducts(products);
        renderProducts();
        showBanner('Product deleted.', 'success');
    });
}

function showConfirmBanner(message, onConfirm) {
    let confirmBanner = document.getElementById('confirmBanner');
    if (!confirmBanner) {
        confirmBanner = document.createElement('div');
        confirmBanner.id = 'confirmBanner';
        confirmBanner.className = 'confirm-banner';
        document.body.appendChild(confirmBanner);
    }
    confirmBanner.innerHTML = `<span>${message}</span><button id="confirmYes">Yes</button><button id="confirmNo">No</button>`;
    confirmBanner.style.display = 'block';
    document.getElementById('confirmYes').onclick = () => {
        confirmBanner.style.display = 'none';
        onConfirm();
    };
    document.getElementById('confirmNo').onclick = () => {
        confirmBanner.style.display = 'none';
    };
}

document.getElementById('addProductBtn').onclick = addProduct;
document.getElementById('productsList').onclick = function(e) {
    if (e.target.classList.contains('delete-btn')) {
        confirmDelete(parseInt(e.target.dataset.idx));
    }
};

renderProducts();
