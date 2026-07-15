import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import markdown from './content.md?raw'
import images from './images'
import './App.css'

let content = markdown
for (const [key, src] of Object.entries(images)) {
  content = content.replace(
    new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
    `<img src="${src}" alt="${key}" style="max-width:100%" />`
  )
}

function App() {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export default App
