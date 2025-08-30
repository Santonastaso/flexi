# Weekly Gantt View Feature

## Overview
The Gantt chart now supports two views:
1. **Daily View** (existing) - Shows detailed hourly scheduling for a single day
2. **Weekly View** (new) - Shows daily task overview for an entire week

## Implementation Details

### Features
- **View Selector**: Dropdown to switch between Daily and Weekly views
- **Weekly Layout**: 
  - X-axis: Days of the week (Sunday to Saturday)
  - Y-axis: Machines
  - Content: List of scheduled tasks for each machine on each day
- **Interactive Elements**:
  - Click on any task to navigate to its edit page
  - Hover tooltips showing task details
  - Visual indicators for today's date
  - Task count display
  - "More tasks" indicator when there are more than 3 tasks per day

### Code Structure
- **Component**: `WeeklyGanttView` in `GanttChart.jsx`
- **Reused Code**: Leverages the same date utilities and machine calendar structure
- **Minimal Changes**: Only added view selector and conditional rendering

### Key Functions
- `getStartOfWeek()` - Generates week dates from current date
- `getTasksForMachineAndDay()` - Filters tasks for specific machine and day
- `handleTaskClick()` - Navigation to task edit page
- `getDayTaskCount()` - Counts tasks per day for display

### Styling
- Responsive design for different screen sizes
- Consistent with existing design system
- Visual indicators for today and days with tasks
- Hover effects and transitions

### Performance Optimizations
- Memoized components and calculations
- Efficient filtering and rendering
- Conditional loading of machine availability data (only for daily view)

## Usage
1. Navigate to the Scheduler page
2. Use the view selector dropdown to switch between "Vista Giornaliera" and "Vista Settimanale"
3. In weekly view, click on any task to edit it
4. Use the date navigation to move between weeks

## Technical Notes
- Built with minimal code changes as requested
- Reuses existing date utilities and store structure
- Maintains all existing functionality
- Responsive and accessible design
