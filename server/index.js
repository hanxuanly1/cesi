const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 初始化数据库
let db;
const dbFile = process.env.NODE_ENV === 'production' ? '/app/data/database.db' : 'database.db';

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 确保数据目录存在
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  if (fs.existsSync(dbFile)) {
    const buffer = fs.readFileSync(dbFile);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(dbFile, data);
}

async function setupDatabase() {
  await initDatabase();
  
  // 创建表
  db.run(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    in_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS outbound (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    out_date DATE NOT NULL,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_number) REFERENCES inventory(batch_number)
  );

  CREATE TABLE IF NOT EXISTS defects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    defect_date DATE NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_number) REFERENCES inventory(batch_number)
  );

  CREATE TABLE IF NOT EXISTS customer_alert_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL UNIQUE,
    defect_count_warning INTEGER DEFAULT 3,
    defect_count_danger INTEGER DEFAULT 5,
    defect_quantity_warning INTEGER DEFAULT 50,
    defect_quantity_danger INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );`);
  
  saveDatabase();
}

// API 路由

// 客户管理
app.get('/api/customers', (req, res) => {
  const stmt = db.prepare('SELECT * FROM customers ORDER BY name');
  const customers = [];
  while (stmt.step()) {
    customers.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(customers);
});

// 获取客户及其残次品统计和预警状态
app.get('/api/customers/with-alerts', (req, res) => {
  const stmt = db.prepare(`
    SELECT 
      c.*,
      COALESCE(s.defect_count_warning, 3) as defect_count_warning,
      COALESCE(s.defect_count_danger, 5) as defect_count_danger,
      COALESCE(s.defect_quantity_warning, 50) as defect_quantity_warning,
      COALESCE(s.defect_quantity_danger, 100) as defect_quantity_danger,
      COALESCE(defect_stats.defect_count, 0) as defect_count,
      COALESCE(defect_stats.total_defect_quantity, 0) as total_defect_quantity
    FROM customers c
    LEFT JOIN customer_alert_settings s ON c.id = s.customer_id
    LEFT JOIN (
      SELECT 
        i.customer_id,
        COUNT(DISTINCT d.id) as defect_count,
        SUM(d.quantity) as total_defect_quantity
      FROM defects d
      JOIN inventory i ON d.batch_number = i.batch_number
      GROUP BY i.customer_id
    ) defect_stats ON c.id = defect_stats.customer_id
    ORDER BY c.name
  `);
  const customers = [];
  while (stmt.step()) {
    const customer = stmt.getAsObject();
    
    // 计算预警级别
    let alertLevel = 'safe'; // green
    if (customer.defect_count >= customer.defect_count_danger || 
        customer.total_defect_quantity >= customer.defect_quantity_danger) {
      alertLevel = 'danger'; // red
    } else if (customer.defect_count >= customer.defect_count_warning || 
               customer.total_defect_quantity >= customer.defect_quantity_warning) {
      alertLevel = 'warning'; // orange
    }
    
    customer.alert_level = alertLevel;
    customers.push(customer);
  }
  stmt.free();
  res.json(customers);
});

app.post('/api/customers', (req, res) => {
  const { name } = req.body;
  
  // 先检查客户是否存在
  const checkStmt = db.prepare('SELECT name FROM customers WHERE name = ?');
  checkStmt.bind([name]);
  const exists = checkStmt.step();
  checkStmt.free();
  
  if (exists) {
    return res.status(400).json({ error: '客户已存在' });
  }
  
  try {
    db.run('INSERT INTO customers (name) VALUES (?)', [name]);
    saveDatabase();
    const stmt = db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const id = stmt.getAsObject().id;
    stmt.free();
    
    // 创建默认预警设置
    db.run('INSERT INTO customer_alert_settings (customer_id) VALUES (?)', [id]);
    saveDatabase();
    
    res.json({ id, name });
  } catch (error) {
    res.status(400).json({ error: '添加客户失败：' + error.message });
  }
});

// 获取客户预警设置
app.get('/api/customer-alert-settings/:customer_id', (req, res) => {
  const { customer_id } = req.params;
  const stmt = db.prepare(`
    SELECT * FROM customer_alert_settings WHERE customer_id = ?
  `);
  stmt.bind([customer_id]);
  let settings = null;
  if (stmt.step()) {
    settings = stmt.getAsObject();
  }
  stmt.free();
  
  if (!settings) {
    // 返回默认值
    settings = {
      customer_id: parseInt(customer_id),
      defect_count_warning: 3,
      defect_count_danger: 5,
      defect_quantity_warning: 50,
      defect_quantity_danger: 100
    };
  }
  
  res.json(settings);
});

// 更新客户预警设置
app.post('/api/customer-alert-settings', (req, res) => {
  const { customer_id, defect_count_warning, defect_count_danger, defect_quantity_warning, defect_quantity_danger } = req.body;
  
  // 检查是否已存在
  const checkStmt = db.prepare('SELECT id FROM customer_alert_settings WHERE customer_id = ?');
  checkStmt.bind([customer_id]);
  const exists = checkStmt.step();
  checkStmt.free();
  
  if (exists) {
    // 更新
    db.run(`
      UPDATE customer_alert_settings 
      SET defect_count_warning = ?, defect_count_danger = ?, 
          defect_quantity_warning = ?, defect_quantity_danger = ?
      WHERE customer_id = ?
    `, [defect_count_warning, defect_count_danger, defect_quantity_warning, defect_quantity_danger, customer_id]);
  } else {
    // 插入
    db.run(`
      INSERT INTO customer_alert_settings 
      (customer_id, defect_count_warning, defect_count_danger, defect_quantity_warning, defect_quantity_danger)
      VALUES (?, ?, ?, ?, ?)
    `, [customer_id, defect_count_warning, defect_count_danger, defect_quantity_warning, defect_quantity_danger]);
  }
  
  saveDatabase();
  res.json({ message: '设置成功' });
});

// 产品管理
app.get('/api/products', (req, res) => {
  const stmt = db.prepare(`
    SELECT p.*, c.name as customer_name 
    FROM products p 
    JOIN customers c ON p.customer_id = c.id
    ORDER BY p.created_at DESC
  `);
  const products = [];
  while (stmt.step()) {
    products.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const { customer_id, product_name } = req.body;
  db.run('INSERT INTO products (customer_id, product_name) VALUES (?, ?)', [customer_id, product_name]);
  saveDatabase();
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const id = stmt.getAsObject().id;
  stmt.free();
  res.json({ id, customer_id, product_name });
});

// 获取下一个可用编号
app.get('/api/inventory/next-batch-number', (req, res) => {
  const stmt = db.prepare('SELECT batch_number FROM inventory ORDER BY CAST(batch_number AS INTEGER) DESC LIMIT 1');
  let lastNumber = 0;
  if (stmt.step()) {
    const result = stmt.getAsObject();
    const match = result.batch_number.match(/\d+/);
    if (match) {
      lastNumber = parseInt(match[0]);
    }
  }
  stmt.free();
  res.json({ next_batch_number: (lastNumber + 1).toString() });
});

// 调试：查看所有编号
app.get('/api/inventory/all-batch-numbers', (req, res) => {
  const stmt = db.prepare('SELECT batch_number FROM inventory ORDER BY batch_number');
  const numbers = [];
  while (stmt.step()) {
    numbers.push(stmt.getAsObject().batch_number);
  }
  stmt.free();
  res.json({ batch_numbers: numbers });
});

// 入库管理
app.post('/api/inventory/inbound', (req, res) => {
  const { batch_number, customer_id, product_id, quantity, unit_price, in_date } = req.body;
  const total_price = quantity * unit_price;
  
  // 先检查编号是否存在
  const checkStmt = db.prepare('SELECT batch_number FROM inventory WHERE batch_number = ?');
  checkStmt.bind([batch_number]);
  const exists = checkStmt.step();
  checkStmt.free();
  
  if (exists) {
    return res.status(400).json({ error: '编号已存在' });
  }
  
  try {
    db.run(`
      INSERT INTO inventory (batch_number, customer_id, product_id, quantity, remaining_quantity, unit_price, total_price, in_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [batch_number, customer_id, product_id, quantity, quantity, unit_price, total_price, in_date]);
    saveDatabase();
    const stmt = db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const id = stmt.getAsObject().id;
    stmt.free();
    res.json({ id, message: '入库成功' });
  } catch (error) {
    res.status(400).json({ error: '入库失败：' + error.message });
  }
});

