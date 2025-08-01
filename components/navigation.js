/**
 * Navigation Component - Reusable navigation header
 * Generates consistent navigation across all pages
 */
class Navigation {
    constructor(currentPage = '') {
        this.currentPage = currentPage;
        this.navigationData = {
            logo: {
                text: '🚢 Ship',
                href: 'index.html'
            },
            pages: {
                home: { href: 'index.html', label: 'Home' },
                machinery: { href: 'machinery.html', label: 'Manage Machinery' },
                backlog: { href: 'backlog.html', label: 'Manage Backlog' },
                scheduler: { href: 'scheduler_v2.html', label: 'Scheduler' }
            }
        };
    }
    
    /**
     * Generate navigation HTML based on current page
     */
    generateNavHTML() {
        const navLinks = this.getNavigationLinks();
        
        return `
            <header>
                <a href="${this.navigationData.logo.href}" class="logo">${this.navigationData.logo.text}</a>
                <nav>
                    ${navLinks.map(link => `<a href="${link.href}">${link.label}</a>`).join('')}
                </nav>
            </header>
        `;
    }
    
    /**
     * Get appropriate navigation links based on current page
     */
    getNavigationLinks() {
        switch (this.currentPage) {
            case 'home':
                return [
                    { href: this.navigationData.pages.machinery.href, label: 'Log in' }
                ];
            
            case 'machinery':
                return [
                    this.navigationData.pages.backlog,
                    this.navigationData.pages.scheduler
                ];
            
            case 'backlog':
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.scheduler
                ];
            
            case 'scheduler':
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.backlog
                ];
            
            case 'machine_settings':
                return [
                    { href: this.navigationData.pages.machinery.href, label: 'Back to Machinery' },
                    this.navigationData.pages.scheduler
                ];
            
            default:
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.backlog,
                    this.navigationData.pages.scheduler
                ];
        }
    }
    
    /**
     * Inject navigation into a container element
     */
    injectInto(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (container) {
            container.innerHTML = this.generateNavHTML();
        } else {
            console.warn(`Navigation container "${containerSelector}" not found`);
        }
    }
    
    /**
     * Replace an existing header element
     */
    replaceHeader() {
        const existingHeader = document.querySelector('header');
        if (existingHeader && existingHeader.parentNode) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.generateNavHTML();
            const newHeader = tempDiv.firstElementChild;
            existingHeader.parentNode.replaceChild(newHeader, existingHeader);
        }
    }
    
    /**
     * Insert navigation at the beginning of page container
     */
    prependToPageContainer() {
        const pageContainer = document.querySelector('.page-container');
        if (pageContainer) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.generateNavHTML();
            const headerElement = tempDiv.firstElementChild;
            pageContainer.insertBefore(headerElement, pageContainer.firstChild);
        }
    }
}

/**
 * Auto-initialize navigation based on page detection
 */
function initializeNavigation() {
    // Auto-detect current page from URL or page-specific elements
    let currentPage = '';
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path === '/' || path === '') {
        currentPage = 'home';
    } else if (path.includes('machinery.html')) {
        currentPage = 'machinery';
    } else if (path.includes('backlog.html')) {
        currentPage = 'backlog';
    } else if (path.includes('scheduler')) {
        currentPage = 'scheduler';
    } else if (path.includes('machine_settings.html')) {
        currentPage = 'machine_settings';
    }
    
    // Alternative detection based on page elements
    if (!currentPage) {
        if (document.getElementById('backlog-table-body')) {
            currentPage = 'backlog';
        } else if (document.getElementById('machinery-table-body')) {
            currentPage = 'machinery';
        } else if (document.getElementById('calendarContainer')) {
            currentPage = 'scheduler';
        } else if (document.getElementById('availability-calendar')) {
            currentPage = 'machine_settings';
        } else if (document.querySelector('.hero')) {
            currentPage = 'home';
        }
    }
    
    const navigation = new Navigation(currentPage);
    
    // Try to replace existing header first
    if (document.querySelector('header')) {
        navigation.replaceHeader();
    } else {
        // If no header exists, prepend to page container
        navigation.prependToPageContainer();
    }
}

// Export for manual usage
if (typeof window !== 'undefined') {
    window.Navigation = Navigation;
    window.initializeNavigation = initializeNavigation;
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeNavigation);