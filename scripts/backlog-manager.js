/**
 * Backlog Manager - Manages production orders (ODP) in the backlog
 */
class BacklogManager extends BaseManager {
    constructor() {
        super(null);
        this.editManager = window.editManager;
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        this.storageService = window.storageService;
    }

    init(elementMap) {
        // Set up storage service reference
        this.storageService = window.storageService;
        
        if (!this.validate_storage_service()) return false;
        
        if (super.init(elementMap)) {
            this.load_backlog();
            this.setup_form_validation();
            
            // Attach event listeners for form interactions
            this.attach_event_listeners();
        
        // Initialize edit functionality
        if (this.editManager) {
                const tableBody = document.querySelector('#backlog_table_body');
                if (tableBody) {
                    this.editManager.init_table_edit(tableBody);
                    this.editManager.register_save_handler(tableBody, (row) => this.save_edit(row));
                    
                    // Add delete event listener
                    tableBody.addEventListener('deleteRow', (e) => {
                    const row = e.detail.row;
                        const odpId = row.dataset.odpId;
                        if (odpId) {
                            this.delete_odp_order(odpId);
                    }
                });
            }
            }
            
            return true;
        }
        
        return false;
    }

    get_element_map() {
        return {
            // Form elements
            odp_number: document.getElementById('odp_number'),
            article_code: document.getElementById('article_code'),
            production_lot: document.getElementById('production_lot'),
            work_center: document.getElementById('work_center'),
            nome_cliente: document.getElementById('nome_cliente'),
            description: document.getElementById('description'),
            delivery_date: document.getElementById('delivery_date'),
            bag_height: document.getElementById('bag_height'),
            bag_width: document.getElementById('bag_width'),
            bag_step: document.getElementById('bag_step'),
            seal_sides: document.getElementById('seal_sides'),
            product_type: document.getElementById('product_type'),
            quantity: document.getElementById('quantity'),
            department: document.getElementById('department'),
            fase: document.getElementById('fase'),
            internal_customer_code: document.getElementById('internal_customer_code'),
            external_customer_code: document.getElementById('external_customer_code'),
            customer_order_ref: document.getElementById('customer_order_ref'),
            calculate_btn: document.getElementById('calculate_btn'),
            create_task: document.getElementById('create_task'),
            update_statuses_btn: document.getElementById('update_statuses_btn'),
            debug_events_btn: document.getElementById('debug_events_btn'),
            backlog_table_body: document.getElementById('backlog_table_body')
        };
    }

