import { db } from './dexie';

/**
 * Kola Database Migrations & Seeding
 * Handles schema evolution and initial data seeding for offline-first usage.
 */

export async function runMigrations() {
  console.log('[Dexie Migration] Checking for updates...');
  
  // Example of data seeding if tables are empty
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    console.log('[Dexie Migration] Seeding initial categories...');
    await db.categories.bulkAdd([
      {
        local_id: crypto.randomUUID(),
        business_id: 'default', // Should be replaced by actual business ID on signup
        name: 'General',
        color: '#10B981',
        icon: 'Package',
        created_at: new Date(),
        updated_at: new Date(),
        sync_status: 'synced',
        version: 1,
        device_id: 'system'
      },
      {
        local_id: crypto.randomUUID(),
        business_id: 'default',
        name: 'Services',
        color: '#3B82F6',
        icon: 'Tool',
        created_at: new Date(),
        updated_at: new Date(),
        sync_status: 'synced',
        version: 1,
        device_id: 'system'
      }
    ]);
  }

  // Example: Migrate old data structure if needed
  // This is where you'd handle complex data transformations between versions.
}

/**
 * Reset Database (Dev only)
 */
export async function resetDatabase() {
  await db.delete();
  window.location.reload();
}
