/**
 * Batch script to generate embeddings for all existing atomic objects
 * Usage: npm run generate-embeddings
 */

import * as dotenv from 'dotenv';
import { pool } from '../db/connection';
import { storeInVector } from '../services/vectorService';
import { AtomicObjectModel } from '../models/AtomicObject';
import { getWeaviateClient, initializeWeaviateSchema } from '../db/weaviate';

dotenv.config();

interface EmbeddingProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startTime: Date;
}

/**
 * Main function to generate embeddings
 */
async function generateEmbeddings() {
  console.log('🚀 Starting embedding generation...\n');

  const progress: EmbeddingProgress = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
  };

  try {
    // Step 1: Initialize Weaviate schema
    console.log('📋 Step 1: Initializing Weaviate schema...');
    await initializeWeaviateSchema();
    console.log('✅ Weaviate schema ready\n');

    // Step 2: Fetch all atomic objects from database
    console.log('📋 Step 2: Fetching atomic objects from database...');
    const result = await pool.query(
      'SELECT id FROM hub.atomic_objects ORDER BY created_at ASC'
    );
    progress.total = result.rows.length;
    console.log(`✅ Found ${progress.total} atomic objects\n`);

    if (progress.total === 0) {
      console.log('ℹ️  No atomic objects to process. Exiting.');
      return;
    }

    // Step 3: Check which objects already exist in Weaviate
    console.log('📋 Step 3: Checking existing embeddings in Weaviate...');
    const client = getWeaviateClient();
    const existingObjects = await client.graphql
      .get()
      .withClassName('AtomicObject')
      .withFields('objectId')
      .withLimit(10000)
      .do();

    const existingObjectIds = new Set(
      (existingObjects.data.Get.AtomicObject || []).map((obj: any) => obj.objectId)
    );
    console.log(`✅ Found ${existingObjectIds.size} existing embeddings\n`);

    // Step 4: Process objects in batches
    console.log('📋 Step 4: Generating embeddings...\n');
    const batchSize = 10; // Process 10 objects at a time
    const objectIds = result.rows.map((row) => row.id);

    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batch = objectIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(objectIds.length / batchSize);

      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} objects)...`);

      await Promise.all(
        batch.map(async (objectId) => {
          try {
            // Skip if already exists
            if (existingObjectIds.has(objectId)) {
              progress.skipped++;
              progress.processed++;
              console.log(`   ⏭️  Skipped ${objectId} (already exists)`);
              return;
            }

            // Fetch full object
            const object = await AtomicObjectModel.findById(objectId);
            if (!object) {
              console.log(`   ⚠️  Object ${objectId} not found in database`);
              progress.failed++;
              progress.processed++;
              return;
            }

            // Generate and store embedding
            const atomicObject = object.toAtomicObject();
            await storeInVector(atomicObject);

            progress.succeeded++;
            progress.processed++;
            console.log(`   ✅ Generated embedding for ${objectId}`);

            // Add delay to avoid rate limiting (OpenAI: 3500 req/min)
            // At batch size 10, we'll process ~600 objects/min, well under limit
            await sleep(100);
          } catch (error: any) {
            progress.failed++;
            progress.processed++;
            console.error(`   ❌ Failed to process ${objectId}: ${error.message}`);
          }
        })
      );

      // Progress update
      const percentage = Math.round((progress.processed / progress.total) * 100);
      const elapsed = ((Date.now() - progress.startTime.getTime()) / 1000).toFixed(1);
      console.log(`\n📊 Progress: ${progress.processed}/${progress.total} (${percentage}%) - ${elapsed}s elapsed`);
    }

    // Step 5: Final summary
    console.log('\n\n🎉 Embedding generation complete!\n');
    console.log('📊 Summary:');
    console.log(`   Total objects: ${progress.total}`);
    console.log(`   ✅ Successfully generated: ${progress.succeeded}`);
    console.log(`   ⏭️  Skipped (already exists): ${progress.skipped}`);
    console.log(`   ❌ Failed: ${progress.failed}`);

    const totalTime = ((Date.now() - progress.startTime.getTime()) / 1000).toFixed(1);
    console.log(`   ⏱️  Total time: ${totalTime}s`);

    const avgTime = progress.succeeded > 0 ? (parseFloat(totalTime) / progress.succeeded).toFixed(2) : '0';
    console.log(`   ⚡ Average time per object: ${avgTime}s`);

    if (progress.failed > 0) {
      console.log('\n⚠️  Some objects failed to process. Check logs above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All objects processed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify environment variables
 */
function verifyEnvironment(): boolean {
  const required = ['OPENAI_API_KEY', 'WEAVIATE_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    return false;
  }

  console.log('✅ Environment variables verified\n');
  return true;
}

/**
 * Entry point
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Batch Embedding Generator for The Hub           ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (!verifyEnvironment()) {
    process.exit(1);
  }

  await generateEmbeddings();
}

// Run the script
if (require.main === module) {
  main();
}
