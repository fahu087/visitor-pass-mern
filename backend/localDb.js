const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');

async function getLocalUri() {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbPath: path.join(__dirname, 'local-db'),
      storageEngine: 'wiredTiger'
    }
  });
  return mongod.getUri('visitor_pass_db');
}
module.exports = { getLocalUri };