// 出库管理
app.post('/api/inventory/outbound', (req, res) => {
  const { batch_number, quantity, unit_price, out_date, operator } = req.body;
  
  const stmt = db.prepare('SELECT * FROM inventory WHERE batch_number = ?');
  stmt.bind([batch_number]);
  let inventory = null;
  if (stmt.step()) {
    inventory = stmt.getAsObject();
  }
  stmt.free();
  
  if (!inventory) {
    return res.status(404).json({ error: '编号不存在' });
  }
  
  if (inventory.remaining_quantity < quantity) {
    return res.status(400).json({ error: '库存不足' });
  }
  
  const total_price = quantity * unit_price;
  
  db.run('UPDATE inventory SET remaining_quantity = remaining_quantity - ? WHERE batch_number = ?', [quantity, batch_number]);
  db.run('INSERT INTO outbound (batch_number, quantity, unit_price, total_price, out_date, operator) VALUES (?, ?, ?, ?, ?, ?)', [batch_number, quantity, unit_price, total_price, out_date, operator]);
  saveDatabase();
  
  res.json({ message: '出库成功' });
});

// 残次品登记
app.post('/api/defects', (req, res) => {
  const { batch_number, quantity, defect_date, reason } = req.body;
  
  const stmt = db.prepare('SELECT * FROM inventory WHERE batch_number = ?');
  stmt.bind([batch_number]);
  let inventory = null;
  if (stmt.step()) {
    inventory = stmt.getAsObject();
  }
  stmt.free();
  
  if (!inventory) {
    return res.status(404).json({ error: '编号不存在' });
  }
  
  db.run('INSERT INTO defects (batch_number, quantity, defect_date, reason) VALUES (?, ?, ?, ?)', [batch_number, quantity, defect_date, reason]);
  saveDatabase();
  const stmt2 = db.prepare('SELECT last_insert_rowid() as id');
  stmt2.step();
  const id = stmt2.getAsObject().id;
  stmt2.free();
  res.json({ id, message: '登记成功' });
});

