/**
 * Add NIST CSF 2.0 mapping columns to vulnerabilities table
 * Enables automatic mapping of vulnerabilities to NIST CSF functions
 */

exports.up = function (knex) {
  return knex.schema.table('vulnerabilities', (table) => {
    // NIST CSF 2.0 function mapping
    table.string('nist_csf_function', 50).nullable();
    // Values: GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER

    // NIST CSF 2.0 category mapping
    table.string('nist_csf_category', 200).nullable();
    // Example: "ID.RA-1: Asset vulnerabilities are identified and documented"

    // Impact score based on severity (0.0 - 1.0)
    table.float('nist_csf_impact').nullable();

    // Index for efficient querying
    table.index('nist_csf_function', 'idx_vuln_csf_function');
    table.index(['nist_csf_function', 'status'], 'idx_vuln_csf_status');
  });
};

exports.down = function (knex) {
  return knex.schema.table('vulnerabilities', (table) => {
    table.dropIndex('nist_csf_function', 'idx_vuln_csf_function');
    table.dropIndex(['nist_csf_function', 'status'], 'idx_vuln_csf_status');
    table.dropColumn('nist_csf_function');
    table.dropColumn('nist_csf_category');
    table.dropColumn('nist_csf_impact');
  });
};
