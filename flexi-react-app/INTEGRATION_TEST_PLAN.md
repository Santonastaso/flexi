# 🧪 **BULLETPROOF INTEGRATION TEST PLAN**

## 🎯 **Test Objectives**
1. Verify overlap detection prevents all conflicts during splitting
2. Ensure shunting is triggered when splits would overlap
3. Confirm UI displays correct segment positions
4. Test complete integration of all systems

## 📋 **Test Scenarios**

### **Scenario 1: Basic Split Task Creation**
**Setup:**
- Machine with unavailable slots: 12:00-13:00
- Drop 4-hour task at 11:00

**Expected Behavior:**
1. ✅ Task splits into: [11:00-12:00, 13:00-16:00]
2. ✅ JSON stored: `{"totalSegments":2,"segments":[...],"wasSplit":true}`
3. ✅ UI shows two segments with gap at 12:00-13:00
4. ✅ No overlaps with existing tasks

**Test Commands:**
```javascript
// Check segments in memory
console.log(useSchedulerStore.getState().getSplitTaskInfo(taskId));

// Check database
console.log(task.description);

// Check UI rendering
// Visual inspection: task should show as two segments
```

### **Scenario 2: Split Task Overlap Detection**
**Setup:**
- Existing task: 14:00-15:00
- Machine unavailable: 12:00-13:00
- Drop 4-hour task at 11:00 (would split to [11:00-12:00, 13:00-16:00])

**Expected Behavior:**
1. ✅ Splitting algorithm creates segments
2. ✅ Overlap detection finds conflict with 14:00-15:00 task
3. ✅ Conflict dialog appears for shunting
4. ❌ Task is NOT scheduled until conflict resolved

**Test Commands:**
```javascript
// Should trigger conflict dialog
const result = await scheduleTaskFromSlot(taskId, machine, date, 11, 0);
console.log(result.conflict); // Should be true
console.log(result.conflictingTask); // Should be the 14:00-15:00 task
```

### **Scenario 3: Shunting with Split Tasks**
**Setup:**
- Existing split task: [10:00-11:00, 13:00-14:00] 
- Drop new task at 10:30 (conflicts with first segment)

**Expected Behavior:**
1. ✅ Conflict detected with split task's first segment
2. ✅ Shunting moves split task segments correctly
3. ✅ New task scheduled without overlap
4. ✅ All segments maintain splitting behavior

### **Scenario 4: Complex Multi-Task Scenario**
**Setup:**
- Task A: [09:00-10:00, 14:00-15:00] (split)
- Task B: 11:00-12:00 (normal)
- Task C: 16:00-17:00 (normal)
- Drop Task D (3 hours) at 09:30

**Expected Behavior:**
1. ✅ Conflict detected with Task A's first segment
2. ✅ Shunting analysis considers all task segments
3. ✅ Proper gap calculation between segments
4. ✅ All tasks maintain their splitting behavior

## 🔧 **Debug Commands**

### **Check Segment Storage**
```javascript
// In browser console:
const store = useSchedulerStore.getState();

// Check all split tasks in memory
console.log('Split tasks in memory:', store.splitTasksInfo);

// Check specific task segments
const taskId = 'your-task-id';
console.log('Task segments:', store.getSplitTaskInfo(taskId));

// Check task in database
const { getOdpOrderById } = useOrderStore.getState();
const task = getOdpOrderById(taskId);
console.log('Database description:', task.description);
```

### **Test Overlap Detection**
```javascript
// Test overlap detection manually
const store = useSchedulerStore.getState();
const startTime = new Date('2025-08-29T11:00:00.000Z');
const endTime = new Date('2025-08-29T15:00:00.000Z');
const machineId = 'your-machine-id';

const overlapResult = store.checkMachineOverlaps(startTime, endTime, machineId);
console.log('Overlap result:', overlapResult);
```

### **Verify UI Rendering**
```javascript
// Check if UI component gets correct segments
const GanttComponent = document.querySelector('[data-testid="gantt-chart"]');
// Visual inspection: segments should appear with gaps for unavailable slots
```

## 🚨 **Known Issues to Verify Fixed**

1. **Issue**: "UI shows different task position than splits"
   - **Test**: Compare JSON segments with visual UI position
   - **Fix**: Ensure `getSplitTaskInfo` returns correct data to UI

2. **Issue**: "Splits would collide with another task"
   - **Test**: Verify overlap detection prevents this
   - **Fix**: Bulletproof overlap checking in splitting algorithm

3. **Issue**: "Shunting doesn't work with split tasks"
   - **Test**: Drag task onto split task, verify shunting
   - **Fix**: Segment-aware conflict resolution

## ✅ **Success Criteria**

- [ ] No overlaps possible (mathematically impossible)
- [ ] Split tasks display correctly in UI
- [ ] Shunting works with split tasks
- [ ] Conflict resolution handles all scenarios
- [ ] Database and memory stay synchronized
- [ ] Real-time updates work correctly

## 🎯 **Final Verification**

Run this complete test:
1. Create split task with unavailable slots
2. Try to schedule overlapping task
3. Verify conflict dialog appears
4. Resolve with shunting
5. Confirm all tasks positioned correctly
6. Refresh page and verify persistence

**If all tests pass: BULLETPROOF SYSTEM ACHIEVED! 🛡️**
