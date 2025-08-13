/**
 * Navigation Component - Reusable navigation header
 * Generates consistent navigation across all pages
 */
class Navigation {
    constructor(current_page = '') {
        this.current_page = current_page;
        this.navigation_data = {
            logo: {
                href: 'index.html'
            },
                    pages: {
            home: { href: 'index.html', label: 'Home', icon: '🏠' },
            machinery: { href: 'machinery-page.html', label: 'Machinery', icon: '⚙️' },
            phases: { href: 'phases-page.html', label: 'Phases', icon: '🔄' },
            backlog: { href: 'backlog-page.html', label: 'Backlog', icon: '📝' },
            scheduler: { href: 'scheduler-page.html', label: 'Scheduler', icon: '📅' }
        }
        };
    }
    /**
     * Generate sidebar navigation HTML
     */
    generate_nav_html() {
        return `
            <div class="sidebar">
                <div class="sidebar-logo">
                    <a href="${this.navigation_data.logo.href}">
                        <img src="../assets/logo.svg" alt="Flexi">
                    </a>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Navigation</div>
                    <nav class="sidebar-nav">
                        <ul>
                            ${Object.entries(this.navigation_data.pages).map(([key, page]) => `
                                <li>
                                    <a href="${page.href}" class="${key === this.current_page ? 'active' : ''}">
                                        <span class="nav-icon">${page.icon}</span>
                                        <span>${page.label}</span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                </div>
            </div>
            <button class="mobile-menu-toggle" type="button" aria-label="Toggle navigation" onclick="toggle_sidebar()">
                <span style="font-size: 20px;">☰</span>
            </button>
        `;
    }
    /**
     * Get appropriate navigation links based on current page
     */
    get_navigation_links() {
        switch (this.current_page) {
            case 'home':
                return [
                    { href: this.navigation_data.pages.machinery.href, label: 'Log in' }
                ];
            case 'machinery':
                return [
                    this.navigation_data.pages.phases,
                    this.navigation_data.pages.backlog,
                    this.navigation_data.pages.scheduler
                ];
            case 'phases':
                return [
                    this.navigation_data.pages.machinery,
                    this.navigation_data.pages.backlog,
                    this.navigation_data.pages.scheduler
                ];
            case 'backlog':
                return [
                    this.navigation_data.pages.machinery,
                    this.navigation_data.pages.phases,
                    this.navigation_data.pages.scheduler
                ];
            case 'scheduler':
                return [
                    this.navigation_data.pages.machinery,
                    this.navigation_data.pages.phases,
                    this.navigation_data.pages.backlog
                ];
            case 'machine-settings':
                return [
                    { href: this.navigation_data.pages.machinery.href, label: 'Back to Machinery' },
                    this.navigation_data.pages.scheduler
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
    inject_into(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (container) {
            container.innerHTML = this.generate_nav_html();
        } else {
        }
    }
    /**
     * Replace an existing header element
     */
    replace_header() {
        const existingHeader = document.querySelector('header');
        if (existingHeader && existingHeader.parentNode) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.generate_nav_html();
            const newHeader = tempDiv.firstElementChild;
            existingHeader.parentNode.replaceChild(newHeader, existingHeader);
        }
    }
    /**
     * Insert navigation at the beginning of page container
     */
    prepend_to_page_container() {
        const pageContainer = document.querySelector('.page-container');
        if (pageContainer) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.generate_nav_html();
            const headerElement = tempDiv.firstElementChild;
            pageContainer.insertBefore(headerElement, pageContainer.firstChild);
        }
    }
}
/**
 * Auto-initialize navigation based on page detection
 */
function initialize_navigation() {
    // Auto-detect current page from URL or page-specific elements
    let currentPage = '';
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path === '') {
        currentPage = 'home';
    } else if (path.includes('machinery-page.html')) {
        currentPage = 'machinery';
    } else if (path.includes('phases-page.html')) {
        currentPage = 'phases';
    } else if (path.includes('backlog-page.html')) {
        currentPage = 'backlog';
    } else if (path.includes('scheduler-page.html')) {
        currentPage = 'scheduler';
    } else if (path.includes('machine-settings-page.html')) {
        currentPage = 'machine-settings';
    }
    // Alternative detection based on page elements
    if (!currentPage) {
        if (document.getElementById('backlog-table-body')) {
            currentPage = 'backlog';
        } else if (document.getElementById('machinery-table-body')) {
            currentPage = 'machinery';
        } else if (document.getElementById('phases-table-body')) {
            currentPage = 'phases';
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
    document.body.insertAdjacentHTML('afterbegin', navigation.generate_nav_html());
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
function toggle_sidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}
// Export for manual usage
if (typeof window !== 'undefined') {
    window.Navigation = Navigation;
    window.initialize_navigation = initialize_navigation;
    window.toggle_sidebar = toggle_sidebar;
}
// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize_navigation);
