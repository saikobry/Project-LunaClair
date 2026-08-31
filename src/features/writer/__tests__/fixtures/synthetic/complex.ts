export const complexFixtures = {
  documentWithAllFeatures: `# Biology Chapter 4: The Cell

The cell is the basic unit of **life**. All organisms are composed of one or more cells.

## Organelles and Functions

Here is a summary of primary cellular organelles:

| Organelle | Primary Function | Found in Plants | Found in Animals |
| --- | --- | --- | --- |
| **Nucleus** | Stores \`DNA\` and directs activities | Yes | Yes |
| **Mitochondria** | Cellular respiration (ATP synthesis) | Yes | Yes |
| **Chloroplast** | [Photosynthesis](https://en.wikipedia.org/wiki/Photosynthesis) | Yes | No |
| **Ribosome** | *Protein synthesis* | Yes | Yes |

### Key Takeaways

1. Cells require energy for metabolic processes:
  - Energy currency: \`ATP\`
  - Generated via **glycolysis** and **Krebs cycle**
2. Cell membrane controls transport:
  - Passive transport (diffusion, osmosis)
  - Active transport (requires energy)

---

### Visual Overview

![Cell Diagram](images/cell-diagram.png)

> **Important Note:** Plant cells possess both chloroplasts and a rigid cell wall composed of cellulose.

\`\`\`typescript
const cellType = 'eukaryotic';
console.log(\`Cell classification: \${cellType}\`);
\`\`\`
`,
};
