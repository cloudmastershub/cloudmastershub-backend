const config = {
  mongodb: {
    // URL for MongoDB connection
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/cloudmastershub_courses",

    // Database name
    databaseName: process.env.MONGODB_DATABASE || "cloudmastershub_courses",

    // MongoDB connection options
    options: {
      authSource: process.env.MONGODB_AUTH_SOURCE || "admin",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  // The migrations dir can be an absolute or relative path
  migrationsDir: "migrations",

  // The mongodb collection where the applied changes are stored
  changelogCollectionName: "changelog",

  // The file extension to create migrations and search for in migration dir
  migrationFileExtension: ".js",

  // Enable the algorithm to create a checksum of the file contents and use that
  // in the comparison to determine if the file should be run
  useFileHash: false,

  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs',
};

module.exports = config;