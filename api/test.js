module.exports = function handler(req, res) {
  res.status(200).json({
    message: 'API working',
    hasHaUrl: !!process.env.HA_URL,
    hasHaToken: !!process.env.HA_TOKEN
  });
};
