import type { ArchDiagram as ArchDiagramData } from '../../types'

type Props = {
  diagram: ArchDiagramData
}

/** Diagrama de arquitectura dibujado desde datos: cajas + flujos animados. */
export default function ArchDiagram({ diagram }: Props) {
  return (
    <svg viewBox={diagram.viewBox} role="img" aria-label={diagram.label} className="h-auto w-full">
      {diagram.flows.map((d) => (
        <path key={d} d={d} className="lab-flow" />
      ))}
      {diagram.nodes.map((node) => {
        const titleY = node.sub?.length ? node.y + 20 : node.y + node.h / 2 + 4
        return (
          <g key={node.title}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={10}
              fill="var(--lab-bg2)"
              stroke={node.highlight ? 'var(--lab-accent)' : 'var(--lab-line)'}
            />
            <text x={node.x + 12} y={titleY} fill="var(--lab-fg)" fontSize={11} fontFamily="JetBrains Mono, monospace">
              {node.title}
            </text>
            {node.sub?.map((line, i) => (
              <text
                key={line}
                x={node.x + 12}
                y={titleY + 14 + i * 12}
                fill="var(--lab-muted)"
                fontSize={9.5}
                fontFamily="JetBrains Mono, monospace"
              >
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
