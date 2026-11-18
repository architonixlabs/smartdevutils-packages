// Mirrors the website's MigrationGeneratorComponent.generate(). The website shows UP and DOWN side
// by side; `output` is UP by default (option `part`), and both are always in `meta`.
import { generateMigrationSql } from '../../database'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/migration-generator'

export const runner = defineRunner(spec, (input, { options }) => {
  const after = opt.str(options.after)
  const dialect = opt.oneOf<'postgres' | 'mysql'>(options.dialect, ['postgres', 'mysql'], 'postgres')
  const part = opt.oneOf<'up' | 'down' | 'both'>(options.part, ['up', 'down', 'both'], 'up')
  if (!input.trim() && !after.trim()) {
    return { output: '', error: 'Paste a CREATE TABLE statement in "Before" and/or "After".' }
  }
  // generateMigrationSql throws when neither side has a CREATE TABLE; defineRunner turns that into `error`.
  const result = generateMigrationSql(input, after, dialect)
  const up = result.up || '-- No schema changes'
  const down = result.down || '-- No schema changes'
  const output = part === 'up' ? up : part === 'down' ? down : `-- UP\n${up}\n\n-- DOWN\n${down}`
  return { output, meta: { up, down, warnings: result.warnings ?? [], hasChanges: result.hasChanges } }
})

export default runner
