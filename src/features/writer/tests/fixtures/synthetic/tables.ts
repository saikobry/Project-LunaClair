export const tableFixtures = {
  simpleTable: `| Header 1 | Header 2 | Header 3 |
| --- | --- | --- |
| Cell 1 | Cell 2 | Cell 3 |
| Row 2 Col 1 | Row 2 Col 2 | Row 2 Col 3 |`,

  formattedCellsTable: `| Structure | Function | Notes |
| --- | --- | --- |
| **Nucleus** | *Genetic control* | Contains \`DNA\` |
| **Mitochondria** | ATP production | [Learn more](https://example.com) |
| **Ribosome** | Protein synthesis | <u>Crucial</u> for translation |`,

  emptyAndUnevenCells: `| A | B | C |
| --- | --- | --- |
| Val 1 | | Val 3 |
| | Val 2 | |`,

  escapedPipes: `| Symbol | Description |
| --- | --- |
| \\| | Bitwise OR operator |
| && | Logical AND |`,
};
