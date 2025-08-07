/**
 * Shared Utilities - Common functions used across the application
 * Consolidates duplicate code to follow DRY principles
 */
class Utils {
    /**
     * Format date for display (YYYY-MM-DD)
     */
    static formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }



    /**
     * Format hour for display (H:00)
     */
    static formatHour(hour) {
        return `${hour}:00`;
    }

    static getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday
        return new Date(d.setDate(diff));
    }

    static getDayName(dayIndex, short = false) {
        const dayNames = short ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : 
                                   ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return dayNames[dayIndex];
    }

    static isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }



    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }



    /**
     * Generate unique ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Validate required fields
     */
    static validateRequiredFields(data, requiredFields) {
        const errors = [];
        
        requiredFields.forEach(field => {
            if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
                errors.push(`${field} is required`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Show message (fallback if no banner system available)
     */
    static showMessage(message, type = 'info') {
        if (typeof showBanner === 'function') {
            showBanner(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Machine-ODP Compatibility Checker
     * Verifies if a machine is compatible with an ODP order
     */
    static isCompatible(machine, odp) {
        // Check if both machine and ODP have required fields
        if (!machine || !odp) {
            return { compatible: false, reasons: ['Missing machine or ODP data'] };
        }

        const reasons = [];

        // 1. Check work center compatibility
        if (machine.site && odp.work_center && machine.site !== odp.work_center) {
            reasons.push(`Work center mismatch: Machine is at ${machine.site}, ODP requires ${odp.work_center}`);
        }

        // 2. Check web width compatibility (bag_width vs machine web width)
        const bagWidth = parseInt(odp.bag_width) || 0;
        const minWebWidth = parseInt(machine.min_web_width) || 0;
        const maxWebWidth = parseInt(machine.max_web_width) || 0;
        
        if (bagWidth > 0 && maxWebWidth > 0) {
            if (bagWidth < minWebWidth) {
                reasons.push(`Bag width too small: ${bagWidth}mm < minimum ${minWebWidth}mm`);
            }
            if (bagWidth > maxWebWidth) {
                reasons.push(`Bag width too large: ${bagWidth}mm > maximum ${maxWebWidth}mm`);
            }
        }

        // 3. Check bag height compatibility
        const bagHeight = parseInt(odp.bag_height) || 0;
        const minBagHeight = parseInt(machine.min_bag_height) || 0;
        const maxBagHeight = parseInt(machine.max_bag_height) || 0;
        
        if (bagHeight > 0 && maxBagHeight > 0) {
            if (bagHeight < minBagHeight) {
                reasons.push(`Bag height too small: ${bagHeight}mm < minimum ${minBagHeight}mm`);
            }
            if (bagHeight > maxBagHeight) {
                reasons.push(`Bag height too large: ${bagHeight}mm > maximum ${maxBagHeight}mm`);
            }
        }

        // 4. Check machine type vs processing type compatibility
        const machineType = machine.machine_type || machine.type;
        const tipoLavorazione = odp.tipo_lavorazione;
        
        if (machineType && tipoLavorazione) {
            const printingMachines = ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE', 'printing'];
            const packagingMachines = ['PACKAGING', 'DOYPACK', 'packaging'];
            
            if (tipoLavorazione === 'printing' && !printingMachines.includes(machineType)) {
                reasons.push(`Machine type incompatible: ${machineType} cannot perform printing operations`);
            }
            
            if (tipoLavorazione === 'packaging' && !packagingMachines.includes(machineType)) {
                reasons.push(`Machine type incompatible: ${machineType} cannot perform packaging operations`);
            }
        }

        return {
            compatible: reasons.length === 0,
            reasons: reasons,
            score: reasons.length === 0 ? 100 : Math.max(0, 100 - (reasons.length * 25))
        };
    }

    /**
     * Get compatibility status for display
     */
    static getCompatibilityStatus(machine, odp) {
        const result = Utils.isCompatible(machine, odp);
        
        if (result.compatible) {
            return { status: 'compatible', icon: '✅', message: 'Compatible' };
        } else if (result.score > 50) {
            return { status: 'warning', icon: '⚠️', message: 'Partially compatible' };
        } else {
            return { status: 'incompatible', icon: '❌', message: 'Incompatible' };
        }
    }

    /**
     * Material calculation utilities
     */
    static calculateMaterialQuantity(mtLineari, fascia) {
        // MQ_INCARTO = MT_LINEARI * (FASCIA / 1000)
        const mtLineariNum = parseFloat(mtLineari) || 0;
        const fasciaNum = parseFloat(fascia) || 0;
        return mtLineariNum * (fasciaNum / 1000);
    }

    /**
     * Printing cost calculation
     */
    static calculatePrintingCost(tStampaMin, tSetupStampa, costoHStampa) {
        // COSTO_STAMPA = (T_STAMPA_MIN + T_SETUP_STAMPA) * (COSTO_H_STAMPA / 60)
        const totalTime = (parseFloat(tStampaMin) || 0) + (parseFloat(tSetupStampa) || 0);
        const hourlyRate = parseFloat(costoHStampa) || 0;
        return totalTime * (hourlyRate / 60);
    }

    /**
     * Packaging cost calculation
     */
    static calculatePackagingCost(tConfOre, tSetupConf, costoHConf) {
        // COSTO_CONF = (T_CONF_ORE + (T_SETUP_CONF / 60)) * COSTO_H_CONF
        const confTime = parseFloat(tConfOre) || 0;
        const setupTimeHours = (parseFloat(tSetupConf) || 0) / 60;
        const hourlyRate = parseFloat(costoHConf) || 0;
        return (confTime + setupTimeHours) * hourlyRate;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}