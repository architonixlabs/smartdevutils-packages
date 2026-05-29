import { useState } from 'react'
import { generateFakeDataset, type FakeFieldType, type FakeSchema } from '@smartdevutils/core/data'
import { CopyButton, ToolPanel } from '../shared'

const FIELD_TYPES: FakeFieldType[] = ['fullName','email','phone','uuid','date','url','company','number','boolean','address','city','country','zipCode','ipv4']

export function FakeDataGenerator({ count: defaultCount = 5, onResult }: { schema?: FakeSchema; count?: number; onResult?: (d: object[]) => void }) {
  const [fields, setFields] = useState<Array<{key:string;type:FakeFieldType}>>([{key:'name',type:'fullName'},{key:'email',type:'email'}])
  const [count, setCount] = useState(defaultCount), [output, setOutput] = useState('')

  const generate = () => {
    const schema: FakeSchema = Object.fromEntries(fields.map(f => [f.key, f.type]))
    const data = generateFakeDataset(schema, count)
    const r = JSON.stringify(data, null, 2)
    setOutput(r); onResult?.(data)
  }

  const addField = () => setFields([...fields, {key:`field${fields.length}`,type:'fullName'}])
  const removeField = (i: number) => setFields(fields.filter((_,idx)=>idx!==i))
  const updateField = (i: number, key: string, type: FakeFieldType) => setFields(fields.map((f,idx)=>idx===i?{key,type}:f))

  return (
    <ToolPanel title="Fake Data Generator">
      <div className="space-y-4">
        <div className="space-y-2">
          {fields.map((f,i) => (
            <div key={i} className="flex gap-2">
              <input value={f.key} onChange={e=>updateField(i,e.target.value,f.type)} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="field name" />
              <select value={f.type} onChange={e=>updateField(i,f.key,e.target.value as FakeFieldType)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                {FIELD_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={()=>removeField(i)} className="rounded-md bg-red-100 px-2 py-1.5 text-sm text-red-600">x</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addField} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300">+ Field</button>
          <input type="number" min={1} max={100} value={count} onChange={e=>setCount(Number(e.target.value))} className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <span className="text-sm text-gray-500">rows</span>
          <button onClick={generate} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Generate</button>
        </div>
        {output && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output</span><CopyButton text={output} /></div><pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800 dark:text-green-400">{output}</pre></div>}
      </div>
    </ToolPanel>
  )
}
