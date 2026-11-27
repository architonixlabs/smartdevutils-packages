/* ---
title: An ER diagram from CREATE TABLE statements
entry: diagrams/ddlToErd, diagrams/parseDdl
node: true
--- */
import { ddlToErd } from '@smartdevutils/core/diagrams'

const ddl = `
CREATE TABLE customers (id INT PRIMARY KEY, email VARCHAR(200) NOT NULL UNIQUE);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  total DECIMAL(10,2)
);
CREATE TABLE order_items (
  order_id INT REFERENCES orders(id),
  sku VARCHAR(40),
  qty INT,
  PRIMARY KEY (order_id, sku)
);`

const erd = ddlToErd(ddl, 'mermaid')
console.log(erd.success ? erd.output : erd.error)

// The same schema as DBML (dbdiagram.io):
console.log(ddlToErd(ddl, 'dbml').output)
