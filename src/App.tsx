import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import markdown from './content.md?raw'
import images from './images'
import Toc from './Toc'
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
    <div className="layout">
      <Toc />
      <div className="markdown-viewer">
        <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSlug]} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

export default App
