# Database Migrations Guide

## Overview

This project uses **TypeORM migrations** to manage database schema changes. Migrations ensure that:
- PostGIS extension is enabled
- Database schema is consistent across environments
- Schema changes are version-controlled and reproducible

## Migration Files

Migrations are located in: `src/database/migrations/`

### Current Migrations:

1. **InitialSchema1718260800000** - Creates initial schema:
   - Enables PostGIS extension
   - Creates `pincodes` table with geography column
   - Creates spatial indexes (GIST)
   - Sets up triggers for `updated_at` column

## Running Migrations

### Local Development

```bash
# Build the project first (migrations run from dist/)
npm run build

# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert
```

### Railway Production

**Option 1: Auto-run on startup (Recommended)**

Set environment variable in Railway:
```bash
RUN_MIGRATIONS=true
```

The app will automatically run pending migrations on startup.

**Option 2: Manual run via Railway CLI**

```bash
# Connect to your Railway project
railway link

# Run migrations
railway run npm run migration:run
```

**Option 3: One-time deployment hook**

Add to `railway.toml`:
```toml
[deploy]
startCommand = "npm run migration:run && npm run start:prod"
```

## Creating New Migrations

### Generate migration from entity changes:

```bash
npm run migration:generate -- src/database/migrations/YourMigrationName
```

### Create empty migration template:

```bash
npm run migration:create -- src/database/migrations/YourMigrationName
```

## Migration Best Practices

1. **Always run migrations before starting the app** in production
2. **Never use `synchronize: true`** in production
3. **Test migrations locally** before deploying
4. **Keep migrations small and focused** (one logical change per migration)
5. **Write both `up()` and `down()`** methods for reversibility

## PostGIS Extension

The initial migration automatically enables PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Database Permissions Required:**

If you get a permission error, the database user needs:
```sql
-- Grant extension creation privilege
ALTER USER <username> WITH SUPERUSER;
-- OR
GRANT CREATE ON DATABASE <dbname> TO <username>;
```

On Railway, the default PostgreSQL user should have these privileges.

## Troubleshooting

### "Extension postgis does not exist"

**Solution:** The database user lacks CREATE EXTENSION privilege.

**Fix for Railway:**
```bash
railway link <postgres-service>
railway run psql -c "ALTER USER <username> WITH SUPERUSER;"
```

### "No migrations found"

**Cause:** Migrations weren't built.

**Fix:**
```bash
npm run build
npm run migration:run
```

### "Migration table already exists"

**Cause:** Migrations were run before, but `typeorm_migrations` table exists.

**Fix:** Check migration status:
```bash
npm run migration:show
```

## Migration Workflow

```
┌─────────────────────┐
│  Make Entity Change │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate Migration  │ ← npm run migration:generate
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Review SQL Code   │ ← Check src/database/migrations/
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Build Project    │ ← npm run build
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Run Migrations    │ ← npm run migration:run
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Commit Changes    │ ← git commit
└─────────────────────┘
```

## Environment Variables

```bash
# Required for migrations
DATABASE_URL=postgresql://user:password@host:port/database

# Auto-run migrations on app startup (production)
RUN_MIGRATIONS=true

# Environment
NODE_ENV=production
```

## Railway Deployment Flow

```
1. Push code to GitHub
2. Railway detects changes
3. Builds project (npm run build)
4. Migrations run automatically (if RUN_MIGRATIONS=true)
5. App starts (npm run start:prod)
6. Health check passes
```

## Further Reading

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [PostGIS Documentation](https://postgis.net/documentation/)
