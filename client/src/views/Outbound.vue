<template>
  <div>
    <h2>出库管理</h2>
    
    <!-- 客户搜索区域 -->
    <el-card style="margin-bottom: 20px">
      <el-form inline>
        <el-form-item label="搜索客户">
          <el-select 
            v-model="selectedCustomer" 
            placeholder="选择客户查看库存" 
            filterable
            clearable
            @change="loadCustomerInventory"
            style="width: 300px"
          >
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <!-- 客户库存列表 -->
      <div v-if="customerInventory.length > 0" style="margin-top: 20px">
        <h4>{{ selectedCustomerName }} 的库存产品</h4>
        <el-table :data="customerInventory" border @row-click="selectBatch">
          <el-table-column prop="batch_number" label="编号" width="100" />
          <el-table-column prop="product_name" label="产品" width="200" />
          <el-table-column prop="remaining_quantity" label="剩余库存" width="120">
            <template #default="{ row }">
              <span :style="{ color: row.remaining_quantity > 0 ? '#67c23a' : '#999' }">
                {{ row.remaining_quantity }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="unit_price" label="入库单价" width="120" />
          <el-table-column prop="in_date" label="入库日期" width="120" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click.stop="selectBatch(row)">选择</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else-if="selectedCustomer" style="margin-top: 20px; color: #999">
        该客户暂无库存
      </div>
    </el-card>
    
    <!-- 出库表单 -->
    <el-card>
      <template #header>
        <span>出库信息</span>
      </template>
      <el-form :model="form" label-width="100px" style="max-width: 600px">
        <el-form-item label="编号">
          <el-input v-model="form.batch_number" placeholder="输入编号或从上方选择" @blur="verifyBatch" />
          <div v-if="batchInfo" style="margin-top: 5px; color: #67c23a">
            客户：{{ batchInfo.customer_name }} | 剩余库存：{{ batchInfo.remaining_quantity }} | 入库单价：{{ batchInfo.unit_price }}
          </div>
        </el-form-item>
        <el-form-item label="出库数量">
          <el-input-number v-model="form.quantity" :min="1" :max="batchInfo?.remaining_quantity || 999999" @change="calculateTotal" />
        </el-form-item>
        <el-form-item label="出库单价">
          <el-input-number v-model="form.unit_price" :min="0" :precision="2" @change="calculateTotal" />
        </el-form-item>
        <el-form-item label="总价">
          <el-input v-model="totalPrice" disabled />
        </el-form-item>
        <el-form-item label="出库日期">
          <el-date-picker v-model="form.out_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="form.operator" placeholder="操作员姓名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit" :disabled="!batchInfo">提交出库</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const form = ref({
  batch_number: '',
  quantity: 1,
  unit_price: 0,
  out_date: new Date().toISOString().split('T')[0],
  operator: ''
})

const batchInfo = ref(null)
const customers = ref([])
const selectedCustomer = ref(null)
const selectedCustomerName = ref('')
const customerInventory = ref([])

const totalPrice = computed(() => {
  return (form.value.quantity * form.value.unit_price).toFixed(2)
})

const calculateTotal = () => {
  // 触发计算
}

onMounted(async () => {
  const res = await axios.get('/api/customers')
  customers.value = res.data
})

const loadCustomerInventory = async () => {
  if (!selectedCustomer.value) {
    customerInventory.value = []
    selectedCustomerName.value = ''
    return
  }
  
  try {
    const customer = customers.value.find(c => c.id === selectedCustomer.value)
    selectedCustomerName.value = customer?.name || ''
    
    const res = await axios.get(`/api/inventory/by-customer/${selectedCustomer.value}`)
    customerInventory.value = res.data.filter(item => item.remaining_quantity > 0)
    
    if (customerInventory.value.length === 0) {
      ElMessage.info('该客户暂无可用库存')
    }
  } catch (error) {
    ElMessage.error('加载库存失败')
  }
}

const selectBatch = async (row) => {
  form.value.batch_number = row.batch_number
  await verifyBatch()
}

const verifyBatch = async () => {
  if (!form.value.batch_number) {
    batchInfo.value = null
    return
  }
  try {
    const res = await axios.get(`/api/inventory/verify/${form.value.batch_number}`)
    batchInfo.value = res.data
    // 自动填充入库单价作为出库单价
    form.value.unit_price = res.data.unit_price || 0
    // 设置最大出库数量
    if (form.value.quantity > res.data.remaining_quantity) {
      form.value.quantity = res.data.remaining_quantity
    }
  } catch (error) {
    ElMessage.error('编号不存在')
    batchInfo.value = null
  }
}

const resetForm = () => {
  form.value = {
    batch_number: '',
    quantity: 1,
    unit_price: 0,
    out_date: new Date().toISOString().split('T')[0],
    operator: ''
  }
  batchInfo.value = null
}

const submit = async () => {
  if (form.value.quantity > batchInfo.value.remaining_quantity) {
    ElMessage.error('出库数量不能大于剩余库存')
    return
  }
  
  try {
    await axios.post('/api/inventory/outbound', form.value)
    ElMessage.success('出库成功')
    resetForm()
    // 如果有选中的客户，刷新库存列表
    if (selectedCustomer.value) {
      await loadCustomerInventory()
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '出库失败')
  }
}
</script>
