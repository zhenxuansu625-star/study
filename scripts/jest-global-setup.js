// Run tests in a fixed time zone with daylight saving, so date maths is tested realistically.
module.exports = async () => {
  process.env.TZ = 'Europe/London';
};