// 库存查询
app.get('/api/inventory', (req, res) => {
  const stmt = db.prepare(`
    SELECT i.*, c.name as customer_name, p.product_name,
           (SELECT COALESCE(SUM(quantity), 0) FROM outbound WHERE batch_number = i.batch_number) as out_quantity,
           (SELECT COALESCE(SUM(quantity), 0) FROM defects WHERE batch_number = i.batch_number) as defect_quantity
    FROM inventory i
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    ORDER BY i.in_date DESC
  `);
  const inventory = [];
  while (stmt.step()) {
    inventory.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(inventory);
});

// 验证编号归属
app.get('/api/inventory/verify/:batch_number', (req, res) => {
  const { batch_number } = req.params;
  const stmt = db.prepare(`
    SELECT i.*, c.name as customer_name 
    FROM inventory i 
    JOIN customers c ON i.customer_id = c.id 
    WHERE i.batch_number = ?
  `);
  stmt.bind([batch_number]);
  let inventory = null;
  if (stmt.step()) {
    inventory = stmt.getAsObject();
  }
  stmt.free();
  
  if (!inventory) {
    return res.status(404).json({ error: '编号不存在' });
  }
  res.json(inventory);
});

// 按客户查询库存
app.get('/api/inventory/by-customer/:customer_id', (req, res) => {
  const { customer_id } = req.params;
  const stmt = db.prepare(`
    SELECT i.*, c.name as customer_name, p.product_name,
           (SELECT COALESCE(SUM(quantity), 0) FROM outbound WHERE batch_number = i.batch_number) as out_quantity,
           (SELECT COALESCE(SUM(quantity), 0) FROM defects WHERE batch_number = i.batch_number) as defect_quantity
    FROM inventory i
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    WHERE i.customer_id = ?
    ORDER BY i.in_date DESC
  `);
  stmt.bind([customer_id]);
  const inventory = [];
  while (stmt.step()) {
    inventory.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(inventory);
});

// 财务报表 - 月度汇总
app.get('/api/reports/monthly', (req, res) => {
  const { year, month } = req.query;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-31`;
  
  const stmt = db.prepare(`
    SELECT 
      c.name as customer_name,
      p.product_name,
      SUM(i.quantity) as total_in,
      SUM(COALESCE(o.out_qty, 0)) as total_out,
      SUM(COALESCE(d.defect_qty, 0)) as total_defect,
      SUM(i.remaining_quantity) as remaining
    FROM inventory i
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    LEFT JOIN (
      SELECT batch_number, SUM(quantity) as out_qty 
      FROM outbound 
      WHERE out_date BETWEEN ? AND ?
      GROUP BY batch_number
    ) o ON i.batch_number = o.batch_number
    LEFT JOIN (
      SELECT batch_number, SUM(quantity) as defect_qty 
      FROM defects 
      WHERE defect_date BETWEEN ? AND ?
      GROUP BY batch_number
    ) d ON i.batch_number = d.batch_number
    WHERE i.in_date BETWEEN ? AND ?
    GROUP BY c.id, p.id
    ORDER BY c.name, p.product_name
  `);
  stmt.bind([startDate, endDate, startDate, endDate, startDate, endDate]);
  const report = [];
  while (stmt.step()) {
    report.push(stmt.getAsObject());
  }
  stmt.free();
  
  res.json(report);
});

// 每日统计
app.get('/api/reports/daily', (req, res) => {
  const { date } = req.query;
  
  const stmt1 = db.prepare(`
    SELECT c.name as customer_name, p.product_name, SUM(i.quantity) as quantity
    FROM inventory i
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    WHERE i.in_date = ?
    GROUP BY c.id, p.id
  `);
  stmt1.bind([date]);
  const inbound = [];
  while (stmt1.step()) {
    inbound.push(stmt1.getAsObject());
  }
  stmt1.free();
  
  const stmt2 = db.prepare(`
    SELECT c.name as customer_name, p.product_name, SUM(o.quantity) as quantity
    FROM outbound o
    JOIN inventory i ON o.batch_number = i.batch_number
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    WHERE o.out_date = ?
    GROUP BY c.id, p.id
  `);
  stmt2.bind([date]);
  const outbound = [];
  while (stmt2.step()) {
    outbound.push(stmt2.getAsObject());
  }
  stmt2.free();
  
  const stmt3 = db.prepare(`
    SELECT c.name as customer_name, p.product_name, SUM(d.quantity) as quantity
    FROM defects d
    JOIN inventory i ON d.batch_number = i.batch_number
    JOIN customers c ON i.customer_id = c.id
    JOIN products p ON i.product_id = p.id
    WHERE d.defect_date = ?
    GROUP BY c.id, p.id
  `);
  stmt3.bind([date]);
  const defects = [];
  while (stmt3.step()) {
    defects.push(stmt3.getAsObject());
  }
  stmt3.free();
  
  res.json({ inbound, outbound, defects });
});

// 每日财务统计
app.get('/api/reports/daily-finance', (req, res) => {
  const { date } = req.query;
  
  // 今日入库成本
  const inboundStmt = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as inbound_cost
    FROM inventory
    WHERE in_date = ?
  `);
  inboundStmt.bind([date]);
  inboundStmt.step();
  const inbound_cost = inboundStmt.getAsObject().inbound_cost;
  inboundStmt.free();
  
  // 今日出库收入
  const outboundStmt = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as outbound_income
    FROM outbound
    WHERE out_date = ?
  `);
  outboundStmt.bind([date]);
  outboundStmt.step();
  const outbound_income = outboundStmt.getAsObject().outbound_income;
  outboundStmt.free();
  
  const profit = outbound_income - inbound_cost;
  
  res.json({
    inbound_cost,
    outbound_income,
    profit
  });
});

// 月度财务统计
app.get('/api/reports/monthly-finance', (req, res) => {
  const { year, month } = req.query;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-31`;
  
  // 月度入库成本
  const inboundStmt = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as inbound_cost
    FROM inventory
    WHERE in_date BETWEEN ? AND ?
  `);
  inboundStmt.bind([startDate, endDate]);
  inboundStmt.step();
  const inbound_cost = inboundStmt.getAsObject().inbound_cost;
  inboundStmt.free();
  
  // 月度出库收入
  const outboundStmt = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as outbound_income
    FROM outbound
    WHERE out_date BETWEEN ? AND ?
  `);
  outboundStmt.bind([startDate, endDate]);
  outboundStmt.step();
  const outbound_income = outboundStmt.getAsObject().outbound_income;
  outboundStmt.free();
  
  const profit = outbound_income - inbound_cost;
  const profit_rate = inbound_cost > 0 ? (profit / inbound_cost) * 100 : 0;
  
  res.json({
    inbound_cost,
    outbound_income,
    profit,
    profit_rate
  });
});

setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
});