    attach_event_listeners() {
        // Article code automation - auto-determine department and work center
        if (this.elements.article_code) {
            this.elements.article_code.addEventListener('input', () => {
                this.handle_article_code_change();
            });
            this.elements.article_code.addEventListener('change', () => {
                this.handle_article_code_change();
            });
        }

        // Calculate button
        if (this.elements.calculate_btn) {
            this.elements.calculate_btn.addEventListener('click', () => this.handle_calculate());
        }

        // Create task button
        if (this.elements.create_task) {
            this.elements.create_task.addEventListener('click', () => {
                // Temporary debugging - remove this later
                if (window.DEBUG) {
                    console.log('Create task button clicked');
                }
                this.handle_create_task();
            });
        }

        // Update statuses button
        if (this.elements.update_statuses_btn) {
            this.elements.update_statuses_btn.addEventListener('click', () => {
                if (window.DEBUG) {
                    console.log('Sync with Gantt button clicked');
                }
                this.sync_all_odp_with_gantt();
            });
        }

        // Debug events button
        if (this.elements.debug_events_btn) {
            this.elements.debug_events_btn.addEventListener('click', () => {
                this.debug_scheduled_events();
            });
        }

        // Note: Removed complex event-based updates in favor of simple sync button

        // Form validation on input
        const formInputs = [
            this.elements.odp_number, this.elements.article_code, this.elements.production_lot,
            this.elements.work_center, this.elements.nome_cliente, this.elements.description,
            this.elements.delivery_date, this.elements.bag_height, this.elements.bag_width,
            this.elements.bag_step, this.elements.seal_sides, this.elements.product_type,
            this.elements.quantity, this.elements.department, this.elements.fase, this.elements.internal_customer_code,
            this.elements.external_customer_code, this.elements.customer_order_ref
        ];

        formInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validate_form_fields());
                input.addEventListener('change', () => this.validate_form_fields());
            }
        });

        // Populate phases dropdown
        this.populate_phases_dropdown();
        
        // Hide calculation results initially
        this.hide_calculation_results();
        
        // Note: Status sync is now manual via the "Sync with Gantt" button
    }

    setup_form_validation() {
        this.validate_form_fields();
    }

    handle_article_code_change() {
        const articleCode = this.elements.article_code.value.trim();
        
        if (articleCode) {
            // Auto-determine department based on article code
            const department = this.businessLogic.auto_determine_department(articleCode);
            
            // Auto-determine work center based on article code
            const workCenter = this.businessLogic.auto_determine_work_center(articleCode);
            
            // Temporary debugging - remove this later
        if (window.DEBUG) {
                console.log(`Article code: ${articleCode}, Department: ${department}, Work Center: ${workCenter}`);
            }
            
            // Update the work center field (readonly, so it will be populated automatically)
            if (this.elements.work_center) {
        this.elements.work_center.value = workCenter;
    }

            // Store department in a data attribute for later use
            if (this.elements.article_code) {
                this.elements.article_code.dataset.department = department;
            }
            
            // Update the department field to show the department
            if (this.elements.department) {
                this.elements.department.value = department;
                // Temporary debugging - remove this later
        if (window.DEBUG) {
                    console.log(`Set department to: ${department}`);
                }
            }
            
            // Repopulate phases dropdown based on the new work type
            this.populate_phases_dropdown();
            
            // Re-validate form after automation
            this.validate_form_fields();
        }
    }

    validate_form_fields() {
        // Basic validation logic
        let isValid = true;
        
        // Required fields validation
        const required_fields = [
            'odp_number', 'article_code', 'production_lot', 'work_center',
            'nome_cliente', 'delivery_date', 'bag_height', 'bag_width', 'bag_step',
            'seal_sides', 'product_type', 'quantity', 'fase'
        ];
        
        required_fields.forEach(fieldId => {
            const field = this.elements[fieldId];
            if (field && !field.value.trim()) {
                isValid = false;
                // Temporary debugging - remove this later
        if (window.DEBUG) {
                    console.log(`Field ${fieldId} is empty: "${field.value}"`);
                }
            }
        });
        
        // Enable/disable calculate button based on validation
        if (this.elements.calculate_btn) {
            this.elements.calculate_btn.disabled = !isValid;
        }
        
        // Temporary debugging - remove this later
            if (window.DEBUG) {
            console.log(`Form validation result: ${isValid}`);
        }
        
        return isValid;
    }

    handle_calculate() {
        try {
            // Validate required fields first
            if (!this.validate_form_fields()) {
                this.show_error_message('Please fill in all required fields before calculating');
                return;
            }

            // Get the selected phase
            const selectedPhaseName = this.elements.fase.value;
            if (!selectedPhaseName) {
                this.show_error_message('Please select a production phase');
                return;
            }

            // Get phase details from storage
            const phases = this.storageService.get_phases();
            
            const selectedPhase = phases.find(phase => phase.name === selectedPhaseName);
            
            if (!selectedPhase) {
                this.show_error_message('Selected phase not found');
                return;
            }

            // Get form values
            const quantity = parseInt(this.elements.quantity.value) || 0;
            const bagStep = parseInt(this.elements.bag_step.value) || 0;

            // Calculate results
            const results = this.calculate_production_metrics(selectedPhase, quantity, bagStep);
            
            // Display results
            this.display_calculation_results(results);
            
            // Show success message
            this.show_success_message('Calculation completed successfully');
            
        } catch (error) {
            this.show_error_message('calculating production metrics', error);
        }
    }

    calculate_production_metrics(phase, quantity, bagStep) {
        const results = {
            printing: {
                processing_time: 0,
                setup_time: 0,
                total_time: 0,
                cost: 0
            },
            packaging: {
                processing_time: 0,
                setup_time: 0,
                total_time: 0,
                cost: 0
            },
            totals: {
                duration: 0,
                cost: 0
            }
        };

        // Calculate printing metrics if phase has printing parameters
        if (phase.department === 'STAMPA' && phase.v_stampa > 0) {
            // Calculate meters to print: (Passo * Quantità)/1000
            const metersToPrint = (bagStep * quantity) / 1000;
            
            // Calculate printing time: mt_da_stampare / velocità_fase_stampa
            results.printing.processing_time = metersToPrint / phase.v_stampa;
            
            // Setup time from phase
            results.printing.setup_time = phase.t_setup_stampa || 0;
            
            // Total printing time: tempo_stampa + tempo_setUP_fase_stampa
            results.printing.total_time = results.printing.processing_time + results.printing.setup_time;
            
            // Printing cost: tempo_ODP_totale_Stampa * costo_orario_fase
            results.printing.cost = results.printing.total_time * (phase.costo_h_stampa || 0);
        }

        // Calculate packaging metrics if phase has packaging parameters
        if (phase.department === 'CONFEZIONAMENTO' && phase.v_conf > 0) {
            // Calculate packaging time: pezzi_ODP / velocità_fase_confezionamento
            results.packaging.processing_time = quantity / phase.v_conf;
            
            // Setup time from phase
            results.packaging.setup_time = phase.t_setup_conf || 0;
            
            // Total packaging time: tempo_confezionamento + tempo_setUP_fase_confezionamento
            results.packaging.total_time = results.packaging.processing_time + results.packaging.setup_time;
            
            // Packaging cost: tempo_ODP_totale * costo_orario_fase
            results.packaging.cost = results.packaging.total_time * (phase.costo_h_conf || 0);
        }

        // Calculate totals
        results.totals.duration = results.printing.total_time + results.packaging.total_time;
        results.totals.cost = results.printing.cost + results.packaging.cost;


        return results;
    }

    display_calculation_results(results) {
        // Store the calculation results for later use
        this.current_calculation_results = results;
        
        // Show the calculation results section
        const calculationResults = document.getElementById('calculation_results');
        if (calculationResults) {
            calculationResults.style.display = 'block';
        }

        // Update printing results
        this.update_result_field('printing_processing_time', results.printing.processing_time.toFixed(2));
        this.update_result_field('printing_setup_time', results.printing.setup_time.toFixed(2));
        this.update_result_field('printing_total_time', results.printing.total_time.toFixed(2));
        this.update_result_field('printing_cost', results.printing.cost.toFixed(2));

        // Update packaging results
        this.update_result_field('packaging_processing_time', results.packaging.processing_time.toFixed(2));
        this.update_result_field('packaging_setup_time', results.packaging.setup_time.toFixed(2));
        this.update_result_field('packaging_total_time', results.packaging.total_time.toFixed(2));
        this.update_result_field('packaging_cost', results.packaging.cost.toFixed(2));

        // Update totals
        this.update_result_field('total_duration', results.totals.duration.toFixed(2));
        this.update_result_field('total_cost', results.totals.cost.toFixed(2));

        // Enable the "Add to Backlog" button
        if (this.elements.create_task) {
            this.elements.create_task.disabled = false;
            // Temporary debugging - remove this later
        if (window.DEBUG) {
                console.log('Add to Backlog button enabled');
            }
        }
    }

    update_result_field(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.textContent = value;
        }
    }

    hide_calculation_results() {
        const calculationResults = document.getElementById('calculation_results');
        if (calculationResults) {
            calculationResults.style.display = 'none';
        }
        
        // Disable the "Add to Backlog" button initially
        if (this.elements.create_task) {
            this.elements.create_task.disabled = true;
        }
    }

    handle_create_task() {
        // Temporary debugging - remove this later
        if (window.DEBUG) {
            console.log('handle_create_task called');
        }
        
        try {
            // Validate form again before creating
            if (!this.validate_form_fields()) {
                this.show_error_message('Please fill in all required fields before creating the task');
            return;
        }

            // Debug: Check if we have calculation results
            if (window.DEBUG) {
                console.log('Current calculation results:', this.current_calculation_results);
            }
            
            // Collect form data
            const orderData = {
            odp_number: this.elements.odp_number.value.trim(),
                article_code: this.elements.article_code.value.trim(),
            production_lot: this.elements.production_lot.value.trim(),
                work_center: this.elements.work_center.value.trim(),
            nome_cliente: this.elements.nome_cliente.value.trim(),
            description: this.elements.description.value.trim(),
                delivery_date: this.elements.delivery_date.value,
            bag_height: parseInt(this.elements.bag_height.value) || 0,
            bag_width: parseInt(this.elements.bag_width.value) || 0,
            bag_step: parseInt(this.elements.bag_step.value) || 0,
                seal_sides: this.elements.seal_sides.value,
            product_type: this.elements.product_type.value,
            quantity: parseInt(this.elements.quantity.value) || 0,
                department: this.elements.department.value,
                fase: this.elements.fase.value,
                internal_customer_code: this.elements.internal_customer_code.value.trim(),
            external_customer_code: this.elements.external_customer_code.value.trim(),
            customer_order_ref: this.elements.customer_order_ref.value.trim(),
                // Add calculated duration and cost from the calculation results
                duration: this.current_calculation_results ? this.current_calculation_results.totals.duration : 0,
                cost: this.current_calculation_results ? this.current_calculation_results.totals.cost : 0,
                // Set initial status and new fields
                status: 'NOT SCHEDULED',
                production_start: null, // Will display as "-" until scheduled
                production_end: null, // Will display as "-" until scheduled
                progress: 0, // Initial progress is 0%
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Add the order to storage
        if (window.DEBUG) {
                console.log('About to add order to storage:', orderData);
                console.log('Duration being sent:', orderData.duration);
                console.log('Cost being sent:', orderData.cost);
            }
            
            const newOrder = this.storageService.add_odp_order(orderData);
        
        if (window.DEBUG) {
                console.log('Order added to storage:', newOrder);
            }
            
            // Clear the form
            this.clear_form_fields();
            
            // Reload the backlog table
            this.load_backlog();
            
            // Show success message
            this.show_success_message(`Production order "${orderData.odp_number}" created successfully`);
            
            // Hide calculation results
            const calculationResults = document.getElementById('calculation_results');
            if (calculationResults) {
                calculationResults.style.display = 'none';
            }
            
            // Disable the "Add to Backlog" button again
            if (this.elements.create_task) {
                this.elements.create_task.disabled = true;
            }
            
        } catch (error) {
            this.show_error_message('creating production order', error);
        }
    }

    load_backlog() {
        // Load existing backlog items
        const backlogItems = this.storageService.get_odp_orders() || [];
        
        if (window.DEBUG) {
            console.log('Loading backlog items:', backlogItems);
        }
        
        // Render the backlog (status sync is now manual via button)
        this.render_backlog(backlogItems);
    }

    render_backlog(items) {
        if (window.DEBUG) {
            console.log('Rendering backlog with items:', items);
        }
        
        if (!this.elements.backlog_table_body) {
            if (window.DEBUG) {
                console.log('No backlog table body element found');
            }
            return;
        }

        if (!items || items.length === 0) {
            if (window.DEBUG) {
                console.log('No items to render, showing empty state');
            }
            this.elements.backlog_table_body.innerHTML = `
                <tr>
                    <td colspan="14" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No backlog items found. Create production lots to get started.
                </td>
            </tr>
            `;
            return;
        }

        if (window.DEBUG) {
            console.log('Rendering items to table');
        }
        
        this.elements.backlog_table_body.innerHTML = items.map(item => this.create_backlog_row(item)).join('');
    }

    create_backlog_row(item) {
        return `
            <tr data-odp-id="${item.id}">
                <!-- IDENTIFICAZIONE (Identification) -->
                <td class="editable-cell" data-field="id">
                    <span class="static-value">${item.id}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.id) : ''}
                </td>
                <td class="editable-cell" data-field="odp_number">
                    <span class="static-value">${Utils.escape_html(item.odp_number || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.odp_number) : ''}
                </td>
                <td class="editable-cell" data-field="article_code">
                    <span class="static-value">${Utils.escape_html(item.article_code || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.article_code) : ''}
                </td>
                <td class="editable-cell" data-field="production_lot">
                    <span class="static-value">${Utils.escape_html(item.production_lot || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.production_lot) : ''}
                </td>
                <td class="editable-cell" data-field="work_center">
                    <span class="static-value">${Utils.escape_html(item.work_center || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.work_center) : ''}
                </td>
                <td class="editable-cell" data-field="nome_cliente">
                    <span class="static-value">${Utils.escape_html(item.nome_cliente || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.nome_cliente) : ''}
                </td>
                <td class="editable-cell" data-field="description">
                    <span class="static-value">${Utils.escape_html(item.description || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.description) : ''}
                </td>
                
                <!-- SPECIFICHE TECNICHE (Technical Specifications) -->
                <td class="editable-cell" data-field="bag_height">
                    <span class="static-value">${item.bag_height || '-'} mm</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.bag_height, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="bag_width">
                    <span class="static-value">${item.bag_width || '-'} mm</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.bag_width, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="bag_step">
                    <span class="static-value">${item.bag_step || '-'} mm</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.bag_step, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="seal_sides">
                    <span class="static-value">${item.seal_sides || '-'} sides</span>
                    ${this.editManager ? this.editManager.create_edit_input('select', item.seal_sides, {
                        options: [
                            { value: '3', label: '3 sides' },
                            { value: '4', label: '4 sides' },
                            { value: '5', label: '5 sides' },
                            { value: '6', label: '6 sides' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="product_type">
                    <span class="static-value">${Utils.escape_html(item.product_type || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.product_type) : ''}
                </td>
                <td class="editable-cell" data-field="quantity">
                    <span class="static-value">${item.quantity || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.quantity, { min: 0 }) : ''}
                </td>
                
                <!-- PIANIFICAZIONE (Planning) -->
                <td class="editable-cell" data-field="production_start">
                    <span class="static-value">${item.production_start ? this.format_production_start(item.production_start) : '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', item.production_start) : ''}
                </td>
                <td class="editable-cell" data-field="production_end">
                    <span class="static-value">${item.production_end ? this.format_production_start(item.production_end) : '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', item.production_end) : ''}
                </td>
                <td class="editable-cell" data-field="delivery_date">
                    <span class="static-value">${item.delivery_date || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', item.delivery_date) : ''}
                </td>
                
                <!-- DATI COMMERCIALI (Commercial Data) -->
                <td class="editable-cell" data-field="internal_customer_code">
                    <span class="static-value">${Utils.escape_html(item.internal_customer_code || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.internal_customer_code) : ''}
                </td>
                <td class="editable-cell" data-field="external_customer_code">
                    <span class="static-value">${Utils.escape_html(item.external_customer_code || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.external_customer_code) : ''}
                </td>
                <td class="editable-cell" data-field="customer_order_ref">
                    <span class="static-value">${Utils.escape_html(item.customer_order_ref || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.customer_order_ref) : ''}
                </td>
                
                <!-- DATI LAVORAZIONE (Processing Data) -->
                <td class="editable-cell" data-field="department">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${Utils.escape_html(item.department || '-')}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.department) : ''}
                </td>
                <td class="editable-cell" data-field="fase">
                    <span class="static-value">${Utils.escape_html(item.fase || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.fase) : ''}
                </td>
                
                <!-- COLONNE DA CALCOLARE (Calculated Columns) -->
                <td class="editable-cell" data-field="duration">
                    <span class="static-value">${item.duration || '-'} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.duration, { min: 0, step: 0.1 }) : ''}
                </td>
                <td class="editable-cell" data-field="cost">
                    <span class="static-value">€${item.cost || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.cost, { min: 0, step: 0.01 }) : ''}
                </td>
                <td class="editable-cell" data-field="progress">
                    <span class="static-value">${item.progress || 0}%</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', item.progress, { min: 0, max: 100, step: 1 }) : ''}
                </td>
                
                <!-- Additional fields -->
                <td class="editable-cell" data-field="priority">
                    <span class="static-value">${Utils.escape_html(item.priority || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.priority) : ''}
                </td>
                <td class="editable-cell" data-field="status">
                    <span class="static-value">${Utils.escape_html(item.status || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.status) : ''}
                </td>
                
                <td class="text-center">
                    ${this.editManager ? this.editManager.create_action_buttons() : ''}
                </td>
            </tr>
        `;
    }

    save_edit(row) {
        const odpId = row.dataset.odpId;
        if (!odpId) {
            console.error('No ODP ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        const updatedData = this.validate_edit_row(
            row,
            ['odp_number', 'article_code', 'production_lot'], // Required fields
            ['bag_height', 'bag_width', 'bag_step', 'quantity', 'progress'], // Numeric fields
            {
                bag_height: 'Bag Height',
                bag_width: 'Bag Width',
                bag_step: 'Bag Step',
                quantity: 'Quantity',
                progress: 'Progress'
            }
        );
        
        if (!updatedData) {
            return; // Validation failed, error already shown
        }

        try {
            // Get current ODP order
            const currentOrder = this.storageService.get_odp_order_by_id(odpId);
            if (!currentOrder) {
                this.showMessage('ODP order not found', 'error');
                return;
            }

            // Update ODP order with new values
            const updatedOrder = {
                ...currentOrder,
                ...updatedData,
                updated_at: new Date().toISOString()
            };

            // Update ODP order
            this.storageService.update_odp_order(odpId, updatedOrder);

            // Exit edit mode
            this.editManager.cancel_edit(row);

            // Update display
            this.load_backlog();
            this.show_success_message('ODP order updated');

            } catch (error) {
            this.show_error_message('updating ODP order', error);
        }
    }

    clear_form_fields() {
        // Clear all form input fields
        Object.values(this.elements).forEach(element => {
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA')) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    element.checked = false;
                } else {
                    element.value = '';
                }
            }
        });
        
        // Clear any stored department data
        if (this.elements.article_code) {
            delete this.elements.article_code.dataset.department;
        }
        
        // Clear work center and department fields
        if (this.elements.work_center) {
            this.elements.work_center.value = '';
        }
        if (this.elements.department) {
            this.elements.department.value = '';
        }
        
        // Clear stored calculation results
        this.current_calculation_results = null;
        
        // Repopulate phases dropdown with all phases when form is cleared
        this.populate_phases_dropdown();
        
        // Re-validate form
        this.validate_form_fields();
    }

    populate_phases_dropdown() {
        try {
            const phases = this.storageService.get_phases();
            const faseDropdown = this.elements.fase;
            
            // Temporary debugging - remove this later
            if (window.DEBUG) {
                console.log('Populating phases dropdown with phases:', phases);
            }
            
            if (faseDropdown && phases && phases.length > 0) {
                // Clear existing options except the first placeholder
                faseDropdown.innerHTML = '<option value="">Select production phase</option>';
                
                // Add phases based on the determined department
                const department = this.elements.department.value;
                if (department) {
                    // Filter phases by department
                    const relevantPhases = phases.filter(phase => 
                        phase.department === department
                    );
                    
                    relevantPhases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.name;
                        option.textContent = phase.name;
                        faseDropdown.appendChild(option);
                    });
                } else {
                    // If no work type determined yet, show all phases
                    phases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.name;
                        option.textContent = phase.name;
                        faseDropdown.appendChild(option);
                    });
                }
            }
        } catch (error) {
            // Error populating phases dropdown
        }
    }

    delete_odp_order(odpId) {
        try {
            // Get current ODP order for confirmation message
            const currentOrder = this.storageService.get_odp_order_by_id(odpId);
            const orderName = currentOrder ? currentOrder.odp_number : 'this ODP order';
            
            const message = `Are you sure you want to delete "${orderName}"? This action cannot be undone.`;
            
            show_delete_confirmation(message, () => {
                try {
                    this.storageService.remove_odp_order(odpId);
                    this.load_backlog();
                    this.show_success_message('ODP order deleted');
        } catch (error) {
                    this.show_error_message('deleting ODP order', error);
                }
            });
        } catch (error) {
            this.show_error_message('deleting ODP order', error);
        }
    }





    /**
     * Sync all ODP orders with current Gantt data
     * Updates both status and production start based on what's actually scheduled
     */
    sync_all_odp_with_gantt() {
        try {
            const allOrders = this.storageService.get_odp_orders() || [];
            const scheduledEvents = this.storageService.get_scheduled_events() || [];
            
            if (window.DEBUG) {
                console.log(`Syncing ${allOrders.length} ODP orders with ${scheduledEvents.length} scheduled events`);
            }
            
            let updatedCount = 0;
            
            allOrders.forEach(order => {
                // Check if this order is currently scheduled
                const scheduledEvent = scheduledEvents.find(event => 
                    event.taskId === order.id || 
                    event.odp_id === order.id || 
                    event.odp_number === order.id
                );
                
                const updateData = {
                    updated_at: new Date().toISOString()
                };
                
                if (scheduledEvent) {
                    // Order is scheduled - update status, production start, and production end
                    const newStatus = 'SCHEDULED';
                    const newProductionStart = this.calculate_production_start_from_event(scheduledEvent);
                    const newProductionEnd = this.calculate_production_end_from_event(scheduledEvent);
                    
                    if (order.status !== newStatus || 
                        order.production_start !== newProductionStart ||
                        order.production_end !== newProductionEnd) {
                        
                        updateData.status = newStatus;
                        updateData.production_start = newProductionStart;
                        updateData.production_end = newProductionEnd;
                        
                        this.storageService.update_odp_order(order.id, updateData);
                        updatedCount++;
                        
                        if (window.DEBUG) {
                            console.log(`Updated ODP ${order.odp_number}: status=${newStatus}, production_start=${newProductionStart}, production_end=${newProductionEnd}`);
                        }
                    }
                } else {
                    // Order is not scheduled - clear status, production start, and production end
                    const newStatus = 'NOT SCHEDULED';
                    const newProductionStart = null;
                    const newProductionEnd = null;
                    
                    if (order.status !== newStatus || 
                        order.production_start !== newProductionStart ||
                        order.production_end !== newProductionEnd) {
                        
                        updateData.status = newStatus;
                        updateData.production_start = newProductionStart;
                        updateData.production_end = newProductionEnd;
                        
                        this.storageService.update_odp_order(order.id, updateData);
                        updatedCount++;
                        
                        if (window.DEBUG) {
                            console.log(`Updated ODP ${order.odp_number}: status=${newStatus}, production_start=null, production_end=null`);
                        }
                    }
                }
            });
            
            // Reload the backlog to show all updates
            this.load_backlog();
            
            if (window.DEBUG) {
                console.log(`Sync completed. Updated ${updatedCount} ODP orders`);
            }
            
            // Show success message
            this.show_success_message(`Synced ${updatedCount} production orders with Gantt chart`);
            
        } catch (error) {
            console.error('Error syncing ODP orders with Gantt:', error);
            this.show_error_message('syncing with Gantt chart', error);
        }
    }

    /**
     * Calculate production start timestamp from a scheduled event
     * @param {Object} event - The scheduled event
     * @returns {string|null} - ISO timestamp string or null
     */
    calculate_production_start_from_event(event) {
        try {
            if (!event || !event.date || event.startHour === undefined) {
                return null;
            }
            
            // Create date from event date string (YYYY-MM-DD format)
            const startDate = new Date(event.date);
            if (isNaN(startDate.getTime())) {
                return null;
            }
            
            // Set the hour from the event
            startDate.setHours(event.startHour, 0, 0, 0);
            
            return startDate.toISOString();
        } catch (error) {
            console.error('Error calculating production start from event:', error);
            return null;
        }
    }

    /**
     * Calculate production end timestamp from a scheduled event
     * @param {Object} event - The scheduled event
     * @returns {string|null} - ISO timestamp string or null
     */
    calculate_production_end_from_event(event) {
        try {
            if (!event || !event.date || event.startHour === undefined || event.duration === undefined) {
                return null;
            }
            
            // Create date from event date string (YYYY-MM-DD format)
            const startDate = new Date(event.date);
            if (isNaN(startDate.getTime())) {
                return null;
            }
            
            // Calculate end time: start hour + duration
            const endHour = event.startHour + event.duration;
            const endDate = new Date(startDate);
            endDate.setHours(endHour, 0, 0, 0);
            
            return endDate.toISOString();
        } catch (error) {
            console.error('Error calculating production end from event:', error);
            return null;
        }
    }



    /**
     * Debug method to show current scheduled events and ODP orders
     */
    debug_scheduled_events() {
        try {
            const scheduledEvents = this.storageService.get_scheduled_events() || [];
            const allOrders = this.storageService.get_odp_orders() || [];
            
            console.log('=== DEBUG: SCHEDULED EVENTS ===');
            console.log('Total scheduled events:', scheduledEvents.length);
            scheduledEvents.forEach((event, index) => {
                console.log(`Event ${index + 1}:`, event);
            });
            
            console.log('=== DEBUG: ODP ORDERS ===');
            console.log('Total ODP orders:', allOrders.length);
            allOrders.forEach((order, index) => {
                console.log(`Order ${index + 1}:`, {
                    id: order.id,
                    odp_number: order.odp_number,
                    status: order.status
                });
            });
            
            // Show current status for each order
            console.log('=== DEBUG: CURRENT STATUSES ===');
            allOrders.forEach(order => {
                console.log(`Order ${order.odp_number} (${order.id}): status=${order.status}, production_start=${order.production_start}, production_end=${order.production_end}, progress=${order.progress}%`);
            });

        } catch (error) {
            console.error('Error in debug method:', error);
        }
    }

    /**
     * Format production start timestamp for display
     * @param {string} timestamp - ISO timestamp string
     * @returns {string} - Formatted date and time
     */
    format_production_start(timestamp) {
        try {
            if (!timestamp) return '-';
            
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '-';
            
            // Format: "DD/MM/YYYY HH:MM"
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formatting production start:', error);
            return '-';
        }
    }

    clear_validation_errors() {
        // Clear validation error messages
        const errorElements = document.querySelectorAll('.validation_error');
        errorElements.forEach(error => {
            error.style.display = 'none';
            error.textContent = '';
        });
    }
}

// Initialize when all resources are loaded and storage service is available
window.addEventListener('load', () => {
    BaseManager.initialize_manager(BacklogManager, 'backlogManager');
});
