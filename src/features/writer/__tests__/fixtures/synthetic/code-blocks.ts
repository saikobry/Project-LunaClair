export const codeBlockFixtures = {
  typescriptBlock: `\`\`\`typescript
interface User {
  id: string;
  name: string;
  isActive: boolean;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\``,

  jsonBlock: `\`\`\`json
{
  "title": "Study Notes",
  "score": 100,
  "tags": ["biology", "exam"]
}
\`\`\``,

  genericBlock: `\`\`\`
Plain text code block without language
  Preserving inner indentation
\`\`\``,
};
