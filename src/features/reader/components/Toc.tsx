import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { List, X } from 'lucide-react'

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

const pulse = stylex.keyframes({
  '0%': { boxShadow: '0 4px 14px rgba(99,102,241,0.25)' },
  '50%': { boxShadow: '0 4px 28px rgba(99,102,241,0.45)' },
  '100%': { boxShadow: '0 4px 14px rgba(99,102,241,0.25)' },
})

const styles = stylex.create({
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    borderStyle: 'none',
    cursor: 'pointer',
    fontSize: 22,
    color: '#fff',
    boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
    },
    ':active': {
      transform: 'scale(0.95)',
    },
  },
  fabPulse: {
    animationName: pulse,
    animationDuration: '2.5s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },
  fabOpen: {
    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 998,
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    // Button reset — remove default button appearance
    borderStyle: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'block',
  },
  overlayEnter: {
    opacity: 1,
    pointerEvents: 'auto',
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#fff',
    zIndex: 999,
    padding: '28px 20px',
    overflowY: 'auto',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
    transform: 'translateX(100%)',
    opacity: 1,
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  panelEnter: {
    transform: 'translateX(0)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: '#333',
    margin: 0,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: '#6366f1',
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
    color: '#999',
    padding: '6px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f3f4f6',
      color: '#333',
    },
  },

  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    marginBottom: 2,
  },
  link: {
    display: 'block',
    padding: '10px 14px',
    color: '#555',
    textDecoration: 'none',
    fontSize: 13.5,
    lineHeight: 1.4,
    borderRadius: 8,
    transition: 'all 0.2s ease',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    ':hover': {
      backgroundColor: '#eef2ff',
      color: '#4f46e5',
      borderLeftColor: '#4f46e5',
    },
  },
})

export default function Toc() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        {...stylex.props(
          styles.fab,
          !open && styles.fabPulse,
          open && styles.fabOpen,
        )}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close table of contents' : 'Open table of contents'}
      >
        {open ? <X size={22} color="#000" /> : <List size={22} color="#000" />}
      </button>

      {/* Backdrop overlay — semantic button so screen readers can reach it */}
      <button
        type="button"
        {...stylex.props(styles.overlay, open && styles.overlayEnter)}
        onClick={() => setOpen(false)}
        aria-label="Close table of contents"
        tabIndex={-1}
      />

      {/* Sliding panel */}
      <nav
        {...stylex.props(styles.panel, open && styles.panelEnter)}
      >
        <div {...stylex.props(styles.header)}>
          <h3 {...stylex.props(styles.title)}>
            <span {...stylex.props(styles.titleAccent)}>●</span> Contents
          </h3>
          <button
            type="button"
            {...stylex.props(styles.closeButton)}
            onClick={() => setOpen(false)}
            aria-label="Close table of contents"
          >
            <X size={18} />
          </button>
        </div>

        <ul {...stylex.props(styles.list)}>
          {toc.map((item) => (
            <li key={item.id} {...stylex.props(styles.listItem)}>
              <a
                href={`#${item.id}`}
                {...stylex.props(styles.link)}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
