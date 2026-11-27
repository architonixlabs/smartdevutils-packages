/* ---
title: Draw a Docker Compose stack
entry: diagrams/composeTextToMermaid
node: true
--- */
import { composeTextToMermaid } from '@smartdevutils/core/diagrams'

const compose = `services:
  web:
    image: nginx:1.27
    ports: ["8080:80"]
    depends_on: [api]
  api:
    image: node:22-alpine
    environment:
      DATABASE_URL: postgres://db:5432/shop
    depends_on: [db]
  db:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata: {}
`

const diagram = composeTextToMermaid(compose)
console.log(`${diagram.services} services${diagram.problems.length ? `, problems: ${diagram.problems.join('; ')}` : ''}`)
console.log(diagram.mermaid)
