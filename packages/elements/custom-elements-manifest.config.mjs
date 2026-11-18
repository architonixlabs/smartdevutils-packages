// Config for `cem analyze`: our elements register through defineElement('sdu-x', Class), which the
// analyzer does not know, so this plugin marks those classes as custom elements with their tag names.
// Events come from the @fires tags in each class's JSDoc.
function defineElementPlugin() {
  return {
    name: 'sdu-define-element',
    analyzePhase({ ts, node, moduleDoc }) {
      if (!ts.isCallExpression(node) || node.expression.getText() !== 'defineElement') return
      const [tag, cls] = node.arguments
      if (!tag || !cls || !ts.isStringLiteral(tag)) return
      const decl = moduleDoc.declarations?.find((d) => d.name === cls.getText())
      if (decl) {
        decl.customElement = true
        decl.tagName = tag.text
      } else {
        // Named tool elements are made by a factory: record them as subclasses of SduToolElement.
        moduleDoc.declarations = moduleDoc.declarations ?? []
        moduleDoc.declarations.push({
          kind: 'class',
          name: cls.getText(),
          customElement: true,
          tagName: tag.text,
          superclass: { name: 'SduToolElement', module: 'src/tool.ts' },
        })
      }
      moduleDoc.exports = moduleDoc.exports ?? []
      moduleDoc.exports.push({ kind: 'custom-element-definition', name: tag.text, declaration: { name: cls.getText(), module: moduleDoc.path } })
    },
    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules) {
        for (const d of mod.declarations ?? []) {
          if (!d.customElement) continue
          d.events = (d.events ?? []).filter((e) => e.name !== 'type')
          // Private state fields (leading underscore) are not part of the API.
          d.members = (d.members ?? []).filter((m) => !m.name.startsWith('_'))
          d.attributes = (d.attributes ?? []).filter((a) => !a.name.startsWith('_'))
        }
      }
    },
  }
}

export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/cdn.ts'],
  outdir: '.',
  litelement: true,
  plugins: [defineElementPlugin()],
}
