/**
 * Product Catalog Manager - Handles printing and packaging product types
 */
class ProductCatalogManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.init();
    }

    init() {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        this.bindElements();
        this.attachEventListeners();
        this.loadProductCatalog();
        this.setupDynamicLabels();
    }

    bindElements() {
        this.elements = {
            form: document.getElementById('productForm'),
            nameInput: document.getElementById('productName'),
            descriptionInput: document.getElementById('productDescription'),
            typeSelect: document.getElementById('productType'),
            speedInput: document.getElementById('productSpeed'),
            speedLabel: document.getElementById('speedLabel'),
            setupTimeInput: document.getElementById('productSetupTime'),
            employeesInput: document.getElementById('productEmployees'),
            employeeCostInput: document.getElementById('productEmployeeCost'),
            addBtn: document.getElementById('addProductBtn'),
            catalogList: document.getElementById('productCatalogList')
        };
    }

    attachEventListeners() {
        this.elements.addBtn.addEventListener('click', () => this.addProduct());
        this.elements.typeSelect.addEventListener('change', () => this.updateSpeedLabel());
        
        // Add enter key support
        this.elements.form.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addProduct();
            }
        });
    }

    setupDynamicLabels() {
        this.updateSpeedLabel();
    }

    updateSpeedLabel() {
        const type = this.elements.typeSelect.value;
        const speedLabel = this.elements.speedLabel;
        
        if (type === 'printing') {
            speedLabel.textContent = 'Speed (meters/minute)';
            this.elements.speedInput.placeholder = 'e.g., 70';
        } else if (type === 'packaging') {
            speedLabel.textContent = 'Speed (packages/hour)';
            this.elements.speedInput.placeholder = 'e.g., 5000';
        } else {
            speedLabel.textContent = 'Speed';
            this.elements.speedInput.placeholder = 'Speed';
        }
    }

    addProduct() {
        const productData = this.collectFormData();
        
        if (!this.validateProductData(productData)) {
            return;
        }

        try {
            this.storageService.addMachineryCatalogItem(productData);
            this.clearForm();
            this.loadProductCatalog();
            this.showMessage('Product added successfully!', 'success');
        } catch (error) {
            this.showMessage('Error adding product: ' + error.message, 'error');
        }
    }

    collectFormData() {
        return {
            name: this.elements.nameInput.value.trim(),
            description: this.elements.descriptionInput.value.trim(),
            type: this.elements.typeSelect.value,
            speed: parseFloat(this.elements.speedInput.value),
            setupTime: parseFloat(this.elements.setupTimeInput.value),
            employees: parseInt(this.elements.employeesInput.value),
            employeeCost: parseFloat(this.elements.employeeCostInput.value)
        };
    }

    validateProductData(data) {
        if (!data.name) {
            this.showMessage('Please enter a product name', 'error');
            return false;
        }

        if (!data.type) {
            this.showMessage('Please select a product type', 'error');
            return false;
        }

        if (!data.speed || data.speed <= 0) {
            this.showMessage('Please enter a valid speed', 'error');
            return false;
        }

        if (data.setupTime < 0) {
            this.showMessage('Setup time cannot be negative', 'error');
            return false;
        }

        if (!data.employees || data.employees < 1) {
            this.showMessage('Number of people must be at least 1', 'error');
            return false;
        }

        if (!data.employeeCost || data.employeeCost < 0) {
            this.showMessage('Employee cost cannot be negative', 'error');
            return false;
        }

        return true;
    }

    clearForm() {
        this.elements.nameInput.value = '';
        this.elements.descriptionInput.value = '';
        this.elements.typeSelect.value = '';
        this.elements.speedInput.value = '';
        this.elements.setupTimeInput.value = '';
        this.elements.employeesInput.value = '';
        this.elements.employeeCostInput.value = '';
        this.updateSpeedLabel();
    }

    loadProductCatalog() {
        const products = this.storageService.getMachineryCatalog();
        this.renderProductCatalog(products);
    }

    renderProductCatalog(products) {
        if (!products || products.length === 0) {
            this.elements.catalogList.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No products in catalog. Add products to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.catalogList.innerHTML = products.map(product => 
            this.createProductRow(product)
        ).join('');
    }

    createProductRow(product) {
        const speedUnit = product.type === 'printing' ? 'm/min' : 'pkg/h';
        
        return `
            <tr>
                <td><strong>${product.name}</strong></td>
                <td>${product.description || '-'}</td>
                <td>
                    <span class="badge ${product.type === 'printing' ? 'badge-blue' : 'badge-green'}">
                        ${product.type}
                    </span>
                </td>
                <td>${product.speed} ${speedUnit}</td>
                <td>${product.setupTime}h</td>
                <td>${product.employees}</td>
                <td>$${product.employeeCost}/hr</td>
                <td class="text-center">
                    <button class="btn-delete" onclick="productCatalogManager.deleteProduct('${product.id}')" 
                            title="Delete product">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }

    deleteProduct(productId) {
        const product = this.storageService.getMachineryById(productId);
        const message = product ? 
            `Are you sure you want to delete "${product.name}"? This action cannot be undone.` :
            'Are you sure you want to delete this product? This action cannot be undone.';
            
        showDeleteConfirmation(message, () => {
            try {
                this.storageService.removeMachineryCatalogItem(productId);
                this.loadProductCatalog();
                this.showMessage('Product deleted successfully', 'success');
            } catch (error) {
                this.showMessage('Error deleting product: ' + error.message, 'error');
            }
        });
    }

    showMessage(message, type = 'info') {
        // Create or get message container
        let messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            document.querySelector('main').insertBefore(messageContainer, document.querySelector('main').firstChild);
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;

        // Add to container
        messageContainer.appendChild(messageEl);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            messageEl.remove();
            if (messageContainer.children.length === 0) {
                messageContainer.remove();
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.productCatalogManager = new ProductCatalogManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});