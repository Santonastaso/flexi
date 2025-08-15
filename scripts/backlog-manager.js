/**
 * Backlog Manager - Manages production orders (ODP) in the backlog
 */
import { BaseManager } from './baseManager.js';
import { ValidationService } from './validationService.js';
import { BusinessLogicService } from './businessLogicService.js';
import { storageService } from './storageService.js';
import { editManager } from './editManager.js';
import { Utils } from './utils.js';

export class BacklogManager extends BaseManager {
    constructor() {
        super(null);
        this.editManager = editManager;
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        this.storageService = storageService;
    }

    init(elementMap) {
        // Set up storage service reference
        this.storageService = storageService;
        
        if (!this.validate_storage_service()) return false;
        
        if (super.init(elementMap)) {
            this.load_backlog(); // This is now async but we don't await to avoid blocking
            this.setup_form_validation();
            
            // Attach event listeners for form interactions
            this.attach_event_listeners();
            
            // Initialize bag preview
            this.update_bag_preview();
        
        // Initialize edit functionality
        if (this.editManager) {
                const tableBody = document.querySelector('#backlog_table_body');
                if (tableBody) {
                    this.editManager.init_table_edit(tableBody);
                    this.editManager.register_save_handler(tableBody, (row) => this.save_edit(row));
                    
                    // Add delete event listener
                                        tableBody.addEventListener('deleteRow', async (e) => {
                    const row = e.detail.row;
                        const odpId = row.dataset.odpId;
                        if (odpId) {
                            await this.delete_odp_order(odpId);
                    }
                });
            }
            }
            
            return true;
        }
        
        return false;
    }

