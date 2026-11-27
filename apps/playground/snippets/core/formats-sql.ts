/* ---
title: Format a one-line SQL query
entry: formats/sqlFormat, formats/sqlMinify
node: true
--- */
import { sqlFormat, sqlMinify } from '@smartdevutils/core/formats'

const query =
  "select o.id, c.email, sum(i.qty * i.price) as total from orders o join customers c on c.id = o.customer_id join order_items i on i.order_id = o.id where o.status = 'paid' group by o.id, c.email order by total desc limit 10"

const pretty = sqlFormat(query)
console.log(pretty)
console.log()
console.log(sqlMinify(pretty))
