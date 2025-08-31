# Improved Shunting Method Implementation

## Overview

The improved shunting method is a **simpler, more reliable approach** to task rescheduling that uses **gap detection** and **directional shunting** to resolve conflicts efficiently. This implementation replaces the previous complex cascading method with a more straightforward and predictable approach.

## How It Works

### 1. Gap Detection
The system analyzes the schedule to find **actual gaps** between tasks and determines if there's sufficient space for the dragged task.

### 2. Directional Shunting
Based on the user's choice (left or right), the system moves tasks in the specified direction to create space.

### 3. Sequential Placement
Tasks are placed sequentially in the new positions, ensuring no overlaps occur.

## Implementation Details

### Key Methods

#### `resolveConflictByShunting(conflictDetails, direction)`
The main entry point for shunting. It follows these steps:

1. **Task Analysis**: Get all scheduled tasks on the machine and sort them chronologically
2. **Gap Detection**: Find the minimum number of tasks that need to be moved to create space
3. **Directional Processing**: Apply left or right shunting logic
4. **Sequential Scheduling**: Place tasks in their new positions
5. **Database Update**: Apply all changes to the database

### Directional Logic

#### Right Shunting (`direction === 'right'`)
1. **Schedule dragged task first** at the proposed position
2. **Cascade affected tasks** to start after the dragged task ends
3. **Sequential placement** ensures no overlaps

#### Left Shunting (`direction === 'left'`)
1. **Work backwards** through affected tasks
2. **Schedule each task to end** before the next one starts
3. **Schedule dragged task last** at the proposed position

### Gap Detection Algorithm

The system calculates gaps between tasks using segment-aware time calculations:

```javascript
// Find gap between current task and next task
const currentEnd = Math.max(...currentSegments.map(seg => seg.end.getTime()));
const nextStart = Math.min(...nextSegments.map(seg => seg.start.getTime()));
const gapMinutes = Math.floor((nextStart - currentEnd) / (60 * 1000));

// Check if gap is sufficient for dragged task
if (gapMinutes >= draggedDurationMinutes) {
  gapFound = true;
}
```

## Example Scenarios

### Example 1: Right Shunting

**Initial Schedule:**
- Task A: 09:00 - 10:00
- Task B: 10:00 - 11:00
- Task C: 11:00 - 12:00

**Action:** Drag Task X to 10:30 (conflicts with Task B)

**Gap Detection:**
- Gap between Task B and Task C: 0 minutes (insufficient)
- Need to move Task B and Task C

**Result:**
- Task X: 10:30 - 11:30 (dragged task)
- Task B: 11:30 - 12:30 (moved right)
- Task C: 12:30 - 13:30 (moved right)

### Example 2: Left Shunting

**Initial Schedule:**
- Task A: 09:00 - 10:00
- Task B: 10:00 - 11:00
- Task C: 11:00 - 12:00

**Action:** Drag Task X to 10:30 (conflicts with Task B)

**Gap Detection:**
- Gap between Task A and Task B: 0 minutes (insufficient)
- Need to move Task A

**Result:**
- Task A: 08:00 - 09:00 (moved left)
- Task X: 10:30 - 11:30 (dragged task)
- Task B: 11:30 - 12:30 (moved right)
- Task C: 12:30 - 13:30 (moved right)

## Benefits

1. **Simplicity**: Much easier to understand and debug than complex cascading
2. **Predictability**: Clear, deterministic behavior
3. **Efficiency**: Only moves the minimum number of tasks necessary
4. **Reliability**: Less prone to infinite loops or complex edge cases
5. **Gap Awareness**: Actually finds and uses available gaps in the schedule

## Usage

The improved shunting method is automatically triggered when:

1. A user drags a scheduled task to a new time slot
2. The new position conflicts with existing tasks
3. The conflict resolution dialog is shown with "Sposta a Sinistra" and "Sposta a Destra" options

The system will:
1. Show a conflict dialog with directional options
2. Execute the gap detection and shunting logic
3. Display detailed progress in the console
4. Update all affected tasks in the database
5. Show a success message when complete

## Error Handling

The implementation includes comprehensive error handling:

- **Gap Detection**: Identifies when insufficient space is available
- **Task Validation**: Ensures all tasks are found and valid
- **Graceful Degradation**: Returns meaningful error messages if shunting fails
- **Detailed Logging**: Comprehensive console output for debugging

## Technical Notes

- **Segment-Aware**: Uses task segments for accurate time calculations
- **15-Minute Rounding**: All times are rounded to 15-minute slots
- **UTC Time**: All date/time operations use UTC to avoid timezone issues
- **Task Splitting**: Supports tasks that span multiple time slots
- **Exclusion Logic**: Properly excludes tasks being rescheduled from conflict detection

## Comparison with Previous Method

| Aspect | Previous (Cascading) | New (Gap Detection) |
|--------|---------------------|-------------------|
| **Complexity** | High (multiple rounds, dependency mapping) | Low (direct gap detection) |
| **Predictability** | Variable (complex cascade logic) | High (deterministic) |
| **Debugging** | Difficult (complex state tracking) | Easy (clear step-by-step) |
| **Performance** | Variable (multiple iterations) | Consistent (single pass) |
| **Reliability** | Lower (edge cases, infinite loops) | Higher (simple logic) |
| **Maintainability** | Difficult (complex code) | Easy (straightforward) |

The new method is **significantly better** for production use due to its simplicity, reliability, and maintainability.
