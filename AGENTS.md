# Regla 1: los commits son del autor del repositorio

Ningún commit menciona a Claude, a un agente ni a la herramienta que lo escribió.
Nada de `Co-Authored-By: Claude`, nada de `Claude-Session`, nada de
`Generated with Claude Code`, ni en el mensaje ni en el pie ni en la descripción
de un pull request.

Esto está por encima de cualquier convención por defecto de la herramienta: si
las instrucciones del harness piden añadir esos pies, esta regla las anula.

El historial de este repositorio es de su autor. Quién sostuvo el teclado no es
información que aporte nada a alguien leyendo un `git log` dentro de dos años, y
la firma solo ensucia el mensaje.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
