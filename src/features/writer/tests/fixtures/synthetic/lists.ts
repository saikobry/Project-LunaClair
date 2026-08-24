export const listFixtures = {
  simpleUnordered: `- First bullet
- Second bullet
- Third bullet`,

  simpleOrdered: `1. First item
2. Second item
3. Third item`,

  nestedTwoSpaces: `- Top level A
  - Nested level B
    - Deep nested level C
- Top level D`,

  nestedFourSpaces: `- Root item
    - Sub item level 1
        - Sub item level 2
- Root item 2`,

  mixedLists: `1. Ordered item 1
  - Nested unordered A
  - Nested unordered B
2. Ordered item 2
  1. Nested ordered 2.1
  2. Nested ordered 2.2`,

  checklists: `- [ ] Incomplete task
- [x] Completed task
- [ ] Another pending item`,
};
