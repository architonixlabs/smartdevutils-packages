/* ---
title: Read a .env file and plan a subnet
entry: devops/envToJson, devops/cidrExpand
node: true
--- */
import { envToJson, cidrExpand } from '@smartdevutils/core/devops'

const env = `# app settings
PORT=8080
API_URL="https://api.example.com"
FEATURE_FLAGS=search,dark-mode`
console.log(envToJson(env))

for (const block of ['10.0.0.0/24', '10.0.4.0/22', '192.168.1.128/26']) {
  const info = cidrExpand(block)
  console.log(`${block}: ${info.hosts} hosts, mask ${info.mask}, broadcast ${info.broadcast}`)
}
