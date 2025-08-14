# Supabase Migration Guide

## Overview

This guide explains how to migrate your Flexi Production Suite from localStorage to Supabase backend.

## Architecture

The migration introduces several new components:

1. **supabaseClient.js** - Handles Supabase connection
2. **supabaseService.js** - Mirrors StorageService API for Supabase
3. **unifiedStorageService.js** - Wrapper that can switch between localStorage and Supabase
4. **serviceConfig.js** - Configuration for storage mode
5. **migrationUtility.js** - Handles data migration
6. **migration.html** - UI for managing the migration

## Migration Steps

### 1. Test the Migration Page

Navigate to `/pages/migration.html` in your browser. This page provides:
- Connection status checking
- Data preview
- Backup functionality
- Migration execution
- Verification tools

### 2. Check Connections

Click "Check Connections" to verify:
- localStorage is accessible
- Supabase connection is working
- Data counts are correct

### 3. Backup Your Data

**IMPORTANT**: Always backup before migrating!

Click "Backup Data" to download a JSON file with all your data.

### 4. Preview Data

Click "Preview Data" to see a sample of your data and verify it looks correct.

### 5. Configure Migration

Use the checkboxes to configure:
- **Dual Write**: Write to both localStorage and Supabase (safer but slower)
- **Realtime**: Enable Supabase realtime subscriptions
- **Log Calls**: Debug mode to see all storage operations

You can also enable Supabase for specific features only:
- Machines
- Phases
- ODP Orders
- Scheduled Events
- Machine Availability

### 6. Execute Migration

Click "Migrate to Supabase" to start the migration. The process will:
1. Create a backup
2. Validate all data
3. Transform data for Supabase compatibility
4. Upload to Supabase in the correct order
5. Generate a migration report

### 7. Verify Migration

Click "Verify Migration" to check that all records were migrated correctly.

### 8. Switch to Supabase

Once verified, click "Switch to Supabase" to start using the cloud backend.

## Testing the Migration

### Gradual Migration

You can test feature by feature:

```javascript
// In browser console
ServiceConfig.enable_supabase_feature('machines'); // Test just machines
ServiceConfig.LOG_SERVICE_CALLS = true; // See what's happening
```

### Dual Write Mode

Enable dual write to keep localStorage in sync during testing:

```javascript
ServiceConfig.ENABLE_DUAL_WRITE = true;
```

### Rollback

If something goes wrong:

```javascript
ServiceConfig.disable_supabase(); // Revert to localStorage
```

## API Compatibility

The migration maintains 100% API compatibility. All existing code continues to work because:

1. `unifiedStorageService` implements the same interface as `storageService`
2. The global `window.storageService` is replaced with the unified service
3. All methods return the same data structures

## Data Transformations

The migration handles several transformations:

1. **ID Generation**: Uses UUID v4 for new records
2. **Timestamps**: Ensures all records have created_at/updated_at
3. **Type Conversion**: Converts strings to proper types (integers, decimals)
4. **Array Fields**: Handles PostgreSQL array types
5. **Null Values**: Properly handles optional fields

## Realtime Features

Once migrated, you can enable realtime subscriptions:

```javascript
ServiceConfig.ENABLE_REALTIME = true;

// Subscribe to changes
window.storageService.subscribe_to_changes('machines', (payload) => {
    console.log('Machine changed:', payload);
});
```

## Performance Considerations

1. **Caching**: The Supabase service includes 5-second caching
2. **Batch Operations**: Use save_* methods for bulk updates
3. **Async Operations**: All Supabase operations are async

## Troubleshooting

### Connection Issues

If Supabase connection fails:
1. Check internet connection
2. Verify Supabase URL and anon key
3. Check browser console for CORS errors

### Migration Failures

If migration fails:
1. Check the migration log for specific errors
2. Verify data validation issues
3. Try migrating one entity type at a time

### Performance Issues

If the app is slow after migration:
1. Enable caching: already enabled by default
2. Check network latency
3. Consider enabling dual write temporarily

## Security Notes

1. The anon key is safe to expose - it only allows authenticated operations
2. Row Level Security (RLS) is enabled on all tables
3. Consider implementing user authentication for production

## Next Steps

After successful migration:

1. Monitor performance
2. Set up automated backups in Supabase
3. Configure alerts for database issues
4. Implement user authentication
5. Enable additional Supabase features (Edge Functions, Storage, etc.)

## Support

For issues or questions:
1. Check the browser console for errors
2. Review the migration log
3. Verify Supabase dashboard for data
4. Check network requests in browser DevTools
