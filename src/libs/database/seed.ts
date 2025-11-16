/**
 * Database Seeding Script
 *
 * Seeds test data for development and testing
 */

import 'reflect-metadata';

async function seedDatabase() {
  console.log('Database seeding would run here.');
  console.log('For this demo project, test data is created in individual tests.');
  console.log('In production, implement proper seeding logic.');
  process.exit(0);
}

seedDatabase().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
