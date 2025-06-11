/**
 * Finds all table elements in the document.
 * @returns A NodeListOf<HTMLTableElement> containing all tables found.
 */
export function findTables(): NodeListOf<HTMLTableElement> {
  return document.querySelectorAll('table')
}

/**
 * Checks if a table is suitable for enrichment based on the initial skeleton criteria.
 * For the skeleton, a table is suitable if it contains more than one table row (<tr>).
 * @param table The HTMLTableElement to check.
 * @returns True if the table is suitable, false otherwise.
 */
export function isTableSuitable(table: HTMLTableElement): boolean {
  const rows = table.querySelectorAll('tr')
  return rows.length > 1
}
