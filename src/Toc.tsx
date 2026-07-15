import { useState } from 'react'

const toc = [
  { label: 'Body Membranes', id: 'body-membranes' },
  { label: 'Epithelial Membranes', id: 'epithelial-membranes' },
  { label: 'Connective Tissue Membranes', id: 'connective-tissue-membranes' },
  { label: 'Integumentary System', id: 'integumentary-system-1' },
  { label: 'Functions of the Integumentary System', id: 'functions-of-the-integumentary-system' },
  { label: 'Structure of the Skin', id: 'structure-of-the-skin' },
  { label: 'Skin Color', id: 'skin-color' },
  { label: 'Appendages of the Skin', id: 'appendages-of-the-skin' },
  { label: 'Homeostatic Imbalances of Skin', id: 'homeostatic-imbalances-of-skin' },
  { label: 'Developmental Aspects', id: 'developmental-aspects-of-skin-and-body-membranes' },
]

export default function Toc() {
  const [open, setOpen] = useState(true)

  if (!open) {
    return <button className="toc-toggle" onClick={() => setOpen(true)}>→</button>
  }

  return (
    <nav className="toc">
      <button className="toc-close" onClick={() => setOpen(false)}>←</button>
      <ul>
        {toc.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
