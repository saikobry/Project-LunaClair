import ReactMarkdown from 'react-markdown'
import './App.css'

const markdown = `
# Hello Markdown

This is a **markdown viewer** using \`react-markdown\`.

## Features

- **Bold**, *italic*, and \`inline code\`
- Lists (like this one!)
- [Links](https://example.com)
- Code blocks:

\`\`\`ts
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

### Table

| Feature | Supported |
|---------|-----------|
| GFM     | Yes       |
| Lists   | Yes       |
| Code    | Yes       |

---

> Blockquotes work too!
`

function App() {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  )
}

export default App
