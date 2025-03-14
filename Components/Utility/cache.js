const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300000 });

// const getCache = (key) => cache.get(key);
const getCache = (key) => {
  const cachedValue = cache.get(key);
  console.log(`Cache lookup for key "${key}":`, cachedValue);
  return cachedValue;
};

// clearAllCache()
const setCache = (key, value, ttl = 300000) => {
  cache.set(key, value, ttl);
  console.log(`Cache set for ${key}: ${value}`);
};
const deleteCache = (key) => {
  cache.del(key);
  console.log(`Cache cleared for ${key}`);
};
const clearAllCache = () => {
  cache.flushAll();
  console.log("All cache cleared.");
};

module.exports = { setCache, getCache, deleteCache, clearAllCache };
