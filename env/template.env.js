function value(v = '') {
  return JSON.stringify(v);
}

module.exports = {
  CHAIN_URL: value('http://localhost:9334')
};