    get_element_map() {
        const elementIds = [
            // Form elements
            'odp_number',
            'article_code',
            'production_lot',
            'work_center',
            'nome_cliente',
            'description',
            'delivery_date',
            'bag_height',
            'bag_width',
            'bag_step',
            'seal_sides',
            'product_type',
            'quantity',
            'department',
            'fase',
            'internal_customer_code',
            'external_customer_code',
            'customer_order_ref',
            'calculate_btn',
            'create_task',
            'update_statuses_btn',
            'debug_events_btn',
            'backlog_table_body',
            // Preview elements
            'preview_fascia',
            'preview_altezza',
            'preview_passo'
        ];
        
        // Get elements using base class helper
        return this.get_elements_by_id(elementIds);
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

                this.handle_create_task();
            });
        }

        // Department and work center changes should trigger phase dropdown repopulation
        if (this.elements.department) {
            this.elements.department.addEventListener('change', () => {
                this.populate_phases_dropdown().catch(error => {
                    console.error('Error repopulating phases dropdown:', error);
                });
            });
        }
        
        if (this.elements.work_center) {
            this.elements.work_center.addEventListener('change', () => {
                this.populate_phases_dropdown().catch(error => {
                    console.error('Error repopulating phases dropdown:', error);
                });
            });
        }

        // Update statuses button
        if (this.elements.update_statuses_btn) {
            this.elements.update_statuses_btn.addEventListener('click', () => {

                this.sync_all_odp_with_gantt();
            });
        }

        // Bag specification preview updates
        if (this.elements.bag_width) {
            this.elements.bag_width.addEventListener('input', () => this.update_bag_preview());
        }
        if (this.elements.bag_height) {
            this.elements.bag_height.addEventListener('input', () => this.update_bag_preview());
        }
        if (this.elements.bag_step) {
            this.elements.bag_step.addEventListener('input', () => this.update_bag_preview());
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

        // Populate phases dropdown (async, but don't block initialization)
        this.populate_phases_dropdown().catch(error => {
            console.error('Error populating phases dropdown:', error);
        });
        
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
            this.populate_phases_dropdown().catch(error => {
                console.error('Error populating phases dropdown:', error);
            });
            
            // Re-validate form after automation
            this.validate_form_fields();
        }
    }

    validate_form_fields(updateButtonState = true) {
        // Collect form data for comprehensive validation
        const formData = this.collect_form_data();
        
        // Use ValidationService for comprehensive ODP validation
        const validation = this.validationService.validate_odp(formData, { context: 'form', returnFieldMapping: true });
        const isValid = Object.keys(validation.errors).length === 0;
        
        // Clear previous validation errors
        this.clear_validation_errors();
        
        // Show validation errors if any
        if (!isValid) {
            Object.entries(validation.errors).forEach(([field, errorMessage]) => {
                this.show_validation_error(field, errorMessage);
            });
        }
        
        // Only update button state if requested (not during form submission)
        if (updateButtonState) {
            // Enable/disable both calculate and create task buttons based on validation
            if (this.elements.calculate_btn) {
                this.elements.calculate_btn.disabled = !isValid;
            }
            
            // Create task button should also be disabled until validation passes
            if (this.elements.create_task) {
                this.elements.create_task.disabled = !isValid;
            }
        }
        
        // Temporary debugging - remove this later
        if (window.DEBUG) {
            console.log(`Form validation result: ${isValid}`, validation.errors);
        }
        
        return isValid;
    }

    collect_form_data() {
        return {
            odp_number: this.elements.odp_number?.value?.trim() || '',
            article_code: this.elements.article_code?.value?.trim() || '',
            production_lot: this.elements.production_lot?.value?.trim() || '',
            work_center: this.elements.work_center?.value?.trim() || '',
            nome_cliente: this.elements.nome_cliente?.value?.trim() || '',
            delivery_date: this.elements.delivery_date?.value?.trim() || '',
            bag_height: this.elements.bag_height?.value?.trim() || '',
            bag_width: this.elements.bag_width?.value?.trim() || '',
            bag_step: this.elements.bag_step?.value?.trim() || '',
            seal_sides: this.elements.seal_sides?.value?.trim() || '',
            product_type: this.elements.product_type?.value?.trim() || '',
            quantity: this.elements.quantity?.value?.trim() || '',
            fase: this.elements.fase?.value?.trim() || '',
            department: this.elements.department?.value?.trim() || ''
        };
    }

    clear_validation_errors() {
        // Clear all validation error spans
        const errorSpans = document.querySelectorAll('.validation_error');
        errorSpans.forEach(span => {
            span.style.display = 'none';
            span.textContent = '';
        });
    }

    show_validation_error(fieldName, errorMessage) {
        // Show error for specific field
        const errorSpan = document.getElementById(`${fieldName}_error`);
        if (errorSpan) {
            errorSpan.textContent = errorMessage;
            errorSpan.style.display = 'block';
        }
    }

    /**
     * Update the bag specification visual preview
     */
    update_bag_preview() {
        const fascia = this.elements.bag_width ? this.elements.bag_width.value : '';
        const altezza = this.elements.bag_height ? this.elements.bag_height.value : '';
        const passo = this.elements.bag_step ? this.elements.bag_step.value : '';

        // Update the visual preview text elements
        if (this.elements.preview_fascia) {
            this.elements.preview_fascia.textContent = fascia || '-';
        }
        if (this.elements.preview_altezza) {
            this.elements.preview_altezza.textContent = altezza || '-';
        }
        if (this.elements.preview_passo) {
            this.elements.preview_passo.textContent = passo || '-';
        }
    }

    async handle_calculate() {
        try {
            // Validate required fields first
            if (!this.validate_form_fields()) {
                this.show_error_message('validating form fields', new Error('Please fill in all required fields before calculating'));
                return;
            }

            // Get the selected phase
            const selectedPhaseId = this.elements.fase.value;
            if (!selectedPhaseId) {
                this.show_error_message('validating phase selection', new Error('Please select a production phase'));
                return;
            }

            // Get phase details from storage
            const phases = await this.storageService.get_phases();
            
            console.log('Available phases:', phases);
            console.log('Selected phase ID:', selectedPhaseId);
            
            const selectedPhase = phases.find(phase => phase.id === selectedPhaseId);
            
            console.log('Selected phase found:', selectedPhase);
            
            if (!selectedPhase) {
                this.show_error_message('finding selected phase', new Error('Selected phase not found'));
                return;
            }

            // Get form values
            const quantity = parseInt(this.elements.quantity.value) || 0;
            const bagStep = parseInt(this.elements.bag_step.value) || 0;

            // Calculate results
            const results = this.calculate_production_metrics(selectedPhase, quantity, bagStep);
            
            console.log('Calculation results:', results);
            
            // Display results
            this.display_calculation_results(results);
            
            // Show success message
            this.show_success_message('Calculation completed successfully');
            
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Calculation failed');
            this.show_error_message('calculating production metrics', errorObj);
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
            results.printing.processing_time = Math.round((metersToPrint / phase.v_stampa) * 100) / 100;
            
            // Setup time from phase (round to 2 decimals)
            results.printing.setup_time = Math.round((phase.t_setup_stampa || 0) * 100) / 100;
            
            // Total printing time: tempo_stampa + tempo_setUP_fase_stampa
            results.printing.total_time = Math.round((results.printing.processing_time + results.printing.setup_time) * 100) / 100;
            
            // Printing cost: tempo_ODP_totale_Stampa * costo_orario_fase
            results.printing.cost = Math.round((results.printing.total_time * (phase.costo_h_stampa || 0)) * 100) / 100;
        }

        // Calculate packaging metrics if phase has packaging parameters
        if (phase.department === 'CONFEZIONAMENTO' && phase.v_conf > 0) {
            // Calculate packaging time: pezzi_ODP / velocità_fase_confezionamento
            results.packaging.processing_time = Math.round((quantity / phase.v_conf) * 100) / 100;
            
            // Setup time from phase (round to 2 decimals)
            results.packaging.setup_time = Math.round((phase.t_setup_conf || 0) * 100) / 100;
            
            // Total packaging time: tempo_confezionamento + tempo_setUP_fase_confezionamento
            results.packaging.total_time = Math.round((results.packaging.processing_time + results.packaging.setup_time) * 100) / 100;
            
            // Packaging cost: tempo_ODP_totale * costo_orario_fase
            results.packaging.cost = Math.round((results.packaging.total_time * (phase.costo_h_conf || 0)) * 100) / 100;
        }

        // Calculate totals (round to 2 decimals)
        results.totals.duration = Math.round((results.printing.total_time + results.packaging.total_time) * 100) / 100;
        results.totals.cost = Math.round((results.printing.cost + results.packaging.cost) * 100) / 100;


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

        // Create task button state is now controlled by form validation
        // No need to manually enable it after calculation
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
        
        // Create task button state is controlled by form validation
    }

    async handle_create_task() {
        // Prevent double submission
        if (this.elements.create_task.disabled) {
            console.log('Create task button already disabled, preventing double submission');
            return;
        }
        
        // Disable button immediately to prevent multiple submissions
        this.elements.create_task.disabled = true;
        
        // Validate form before starting the process (don't update button state)
        if (!this.validate_form_fields(false)) {
            this.show_error_message('validating form fields', new Error('Please fill in all required fields before creating the task'));
            // Re-enable button on validation failure
            this.elements.create_task.disabled = false;
            return;
        }
        
        // Temporary debugging - remove this later
        if (window.DEBUG) {
            console.log('handle_create_task called');
        }
        
        try {
            // Perform comprehensive validation using ValidationService
            const formData = this.collect_form_data();
            const validation = this.validationService.validate_odp(formData, { context: 'submission' });
            
            if (!validation.isValid) {
                this.show_error_message('validating production order', new Error('Validation failed: ' + validation.errors.join(', ')));
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

            // Debug: Check the fase value
            console.log('Fase value being sent:', orderData.fase);
            console.log('Fase element value:', this.elements.fase.value);
            console.log('Fase element options:', this.elements.fase.options);

            // Add the order to storage
        if (window.DEBUG) {
                console.log('About to add order to storage:', orderData);
                console.log('Duration being sent:', orderData.duration);
                console.log('Cost being sent:', orderData.cost);
            }
            
            const newOrder = await this.storageService.add_odp_order(orderData);
        
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
            
            // Task created successfully - button should stay disabled until next calculation
            // The clear_form_fields() above will reset the form, so validation will disable the button
            
        } catch (error) {
            // Ensure error object has proper message property
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Unknown error occurred');
            this.show_error_message('creating production order', errorObj);
            // Re-enable button on error so user can retry
            if (this.elements.create_task) {
                this.elements.create_task.disabled = false;
            }
        }
    }

    async load_backlog() {
        try {
            // Load existing backlog items
            const backlogItems = await this.storageService.get_odp_orders() || [];
            
            if (window.DEBUG) {
                console.log('Loading backlog items:', backlogItems);
            }
            
            // Render the backlog (status sync is now manual via button)
            this.render_backlog(backlogItems);
        } catch (error) {
            console.error('Error loading backlog:', error);
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to load backlog');
            this.show_error_message('loading backlog', errorObj);
            // Render empty table on error
            this.render_backlog([]);
        }
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
                            { value: '4', label: '4 sides' }
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
                    <span class="static-value">${item.production_end ? this.format_production_end(item.production_end) : '-'}</span>
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
                <td class="editable-cell" data-field="scheduled_machine">
                    <span class="static-value">${Utils.escape_html(item.scheduled_machine || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', item.scheduled_machine) : ''}
                </td>
                
                <td class="text-center">
                    ${this.editManager ? this.editManager.create_action_buttons() : ''}
                </td>
            </tr>
        `;
    }

    async save_edit(row) {
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
            const currentOrder = await this.storageService.get_odp_order_by_id(odpId);
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
            await this.storageService.update_odp_order(odpId, updatedOrder);

            // Exit edit mode
            this.editManager.cancel_edit(row);

            // Update display
            this.load_backlog();
            this.show_success_message('ODP order updated');

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to update ODP order');
            this.show_error_message('updating ODP order', errorObj);
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
        this.populate_phases_dropdown().catch(error => {
            console.error('Error populating phases dropdown:', error);
        });
        
        // Re-validate form to update button state
        this.validate_form_fields();
        
        // Update bag preview to show cleared values
        this.update_bag_preview();
    }

    async populate_phases_dropdown() {
        try {
            const phases = await this.storageService.get_phases();
            const faseDropdown = this.elements.fase;
            
            console.log('Populating phases dropdown with phases:', phases);
            console.log('Fase dropdown element:', faseDropdown);
            
            if (faseDropdown && phases && phases.length > 0) {
                // Clear existing options except the first placeholder
                faseDropdown.innerHTML = '<option value="">Select production phase</option>';
                
                // Add phases based on the determined department and work center
                const department = this.elements.department.value;
                const workCenter = this.elements.work_center.value;
                
                let relevantPhases = phases;
                
                // Apply filters based on what's selected
                if (department || workCenter) {
                    relevantPhases = phases.filter(phase => {
                        const departmentMatch = !department || phase.department === department;
                        const workCenterMatch = !workCenter || phase.work_center === workCenter;
                        return departmentMatch && workCenterMatch;
                    });
                }
                
                relevantPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id;  // Use UUID as value
                    option.textContent = phase.name;  // Use name as display text
                    faseDropdown.appendChild(option);
                });
            }
        } catch (error) {
            // Error populating phases dropdown
        }
    }

    async delete_odp_order(odpId) {
        try {
            // Get current ODP order for confirmation message
            const currentOrder = await this.storageService.get_odp_order_by_id(odpId);
            const orderName = currentOrder ? currentOrder.odp_number : 'this ODP order';
            
            const message = `Are you sure you want to delete "${orderName}"? This action cannot be undone.`;
            
            show_delete_confirmation(message, async () => {
                try {
                    await this.storageService.remove_odp_order(odpId);
                    await this.load_backlog();
                    this.show_success_message('ODP order deleted');
        } catch (error) {
                    const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to delete ODP order');
                    this.show_error_message('deleting ODP order', errorObj);
                }
            });
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to delete ODP order');
            this.show_error_message('deleting ODP order', errorObj);
        }
    }





    /**
     * Sync all ODP orders with current Gantt data
     * Updates both status and production start based on what's actually scheduled
     */
    async sync_all_odp_with_gantt() {
        try {
            const allOrders = await this.storageService.get_odp_orders() || [];
            const scheduledEvents = await this.storageService.get_scheduled_events() || [];
            
            if (window.DEBUG) {
                console.log(`Syncing ${allOrders.length} ODP orders with ${scheduledEvents.length} scheduled events`);
                console.log('Sample scheduled event:', scheduledEvents[0]);
                console.log('Sample ODP order:', allOrders[0]);
            }
            
            let updatedCount = 0;
            
            for (const order of allOrders) {
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
                    
                    if (window.DEBUG) {
                        console.log(`Debug - ODP ${order.odp_number}:`, {
                            currentStatus: order.status,
                            newStatus: newStatus,
                            currentProductionStart: order.production_start,
                            newProductionStart: newProductionStart,
                            currentProductionEnd: order.production_end,
                            newProductionEnd: newProductionEnd,
                            scheduledEvent: {
                                start_time: scheduledEvent.start_time,
                                end_time: scheduledEvent.end_time,
                                date: scheduledEvent.date,
                                startHour: scheduledEvent.startHour,
                                duration: scheduledEvent.duration
                            },
                            // Debug the actual date objects
                            startDateObj: newProductionStart ? new Date(newProductionStart) : null,
                            endDateObj: newProductionEnd ? new Date(newProductionEnd) : null,
                            startDateString: newProductionStart ? new Date(newProductionStart).toDateString() : null,
                            endDateString: newProductionEnd ? new Date(newProductionEnd).toDateString() : null
                        });
                    }
                    
                    if (order.status !== newStatus || 
                        order.production_start !== newProductionStart ||
                        order.production_end !== newProductionEnd) {
                        
                        updateData.status = newStatus;
                        updateData.production_start = newProductionStart;
                        updateData.production_end = newProductionEnd;
                        
                        if (window.DEBUG) {
                            console.log(`Debug - Updating ODP ${order.odp_number} with:`, updateData);
                        }
                        
                        await this.storageService.update_odp_order(order.id, updateData);
                        updatedCount++;
                        
                        if (window.DEBUG) {
                            console.log(`Updated ODP ${order.odp_number}: status=${newStatus}, production_start=${newProductionStart}, production_end=${newProductionEnd}`);
                        }
                    } else {
                        if (window.DEBUG) {
                            console.log(`Debug - ODP ${order.odp_number} already up to date, no changes needed`);
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
                        
                        await this.storageService.update_odp_order(order.id, updateData);
                        updatedCount++;
                        
                        if (window.DEBUG) {
                            console.log(`Updated ODP ${order.odp_number}: status=${newStatus}, production_start=null, production_end=null`);
                        }
                    }
                }
            }
            
            // Reload the backlog to show all updates
            await this.load_backlog();
            
            if (window.DEBUG) {
                console.log(`Sync completed. Updated ${updatedCount} ODP orders`);
            }
            
            // Show success message
            this.show_success_message(`Synced ${updatedCount} production orders with Gantt chart`);
            
        } catch (error) {
            console.error('Error syncing ODP orders with Gantt:', error);
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to sync with Gantt chart');
            this.show_error_message('syncing with Gantt chart', errorObj);
        }
    }

    /**
     * Calculate production start timestamp from a scheduled event
     * @param {Object} event - The scheduled event
     * @returns {string|null} - ISO timestamp string or null
     */
    calculate_production_start_from_event(event) {
        try {
            if (window.DEBUG) {
                console.log(`Debug - calculate_production_start_from_event called with:`, {
                    event: event,
                    hasStartTime: !!event.start_time,
                    hasDate: !!event.date,
                    hasStartHour: event.startHour !== undefined
                });
            }
            
            // Use new datetime structure if available
            if (event.start_time) {
                if (window.DEBUG) {
                    console.log(`Debug - Using new datetime structure: start_time = ${event.start_time}`);
                }
                return event.start_time;
            }
            
            // Fallback to legacy structure
            if (!event || !event.date || event.startHour === undefined) {
                if (window.DEBUG) {
                    console.log(`Debug - Legacy structure missing required fields:`, {
                        hasEvent: !!event,
                        hasDate: !!event?.date,
                        hasStartHour: event?.startHour !== undefined
                    });
                }
                return null;
            }
            
            // Create date from event date string (YYYY-MM-DD format)
            const startDate = new Date(event.date);
            if (isNaN(startDate.getTime())) {
                if (window.DEBUG) {
                    console.log(`Debug - Invalid date string: ${event.date}`);
                }
                return null;
            }
            
            // Set the hour from the event
            startDate.setHours(event.startHour, 0, 0, 0);
            const result = startDate.toISOString();
            
            if (window.DEBUG) {
                console.log(`Debug - Calculated from legacy structure: ${result}`);
            }
            
            return result;
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
            if (window.DEBUG) {
                console.log(`Debug - calculate_production_end_from_event called with:`, {
                    event: event,
                    hasEndTime: !!event.end_time,
                    hasDate: !!event.date,
                    hasStartHour: event.startHour !== undefined,
                    hasDuration: event.duration !== undefined
                });
            }
            
            // Use new datetime structure if available
            if (event.end_time) {
                if (window.DEBUG) {
                    console.log(`Debug - Using new datetime structure: end_time = ${event.end_time}`);
                }
                return event.end_time;
            }
            
            // Fallback to legacy structure
            if (!event || !event.date || event.startHour === undefined || event.duration === undefined) {
                if (window.DEBUG) {
                    console.log(`Debug - Legacy structure missing required fields:`, {
                        hasEvent: !!event,
                        hasDate: !!event?.date,
                        hasStartHour: event?.startHour !== undefined,
                        hasDuration: event?.duration !== undefined
                    });
                }
                return null;
            }
            
            // Create date from event date string (YYYY-MM-DD format)
            const startDate = new Date(event.date);
            if (isNaN(startDate.getTime())) {
                if (window.DEBUG) {
                    console.log(`Debug - Invalid date string: ${event.date}`);
                }
                return null;
            }
            
            // Calculate end time: start hour + duration
            const endHour = event.startHour + event.duration;
            const endDate = new Date(startDate);
            endDate.setHours(endHour, 0, 0, 0);
            const result = endDate.toISOString();
            
            if (window.DEBUG) {
                console.log(`Debug - Calculated from legacy structure: ${result}`);
            }
            
            return result;
        } catch (error) {
            console.error('Error calculating production end from event:', error);
            return null;
        }
    }



    /**
     * Debug method to show current scheduled events and ODP orders
     */
    async debug_scheduled_events() {
        try {
            const scheduledEvents = await this.storageService.get_scheduled_events() || [];
            const allOrders = await this.storageService.get_odp_orders() || [];
            
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

    /**
     * Format production end timestamp for display
     * @param {string} timestamp - ISO timestamp string
     * @returns {string} - Formatted date and time
     */
    format_production_end(timestamp) {
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
            console.error('Error formatting production end:', error);
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
