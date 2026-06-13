/**
 * Application Configuration
 * 
 * Centralized configuration loading from environment variables.
 * Provides type-safe access to configuration values.
 */

export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/pinpointindia',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Data Ingestion
  dataIngestion: {
    pincodeDataUrl:
      process.env.PINCODE_DATA_URL ||
      'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/postal/boundaries/Datagov_Pincode_Boundaries.geojson',
    pincodeDataChecksum: process.env.PINCODE_DATA_CHECKSUM || '',
    forceReingest: process.env.FORCE_REINGEST_DATA === 'true',
  },

  // H3 Index
  h3Index: {
    resolution: parseInt(process.env.H3_RESOLUTION || '9', 10),
    bufferEnabled: process.env.H3_BUFFER_ENABLED !== 'false', // Default: true
    forceRebuild: process.env.FORCE_REBUILD_H3_INDEX === 'true',
  },

  // Initialization
  initialization: {
    skipInitialization: process.env.SKIP_INITIALIZATION === 'true',
  },
});
