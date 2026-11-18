<script setup>
import { ref } from 'vue'

const json = ref('{"region":"eu-west","nodes":["a","b"]}')
const output = ref('')
const lastRun = ref(null)
const flow = 'sequenceDiagram\n  Browser->>API: POST /orders\n  API->>Queue: publish order.created\n  Queue-->>Worker: deliver\n  Worker-->>API: done'

function onOutput(e) {
  output.value = e.detail.error ? `Error: ${e.detail.error}` : `${e.detail.output.length} characters`
}
function toggleTheme() {
  const root = document.documentElement
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <main class="page">
    <h1>SmartDevUtils elements in Vue 3</h1>
    <p><button type="button" @click="toggleTheme">Switch light and dark</button></p>

    <section id="tool">
      <!-- .value sets the DOM property; sdu-output is a normal DOM event. -->
      <sdu-tool tool="json-formatter" mode="format" :value="json" @sdu-output="onOutput"></sdu-tool>
      <p data-testid="last-result">Last result: {{ output }}</p>
    </section>

    <section id="named">
      <sdu-url-encoder mode="encode" value="name=sample user&amp;role=viewer"></sdu-url-encoder>
    </section>

    <section id="diagram">
      <sdu-diagram :source="flow" label="Order flow"></sdu-diagram>
    </section>

    <section id="recipe">
      <sdu-recipe recipe="decode-base64-json-param" @sdu-run="lastRun = $event.detail.run"></sdu-recipe>
    </section>

    <section id="recipe-run">
      <sdu-recipe-run :run="lastRun" upload label="Last run"></sdu-recipe-run>
    </section>
  </main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; }
.page { max-width: 960px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
</style>
