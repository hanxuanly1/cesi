<template>
  <div>
    <h2>残次品登记</h2>
    
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
    
    <!-- 残次品登记表单 -->
    <el-card>
      <template #header>
        <span>残次品信息</span>
      </template>
      <el-form :model="form" label-width="100px" style="max-width: 600px">
        <el-form-item label="编号">
          <el-input v-model="form.batch_number" placeholder="输入编号或从上方选择" @blur="verifyBatch" />
          <div v-if="batchInfo" style="margin-top: 5px; color: #67c23a">
            客户：{{ batchInfo.customer_name }}
          </div>
        </el-form-item>
        <el-form-item label="残次品数量">
          <el-input-number v-model="form.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="登记日期">
          <el-date-picker v-model="form.defect_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="form.reason" type="textarea" placeholder="残次品原因" :rows="3" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit" :disabled="!batchInfo">提交登记</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const form = ref({
  batch_number: '',
  quantity: 1,
  defect_date: new Date().toISOString().split('T')[0],
  reason: ''
})

const batchInfo = ref(null)
const customers = ref([])
const selectedCustomer = ref(null)
const selectedCustomerName = ref('')
const customerInventory = ref([])

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
  } catch (error) {
    ElMessage.error('编号不存在')
    batchInfo.value = null
  }
}

const resetForm = () => {
  form.value = {
    batch_number: '',
    quantity: 1,
    defect_date: new Date().toISOString().split('T')[0],
    reason: ''
  }
  batchInfo.value = null
}

const submit = async () => {
  try {
    await axios.post('/api/defects', form.value)
    ElMessage.success('登记成功')
    resetForm()
    // 如果有选中的客户，刷新库存列表
    if (selectedCustomer.value) {
      await loadCustomerInventory()
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '登记失败')
  }
}
</script>
