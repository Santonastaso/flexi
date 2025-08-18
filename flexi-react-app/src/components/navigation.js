/**
 * Navigation Component - Reusable navigation header
 * Generates consistent navigation across all pages
 */
export class Navigation {
    constructor(current_page = '') {
        this.current_page = current_page;
        this.navigation_config = {
            logo: {
                href: 'index.html'
            },
            pages: {
                home: { href: 'index.html', label: 'Home', icon: '🏠' },
                dashboard: { href: 'dashboard-page.html', label: 'Dashboard', icon: '📊' },
                machinery: { href: 'machinery-page.html', label: 'Machinery', icon: '⚙️' },
                phases: { href: 'phases-page.html', label: 'Phases', icon: '🔄' },
                backlog: { href: 'backlog-page.html', label: 'Backlog', icon: '📝' },
                scheduler: { href: 'scheduler-page.html', label: 'Scheduler', icon: '📅' }
            },
            // Page-specific navigation exclusions
            page_exclusions: {
                home: ['home'],
                dashboard: ['dashboard'],
                machinery: ['machinery'],
                phases: ['phases'],
                backlog: ['backlog'],
                scheduler: ['scheduler'],
                'machine-settings': ['machine-settings']
            },
            // Custom navigation items
            custom_navigation: {
                home: [{ href: 'machinery-page.html', label: 'Log in' }],
                'machine-settings': [{ href: 'machinery-page.html', label: 'Back to Machinery' }]
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
                    <a href="${this.navigation_config.logo.href}">
                        <img src="../assets/logo.svg" alt="Flexi">
                    </a>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Navigation</div>
                    <nav class="sidebar-nav">
                        <ul>
                            ${Object.entries(this.navigation_config.pages).map(([key, page]) => `
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
            <button class="mobile-menu-toggle" type="button" aria-label="Toggle navigation">
                <span style="font-size: 20px;">☰</span>
            </button>
        `;
    }
    /**
     * Get appropriate navigation links based on current page
     * Uses configuration-driven approach instead of switch statement
     */
    get_navigation_links() {
        // Check if page has custom navigation
        if (this.navigation_config.custom_navigation[this.current_page]) {
            return this.navigation_config.custom_navigation[this.current_page];
        }
        
        // Generate navigation by excluding current page
        const exclusions = this.navigation_config.page_exclusions[this.current_page] || [];
        return Object.entries(this.navigation_config.pages)
            .filter(([key, page]) => !exclusions.includes(key))
            .map(([key, page]) => page);
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
 * Toggle sidebar for mobile devices
 */
export function toggle_sidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

/**
 * Auto-initialize navigation based on page detection
 */
export function initialize_navigation() {
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
    
    const navigation = new Navigation(currentPage);
    
    // Inject sidebar at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', navigation.generate_nav_html());
    
    // Wrap page content in main-content div if not already wrapped
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer && !pageContainer.closest('.main-content')) {
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        pageContainer.parentNode.insertBefore(mainContent, pageContainer);
        mainContent.appendChild(pageContainer);
    }
    
    // Add event listener for mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggle_sidebar);
    }
}
