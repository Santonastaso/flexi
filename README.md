# Ship Production Suite - Refactored

A modular, scalable production management application refactored from a monolithic HTML structure into best-practice, component-based architecture.

## 📁 Project Structure

```
/project-root
├── pages/              → Clean HTML pages (structure only)
├── styles/             → Modular CSS files
├── scripts/            → JavaScript modules
├── components/         → Reusable components
├── assets/             → Static assets (fonts, icons, images)
└── *.html              → Redirect files to new structure
```

## 🎯 Refactoring Achievements

### ✅ Separation of Concerns
- **HTML**: Clean semantic structure only
- **CSS**: Modular stylesheets with consistent design system
- **JavaScript**: Object-oriented, modular architecture
- **Components**: Reusable UI elements

### ✅ Consistency & Maintainability
- Unified CSS custom properties for theming
- Consistent button styles and form patterns
- Centralized localStorage management
- BEM-style class naming conventions

### ✅ Scalability & Reusability
- Modular JavaScript classes
- Shared navigation component
- Centralized storage service
- Page-specific and shared CSS files

## 📂 Detailed File Structure

### `/pages/` - HTML Structure
- `index.html` - Home/landing page
- `backlog.html` - Task creation and management
- `machinery.html` - Machine management interface
- `machine_settings.html` - Machine availability calendar
- `scheduler.html` - Production scheduling interface

### `/styles/` - CSS Modules
- `main.css` - Global styles, typography, components
- `home.css` - Home page specific styles
- `scheduler.css` - Scheduler interface styles
- `calendar.css` - Calendar/availability styles

### `/scripts/` - JavaScript Modules
- `storageService.js` - Centralized localStorage management
- `backlogManager.js` - Task creation and management logic
- `machineryManager.js` - Machine CRUD operations
- `machineAvailabilityManager.js` - Availability calendar logic
- `scheduler.js` - Production scheduling with drag-and-drop

### `/components/` - Reusable Components
- `navigation.js` - Dynamic navigation component

## 🎨 Design System

### CSS Custom Properties
```css
:root {
    --bg-color: #f7f7f7;
    --text-dark: #1A1A1A;
    --text-light: #5f6368;
    --primary-green: #278762;
    --primary-blue: #2563eb;
    --border-color: #e5e7eb;
    --danger-red: #ef4444;
}
```

### Component Classes
- `.btn`, `.btn-primary`, `.btn-secondary` - Button styles
- `.form-grid`, `.form-group` - Form layouts
- `.modern-table` - Consistent table styling
- `.content-section` - Page content containers
- `.action-btn` - Icon buttons for actions

## 🔧 Architecture Patterns

### JavaScript Modules
Each page functionality is encapsulated in dedicated classes:

```javascript
class BacklogManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.attachEventListeners();
        this.renderBacklog();
    }
}
```

### Storage Service
Centralized data management:

```javascript
class StorageService {
    getMachines() { /* ... */ }
    getBacklogTasks() { /* ... */ }
    getScheduledEvents() { /* ... */ }
    validateTaskCanBeDeleted(taskId) { /* ... */ }
}
```

### Component System
Reusable navigation with automatic page detection:

```javascript
class Navigation {
    constructor(currentPage = '') {
        this.currentPage = currentPage;
        this.navigationData = { /* ... */ };
    }
    
    generateNavHTML() { /* ... */ }
    getNavigationLinks() { /* ... */ }
}
```

## 🚀 Getting Started

### Development
1. Clone the repository
2. Open `pages/index.html` in a web browser
3. Navigate through the application

### Production Deployment
- Serve files from a web server (Apache, Nginx, or any static host)
- All pages are client-side only (no server requirements)
- Data persists in localStorage

### File Dependencies
Each page loads only the CSS and JS it needs:

```html
<!-- Example: Backlog page -->
<link rel="stylesheet" href="../styles/main.css">
<script src="../scripts/storageService.js"></script>
<script src="../scripts/backlogManager.js"></script>
<script src="../components/navigation.js"></script>
```

## 🔄 Backward Compatibility

The original HTML files now redirect to the new modular structure, ensuring existing bookmarks and links continue to work.

## 📱 Responsive Design

- Mobile-first CSS approach
- Consistent breakpoints at 768px and 576px
- Responsive form grids and navigation
- Touch-friendly interface elements

## 🧪 Key Features

### Task Management
- Create, edit, and delete production tasks
- Color-coded task organization
- Duration tracking (setup + production time)

### Machine Management
- Add and configure production machines
- Live/offline status management
- City-based organization

### Availability Calendar
- Visual machine availability management
- Click-to-toggle time slot availability
- Integration with scheduled tasks

### Production Scheduler
- Drag-and-drop task scheduling
- Real-time conflict detection
- Visual timeline with time slots
- Machine-specific scheduling

## 🔐 Data Management

All data is stored in localStorage with the following keys:
- `schedulerMachines` - Machine configurations
- `backlogTasks` - Available tasks
- `scheduledEvents` - Scheduled production events
- `machineAvailability` - Machine availability data

## 🎯 Future Enhancements

The modular architecture enables easy extension:
- Add new pages by creating HTML + corresponding JS module
- Extend CSS design system with new components
- Replace localStorage with API integration
- Add user authentication and multi-tenancy
- Implement real-time updates with WebSockets

## 📝 Code Quality

- **Consistent naming**: BEM CSS, camelCase JavaScript
- **Error handling**: Try-catch blocks and validation
- **Documentation**: JSDoc comments throughout
- **Separation**: Clear boundaries between concerns
- **Reusability**: DRY principles applied consistently