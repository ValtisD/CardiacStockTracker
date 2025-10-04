# Data Migration Scripts

## migrate-to-admin.ts

This script assigns any existing database records without a `userId` to the admin user account. This is a safety measure for edge cases or data imported from backups.

### When to Use

Run this script once after enabling multi-user authentication if you have existing data that needs to be assigned to the admin user.

### Prerequisites

1. **Get your Auth0 User ID (sub claim)**:
   - Log in to your application
   - Open browser developer tools (F12)
   - Go to Application > Local Storage or Session Storage
   - Find the Auth0 token
   - Decode the JWT (use jwt.io)
   - Look for the `sub` claim (e.g., `auth0|xxxxxxxxxxxxx`)
   
2. **Set the environment variable**:
   ```bash
   export AUTH0_ADMIN_USER_ID="auth0|xxxxxxxxxxxxx"
   ```

### Usage

```bash
# Run the migration
tsx scripts/migrate-to-admin.ts
```

The script will:
1. Wait 5 seconds for you to cancel (press Ctrl+C)
2. Count orphaned records in each table
3. If orphaned records exist, update them in a transaction
4. Report the results

### Safety Features

- ✅ 5-second confirmation delay before execution
- ✅ Counts and displays orphaned records before updating
- ✅ Runs all updates in a single database transaction
- ✅ Automatic rollback on any error
- ✅ Detailed logging of all operations

### Example Output

```
Starting migration to assign orphaned data to admin user...
Admin User ID: auth0|xxxxxxxxxxxxx

Note: This script will update ALL records with NULL or empty user_id
Press Ctrl+C within 5 seconds to cancel...

Checking for orphaned records...

Found orphaned records:
  - Inventory: 15
  - Hospitals: 3
  - Implant Procedures: 7
  - Stock Transfers: 2

Updating records in transaction...

✓ Updated 15 inventory records
✓ Updated 3 hospital records
✓ Updated 7 implant procedure records
✓ Updated 2 stock transfer records

✅ Migration completed successfully!
All orphaned data has been assigned to the admin user.
```

### Important Notes

- **Validation**: Make sure your `AUTH0_ADMIN_USER_ID` is correct before running
- **Backup**: Consider backing up your database before running any migration
- **One-time use**: This script is typically run once after enabling authentication
- **Current status**: The database is currently clean with no orphaned records
