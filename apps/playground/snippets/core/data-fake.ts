/* ---
title: Fake test data from a schema
entry: data/generateFakeDataset, data/generateFakeRecord
description: Each field type is a faker generator: fullName, email, uuid, company, city, ipv4 and more.
node: true
--- */
import { generateFakeDataset, type FakeSchema } from '@smartdevutils/core/data'

const schema: FakeSchema = {
  id: 'uuid',
  name: 'fullName',
  email: 'email',
  company: 'company',
  city: 'city',
  lastLoginIp: 'ipv4',
}

for (const row of generateFakeDataset(schema, 5)) console.log(row)
