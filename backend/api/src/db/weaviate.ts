/**
 * Weaviate client connection and configuration
 */

import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import * as dotenv from 'dotenv';

dotenv.config();

let client: WeaviateClient | null = null;

/**
 * Get or create Weaviate client instance
 */
export function getWeaviateClient(): WeaviateClient {
  if (client) {
    return client;
  }

  const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
  const apiKey = process.env.WEAVIATE_API_KEY;

  const clientConfig: any = {
    scheme: weaviateUrl.startsWith('https') ? 'https' : 'http',
    host: weaviateUrl.replace(/^https?:\/\//, ''),
  };

  if (apiKey) {
    clientConfig.apiKey = new ApiKey(apiKey);
  }

  client = weaviate.client(clientConfig);
  return client;
}

/**
 * Test Weaviate connection
 */
export async function testWeaviateConnection(): Promise<boolean> {
  try {
    const c = getWeaviateClient();
    const meta = await c.misc.metaGetter().do();
    console.log('✅ Weaviate connection successful. Version:', meta.version);
    return true;
  } catch (error) {
    console.error('❌ Weaviate connection failed:', error);
    return false;
  }
}

// All properties for AtomicObject class — includes both v1 and v2 fields
const ALL_PROPERTIES = [
  {
    name: 'objectId',
    dataType: ['text'],
    description: 'UUID of the atomic object in PostgreSQL',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'userId',
    dataType: ['text'],
    description: 'User ID who owns this object',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'content',
    dataType: ['text'],
    description: 'The main content/text of the atomic object',
    indexFilterable: false,
    indexSearchable: true,
  },
  {
    name: 'title',
    dataType: ['text'],
    description: 'Short title extracted from object',
    indexFilterable: false,
    indexSearchable: true,
  },
  {
    name: 'category',
    dataType: ['text[]'],
    description: 'Legacy categories assigned to this object',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'objectType',
    dataType: ['text'],
    description: 'Object type: task, reminder, idea, observation, question, decision, journal, reference',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'domain',
    dataType: ['text'],
    description: 'Life domain: work, personal, health, family, finance, project, misc, unknown',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'sourceType',
    dataType: ['text'],
    description: 'Source type: voice, text, or import',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'sourceTranscriptId',
    dataType: ['text'],
    description: 'Session/transcript ID this object was parsed from',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'entities',
    dataType: ['text[]'],
    description: 'Extracted entity values',
    indexFilterable: true,
    indexSearchable: true,
  },
  {
    name: 'sentiment',
    dataType: ['text'],
    description: 'Sentiment: positive, neutral, or negative',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'urgency',
    dataType: ['text'],
    description: 'Urgency level: low, medium, or high',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'isActionable',
    dataType: ['boolean'],
    description: 'Whether this object has a concrete next action',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'tags',
    dataType: ['text[]'],
    description: 'Tags',
    indexFilterable: true,
    indexSearchable: true,
  },
  {
    name: 'sequenceIndex',
    dataType: ['number'],
    description: 'Position within source transcript',
    indexFilterable: true,
    indexSearchable: false,
  },
  {
    name: 'createdAt',
    dataType: ['number'],
    description: 'Unix timestamp of creation',
    indexFilterable: true,
    indexSearchable: false,
  },
];

/**
 * Initialize Weaviate schema — creates class or adds missing properties to existing class
 */
export async function initializeWeaviateSchema(): Promise<void> {
  const c = getWeaviateClient();

  let existingClass: any = null;
  try {
    const schemaResult = await c.schema.getter().do();
    existingClass = schemaResult.classes?.find((cls: any) => cls.class === 'AtomicObject') ?? null;
  } catch (error) {
    console.error('Error checking Weaviate schema:', error);
  }

  if (existingClass) {
    console.log('ℹ️  AtomicObject class exists in Weaviate — ensuring v2 properties are present');
    const existingPropNames: Set<string> = new Set(
      (existingClass.properties ?? []).map((p: any) => p.name)
    );

    for (const prop of ALL_PROPERTIES) {
      if (!existingPropNames.has(prop.name)) {
        try {
          await c.schema
            .propertyCreator()
            .withClassName('AtomicObject')
            .withProperty(prop as any)
            .do();
          console.log(`  ✅ Added Weaviate property: ${prop.name}`);
        } catch (err: any) {
          console.warn(`  ⚠️  Could not add property ${prop.name}:`, err?.message || err);
        }
      }
    }
    return;
  }

  // Create fresh class with all properties
  const atomicObjectClass = {
    class: 'AtomicObject',
    description: 'An atomic piece of information captured by the user',
    vectorizer: 'none', // External OpenAI embeddings
    properties: ALL_PROPERTIES,
  };

  try {
    await c.schema.classCreator().withClass(atomicObjectClass).do();
    console.log('✅ AtomicObject schema created in Weaviate');
  } catch (error) {
    console.error('❌ Failed to create Weaviate schema:', error);
    throw error;
  }
}

/**
 * Delete all data from Weaviate (for testing/dev only)
 */
export async function clearWeaviateData(): Promise<void> {
  const c = getWeaviateClient();
  try {
    await c.schema.classDeleter().withClassName('AtomicObject').do();
    console.log('✅ Weaviate data cleared');
  } catch (error) {
    console.log('ℹ️  No data to clear or class does not exist');
  }
}
