/**
 * Add CVSS vector string column to vulnerabilities table
 * Stores CVSS 3.1 vector string (e.g., "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
 */

exports.up = function (knex) {
  return knex.schema.table('vulnerabilities', (table) => {
    // CVSS 3.1 vector string
    table.string('cvss_vector', 200).nullable();
    // Example: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"

    // Index for searching by CVSS vector patterns
    table.index('cvss_vector', 'idx_vuln_cvss_vector');
  });
};

exports.down = function (knex) {
  return knex.schema.table('vulnerabilities', (table) => {
    table.dropIndex('cvss_vector', 'idx_vuln_cvss_vector');
    table.dropColumn('cvss_vector');
  });
};
