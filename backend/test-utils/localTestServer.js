const assert = require("node:assert/strict");
async function assertLocalTestServer(db) {
  const {
    rows: [server],
  } = await db.query(
    "SELECT current_database() AS name,host(inet_server_addr()) AS ip",
  );
  assert.equal(server.name, "castme_test");
  if (process.env.SECURITY_TEST_SERVER_ADDRESS) {
    assert.equal(server.ip, process.env.SECURITY_TEST_SERVER_ADDRESS);
    assert.match(process.env.SECURITY_TEST_CLUSTER_ID || "", /^\d+$/);
    const {
      rows: [cluster],
    } = await db.query(
      `SELECT current_setting('cluster_name') AS name,system_identifier::text AS id FROM pg_control_system()`,
    );
    assert.equal(cluster.name, "castme_security_test");
    assert.equal(cluster.id, process.env.SECURITY_TEST_CLUSTER_ID);
  } else assert.ok(["127.0.0.1", "::1"].includes(server.ip));
}
module.exports = { assertLocalTestServer };
