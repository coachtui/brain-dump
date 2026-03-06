import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(
    { schema: 'hub', name: 'atomic_objects' },
    {
      raw_text: {
        type: 'text',
      },
      cleaned_text: {
        type: 'text',
      },
      title: {
        type: 'text',
      },
      object_type: {
        type: 'varchar(20)',
      },
      domain: {
        type: 'varchar(20)',
        default: 'unknown',
      },
      temporal_has_date: {
        type: 'boolean',
        default: false,
        notNull: true,
      },
      temporal_date_text: {
        type: 'text',
      },
      temporal_urgency: {
        type: 'varchar(10)',
      },
      location_places: {
        type: 'text[]',
        default: '{}',
        notNull: true,
      },
      location_geofence_candidate: {
        type: 'boolean',
        default: false,
        notNull: true,
      },
      is_actionable: {
        type: 'boolean',
        default: false,
        notNull: true,
      },
      next_action: {
        type: 'text',
      },
      linked_object_ids: {
        type: 'uuid[]',
        default: '{}',
        notNull: true,
      },
      sequence_index: {
        type: 'integer',
        default: 0,
        notNull: true,
      },
      embedding_status: {
        type: 'varchar(20)',
        default: 'pending',
        notNull: true,
      },
    }
  );

  pgm.createIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'object_type',
    { name: 'idx_atomic_objects_object_type' }
  );
  pgm.createIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'domain',
    { name: 'idx_atomic_objects_domain' }
  );
  pgm.createIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'embedding_status',
    { name: 'idx_atomic_objects_embedding_status' }
  );
  pgm.createIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'is_actionable',
    { name: 'idx_atomic_objects_is_actionable' }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'is_actionable',
    { name: 'idx_atomic_objects_is_actionable', ifExists: true }
  );
  pgm.dropIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'embedding_status',
    { name: 'idx_atomic_objects_embedding_status', ifExists: true }
  );
  pgm.dropIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'domain',
    { name: 'idx_atomic_objects_domain', ifExists: true }
  );
  pgm.dropIndex(
    { schema: 'hub', name: 'atomic_objects' },
    'object_type',
    { name: 'idx_atomic_objects_object_type', ifExists: true }
  );

  pgm.dropColumns(
    { schema: 'hub', name: 'atomic_objects' },
    [
      'raw_text',
      'cleaned_text',
      'title',
      'object_type',
      'domain',
      'temporal_has_date',
      'temporal_date_text',
      'temporal_urgency',
      'location_places',
      'location_geofence_candidate',
      'is_actionable',
      'next_action',
      'linked_object_ids',
      'sequence_index',
      'embedding_status',
    ]
  );
}
