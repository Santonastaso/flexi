/**
 * Product Catalog Manager - Handles printing and packaging product types
 */
class ProductCatalogManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.init(this.getElementMap());
    }

    init(elementMap) {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        this.bindElements(elementMap);
        this.attachEventListeners();
        this.loadProductCatalog();
        this.setupDynamicLabels();
        
        // Initialize edit functionality
        if (this.editManager) {
            this.editManager.initTableEdit('.modern-table');
            // Override saveEdit method
            this.editManager.saveEdit = (row) => this.saveEdit(row);
            
            // Handle delete events
            const table = document.querySelector('.modern-table');
            if (table) {
                table.addEventListener('deleteRow', (e) => {
                    const row = e.detail.row;
                    const productId = row.dataset.productId;
                    if (productId) {
                        this.deleteProduct(productId);
                    }
                });
            }
        }
    }

    getElementMap() {
        return {
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
        this.elements.typeSelect.addEventListener('change', () => {
            this.updateSpeedLabel();
            this.validateForm();
        });
        
        // Add form validation on input
        const inputs = [
            this.elements.nameInput,
            this.elements.speedInput,
            this.elements.setupTimeInput,
            this.elements.employeesInput,
            this.elements.employeeCostInput
        ];
        
        inputs.forEach(input => {
            input.addEventListener('input', () => this.validateForm());
            input.addEventListener('change', () => this.validateForm());
        });
        
        // Add enter key support
        this.elements.form.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addProduct();
            }
        });
        
        // Initial validation
        this.validateForm();
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

    validateForm() {
        const name = this.elements.nameInput.value.trim();
        const type = this.elements.typeSelect.value;
        const speed = parseFloat(this.elements.speedInput.value);
        const setupTime = parseFloat(this.elements.setupTimeInput.value);
        const employees = parseInt(this.elements.employeesInput.value);
        const employeeCost = parseFloat(this.elements.employeeCostInput.value);
        
        const isValid = name && 
                      type && 
                      speed && speed > 0 && 
                      setupTime >= 0 && 
                      employees && employees >= 1 && 
                      employeeCost && employeeCost >= 0;
        
        this.elements.addBtn.disabled = !isValid;
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
            <tr data-product-id="${product.id}">
                <td class="editable-cell" data-field="name">
                    <span class="static-value"><strong>${product.name}</strong></span>
                    ${this.editManager.createEditInput('text', product.name)}
                </td>
                <td class="editable-cell" data-field="description">
                    <span class="static-value">${product.description || '-'}</span>
                    ${this.editManager.createEditInput('text', product.description)}
                </td>
                <td class="editable-cell" data-field="type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${product.type}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', product.type, {
                        options: [
                            { value: 'printing', label: 'Printing' },
                            { value: 'packaging', label: 'Packaging' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="speed">
                    <span class="static-value">${product.speed} ${speedUnit}</span>
                    ${this.editManager.createEditInput('number', product.speed, { min: 0.1, step: 0.1 })}
                </td>
                <td class="editable-cell" data-field="setupTime">
                    <span class="static-value">${product.setupTime}h</span>
                    ${this.editManager.createEditInput('number', product.setupTime, { min: 0, step: 0.1 })}
                </td>
                <td class="editable-cell" data-field="employees">
                    <span class="static-value">${product.employees}</span>
                    ${this.editManager.createEditInput('number', product.employees, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="employeeCost">
                    <span class="static-value">$${product.employeeCost}/hr</span>
                    ${this.editManager.createEditInput('number', product.employeeCost, { min: 0, step: 0.01 })}
                </td>
                <td class="text-center">
                    ${this.editManager.createActionButtons()}
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

    saveEdit(row) {
        const productId = row.dataset.productId;
        if (!productId) {
            console.error('No product ID found in row');
            return;
        }

        // Collect edited values using the edit manager
        const updatedData = this.editManager.collectEditedValues(row);

        console.log('Collected updated product data:', updatedData);

        // Validate data
        if (!updatedData.name || updatedData.name.trim() === '') {
            this.showMessage('Product name cannot be empty', 'error');
            return;
        }

        try {
            // Get current product
            const catalog = this.storageService.getMachineryCatalog();
            const product = catalog.find(p => String(p.id) === String(productId));
            if (!product) {
                this.showMessage('Product not found', 'error');
                return;
            }

            // Update product with new values
            const updatedProduct = {
                ...product,
                name: updatedData.name.trim(),
                description: updatedData.description.trim(),
                type: updatedData.type,
                speed: parseFloat(updatedData.speed) || product.speed,
                setupTime: parseFloat(updatedData.setupTime) || product.setupTime,
                employees: parseInt(updatedData.employees) || product.employees,
                employeeCost: parseFloat(updatedData.employeeCost) || product.employeeCost
            };

            console.log('Original product:', product);
            console.log('Updated product:', updatedProduct);

            // Save updated product
            const updatedCatalog = catalog.map(p => 
                String(p.id) === String(productId) ? updatedProduct : p
            );
            this.storageService.saveMachineryCatalog(updatedCatalog);

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadProductCatalog();
            this.showMessage('Product updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating product: ' + error.message, 'error');
        }
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