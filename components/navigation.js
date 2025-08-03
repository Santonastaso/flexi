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
                home: { href: 'index.html', label: 'Home', icon: '🏠' },
                machinery: { href: 'machinery.html', label: 'Machinery', icon: '⚙️' },
                machineCatalog: { href: 'products_catalog.html', label: 'Catalog', icon: '📋' },
                backlog: { href: 'backlog.html', label: 'Backlog', icon: '📝' },
                scheduler: { href: 'scheduler.html', label: 'Scheduler', icon: '📅' },
                dataIntegrity: { href: 'data_integrity.html', label: 'Data Integrity', icon: '🔍' }
            }
        };
    }
    
    /**
     * Generate sidebar navigation HTML
     */
    generateNavHTML() {
        return `
            <div class="sidebar">
                <div class="sidebar-logo">
                    <a href="${this.navigationData.logo.href}">${this.navigationData.logo.text}</a>
                </div>
                
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Navigation</div>
                    <nav class="sidebar-nav">
                        <ul>
                            ${Object.entries(this.navigationData.pages).map(([key, page]) => `
                                <li>
                                    <a href="${page.href}" class="${key === this.currentPage ? 'active' : ''}">
                                        <span class="nav-icon">${page.icon}</span>
                                        <span>${page.label}</span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                </div>
            </div>
            
            <button class="mobile-menu-toggle" onclick="toggleSidebar()">
                <span style="font-size: 20px;">☰</span>
            </button>
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
                    this.navigationData.pages.machineCatalog,
                    this.navigationData.pages.backlog,
                    this.navigationData.pages.scheduler
                ];
            
            case 'machineCatalog':
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.backlog,
                    this.navigationData.pages.scheduler
                ];
            
            case 'backlog':
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.machineCatalog,
                    this.navigationData.pages.scheduler
                ];
            
            case 'scheduler':
                return [
                    this.navigationData.pages.machinery,
                    this.navigationData.pages.machineCatalog,
                    this.navigationData.pages.backlog,
                    this.navigationData.pages.dataIntegrity
                ];
            
            case 'machine_settings':
                return [
                    { href: this.navigationData.pages.machinery.href, label: 'Back to Machinery' },
                    this.navigationData.pages.scheduler,
                    this.navigationData.pages.dataIntegrity
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
    } else if (path.includes('products_catalog.html')) {
        currentPage = 'machineCatalog';
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
        } else if (document.getElementById('machineryCatalogList')) {
            currentPage = 'machineCatalog';
        } else if (document.getElementById('calendarContainer')) {
            currentPage = 'scheduler';
        } else if (document.getElementById('availability-calendar')) {
            currentPage = 'machine_settings';
        } else if (document.querySelector('.hero')) {
            currentPage = 'home';
        }
    }
    
    const navigation = new Navigation(currentPage);
    
    // Inject sidebar navigation
    document.body.insertAdjacentHTML('afterbegin', navigation.generateNavHTML());
    
    // Wrap existing content in main-content div if not already wrapped
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer && !pageContainer.closest('.main-content')) {
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        
        // Move page container into main-content
        pageContainer.parentNode.insertBefore(mainContent, pageContainer);
        mainContent.appendChild(pageContainer);
    }
}

/**
 * Toggle sidebar for mobile devices
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Export for manual usage
if (typeof window !== 'undefined') {
    window.Navigation = Navigation;
    window.initializeNavigation = initializeNavigation;
    window.toggleSidebar = toggleSidebar;
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeNavigation);