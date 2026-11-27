/* ---
title: Check a Kubernetes manifest and pinned Docker images
entry: devops-tools/validateK8sManifest, devops-tools/detectUnpinnedDockerImages
node: true
--- */
import { validateK8sManifest, detectUnpinnedDockerImages } from '@smartdevutils/core/devops-tools'

const manifest = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: acme/worker:latest
`
const { errors, warnings } = validateK8sManifest(manifest)
console.log('errors  :', errors)
console.log('warnings:', warnings)

const dockerfile = `FROM node:latest AS build
FROM nginx
FROM postgres:16.4@sha256:0000000000000000000000000000000000000000000000000000000000000000`
for (const img of detectUnpinnedDockerImages(dockerfile)) {
  console.log(`${img.status.padEnd(9)} ${img.image}  ${img.suggestion}`)
}
