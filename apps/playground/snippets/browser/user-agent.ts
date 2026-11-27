/* ---
title: Parse user-agent strings
entry: user-agent/parseUserAgent
description: Pass a string to parse it anywhere (this runs in Node too); with no argument it reads navigator.userAgent.
node: true
--- */
import { parseUserAgent } from '@smartdevutils/browser/user-agent'

const agents = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
]

for (const ua of agents) {
  const { browser, version, os, device } = parseUserAgent(ua)
  console.log(`${browser} ${version} on ${os} (${device})`)
}
