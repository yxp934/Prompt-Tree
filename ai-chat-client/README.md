# Cortex - AI Dialogue Topology

A visual dialogue tree interface for AI conversations with context management and token optimization.

## Features

- **Three-Column Layout**: Sidebar for thread navigation, main area for dialogue visualization, and context panel for prompt assembly
- **Visual Dialogue Tree**: Interactive node-based visualization of conversation flow
- **Context Management**: Drag-and-drop context cards with token usage tracking
- **Warm Neutral Design**: Elegant color palette with copper accents

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Visualization**: React Flow
- **Fonts**: Instrument Serif, DM Sans, IBM Plex Mono

## Design System

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Paper | `#faf9f7` | Main background |
| Cream | `#f5f2ed` | Secondary background |
| Ink | `#1a1816` | Primary text |
| Copper | `#b87333` | Accent color |
| Human | `#6b5b4f` | Human message nodes |
| Machine | `#4a6741` | AI response nodes |
| System | `#4f5b6b` | System prompt nodes |

### Typography

- **Display**: Instrument Serif (headings)
- **Body**: DM Sans (content)
- **Mono**: IBM Plex Mono (code, metadata)

## Project Structure

```
src/
  app/
    layout.tsx      # Root layout with fonts and metadata
    page.tsx        # Home page
    globals.css     # Global styles and CSS variables
  components/
    layout/
      MainLayout.tsx    # Three-column main layout
      Sidebar.tsx       # Left sidebar with thread list
      ContextPanel.tsx  # Right context management panel
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Development Progress

### Phase 0: Foundation (Completed)
- [x] Configure Tailwind CSS theme colors and fonts
- [x] Create MainLayout component (three-column layout)
- [x] Create Sidebar component (thread navigation)
- [x] Create ContextPanel component (context management)
- [x] Update layout.tsx with fonts and metadata
- [x] Update page.tsx to use MainLayout

## License

MIT
