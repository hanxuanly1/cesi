<template>
  <div>
    <h2>入库管理</h2>
    <el-form :model="form" label-width="100px" style="max-width: 600px; margin-top: 20px">
      <el-form-item label="编号">
        <div style="display: flex; align-items: center; gap: 10px">
          <el-input v-model="form.batch_number" placeholder="自动编号" :disabled="!customBatchNumber" style="flex: 1" />
          <el-checkbox v-model="customBatchNumber" @change="handleCustomBatchNumberChange">自定义编号</el-checkbox>
        </div>
      </el-form-item>
      <el-form-item label="客户">
        <el-select v-model="form.customer_id" placeholder="选择客户" @change="loadProducts">
          <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="产品">
        <el-select v-model="form.product_id" placeholder="选择产品">
          <el-option v-for="p in products" :key="p.id" :label="p.product_name" :value="p.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.quantity" :min="1" @change="calculateTotal" />
      </el-form-item>
      <el-form-item label="单价">
        <el-input-number v-model="form.unit_price" :min="0" :precision="2" @change="calculateTotal" />
      </el-form-item>
      <el-form-item label="总价">
        <el-input v-model="totalPrice" disabled />
      </el-form-item>
      <el-form-item label="入库日期">
        <el-date-picker v-model="form.in_date" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submit">提交入库</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const form = ref({
  batch_number: '',
  customer_id: null,
  product_id: null,
  quantity: 1,
  unit_price: 0,
  in_date: new Date().toISOString().split('T')[0]
})

const customers = ref([])
const products = ref([])
const allProducts = ref([])
const customBatchNumber = ref(false)

const totalPrice = computed(() => {
  return (form.value.quantity * form.value.unit_price).toFixed(2)
})

const calculateTotal = () => {
  // 触发计算
}

const loadNextBatchNumber = async () => {
  const res = await axios.get('/api/inventory/next-batch-number')
  form.value.batch_number = res.data.next_batch_number
}

const handleCustomBatchNumberChange = () => {
  if (!customBatchNumber.value) {
    loadNextBatchNumber()
  } else {
    form.value.batch_number = ''
  }
}

onMounted(async () => {
  const res = await axios.get('/api/customers')
  customers.value = res.data
  const prodRes = await axios.get('/api/products')
  allProducts.value = prodRes.data
  await loadNextBatchNumber()
})

const loadProducts = () => {
  products.value = allProducts.value.filter(p => p.customer_id === form.value.customer_id)
  form.value.product_id = null
}

const submit = async () => {
  try {
    await axios.post('/api/inventory/inbound', form.value)
    ElMessage.success('入库成功')
    form.value = {
      batch_number: '',
      customer_id: null,
      product_id: null,
      quantity: 1,
      unit_price: 0,
      in_date: new Date().toISOString().split('T')[0]
    }
    customBatchNumber.value = false
    await loadNextBatchNumber()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '入库失败')
  }
}
</script>
