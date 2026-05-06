<template>
  <div>
    <h2>库存查询</h2>
    
    <!-- 客户搜索 -->
    <el-form inline style="margin-top: 20px">
      <el-form-item label="搜索客户">
        <el-select 
          v-model="selectedCustomer" 
          placeholder="全部客户" 
          filterable
          clearable
          @change="filterInventory"
          style="width: 300px"
        >
          <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="exportInventory">导出库存</el-button>
      </el-form-item>
    </el-form>
    
    <el-table :data="filteredInventory" style="margin-top: 20px" border>
      <el-table-column prop="batch_number" label="编号" width="80" />
      <el-table-column prop="customer_name" label="客户" width="120" />
      <el-table-column prop="product_name" label="产品" width="120" />
      <el-table-column prop="quantity" label="入库数量" width="100" />
      <el-table-column prop="unit_price" label="入库单价" width="100" />
      <el-table-column prop="total_price" label="入库总价" width="100" />
      <el-table-column prop="out_quantity" label="已出库" width="90" />
      <el-table-column prop="defect_quantity" label="残次品" width="90" />
      <el-table-column prop="remaining_quantity" label="剩余库存" width="100">
        <template #default="{ row }">
          <span :style="{ color: row.remaining_quantity > 0 ? '#67c23a' : '#999' }">
            {{ row.remaining_quantity }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="in_date" label="入库日期" width="120" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const inventory = ref([])
const customers = ref([])
const selectedCustomer = ref(null)

const filteredInventory = computed(() => {
  if (!selectedCustomer.value) {
    return inventory.value
  }
  return inventory.value.filter(item => item.customer_id === selectedCustomer.value)
})

const loadData = async () => {
  const res = await axios.get('/api/inventory')
  inventory.value = res.data
}

const filterInventory = () => {
  // 触发计算属性更新
}

const exportInventory = () => {
  const data = filteredInventory.value
  let csv = '编号,客户,产品,入库数量,入库单价,入库总价,已出库,残次品,剩余库存,入库日期\n'
  data.forEach(row => {
    csv += `${row.batch_number},${row.customer_name},${row.product_name},${row.quantity},${row.unit_price},${row.total_price},${row.out_quantity},${row.defect_quantity},${row.remaining_quantity},${row.in_date}\n`
  })
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const customerName = selectedCustomer.value ? customers.value.find(c => c.id === selectedCustomer.value)?.name : '全部'
  link.download = `库存查询_${customerName}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  ElMessage.success('导出成功')
}

onMounted(async () => {
  await loadData()
  const custRes = await axios.get('/api/customers')
  customers.value = custRes.data
})
</script>
