<template>
  <div>
    <h2>基础设置</h2>
    
    <el-card style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>客户管理</span>
          <el-button type="primary" size="small" @click="showAddCustomer = true">添加客户</el-button>
        </div>
      </template>
      <el-table :data="customers" border :row-class-name="getRowClassName">
        <el-table-column prop="name" label="客户名称" width="150" />
        <el-table-column label="残次品状态" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.alert_level === 'danger'" type="danger">严重警告</el-tag>
            <el-tag v-else-if="row.alert_level === 'warning'" type="warning">警告</el-tag>
            <el-tag v-else type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="残次品统计" width="200">
          <template #default="{ row }">
            次数: {{ row.defect_count }} / 数量: {{ row.total_defect_quantity }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="openAlertSettings(row)">预警设置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-card style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>产品管理</span>
          <el-button type="primary" size="small" @click="showAddProduct = true">添加产品</el-button>
        </div>
      </template>
      <el-table :data="products" border>
        <el-table-column prop="customer_name" label="所属客户" />
        <el-table-column prop="product_name" label="产品名称" />
        <el-table-column prop="created_at" label="创建时间" />
      </el-table>
    </el-card>
    
    <el-dialog v-model="showAddCustomer" title="添加客户" width="400px">
      <el-input v-model="newCustomer" placeholder="客户名称" />
      <template #footer>
        <el-button @click="showAddCustomer = false">取消</el-button>
        <el-button type="primary" @click="addCustomer">确定</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="showAddProduct" title="添加产品" width="400px">
      <el-form label-width="80px">
        <el-form-item label="客户">
          <el-select v-model="newProduct.customer_id" placeholder="选择客户">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="newProduct.product_name" placeholder="产品名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProduct = false">取消</el-button>
        <el-button type="primary" @click="addProduct">确定</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="showAlertSettings" title="客户残次品预警设置" width="500px">
      <el-form :model="alertSettings" label-width="150px">
        <el-divider content-position="left">残次品次数预警</el-divider>
        <el-form-item label="警告阈值（橙色）">
          <el-input-number v-model="alertSettings.defect_count_warning" :min="1" />
          <span style="margin-left: 10px; color: #999">次</span>
        </el-form-item>
        <el-form-item label="危险阈值（红色）">
          <el-input-number v-model="alertSettings.defect_count_danger" :min="1" />
          <span style="margin-left: 10px; color: #999">次</span>
        </el-form-item>
        
        <el-divider content-position="left">残次品数量预警</el-divider>
        <el-form-item label="警告阈值（橙色）">
          <el-input-number v-model="alertSettings.defect_quantity_warning" :min="1" />
          <span style="margin-left: 10px; color: #999">个</span>
        </el-form-item>
        <el-form-item label="危险阈值（红色）">
          <el-input-number v-model="alertSettings.defect_quantity_danger" :min="1" />
          <span style="margin-left: 10px; color: #999">个</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAlertSettings = false">取消</el-button>
        <el-button type="primary" @click="saveAlertSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const customers = ref([])
const products = ref([])
const showAddCustomer = ref(false)
const showAddProduct = ref(false)
const showAlertSettings = ref(false)
const newCustomer = ref('')
const newProduct = ref({ customer_id: null, product_name: '' })
const alertSettings = ref({
  customer_id: null,
  defect_count_warning: 3,
  defect_count_danger: 5,
  defect_quantity_warning: 50,
  defect_quantity_danger: 100
})

const getRowClassName = ({ row }) => {
  if (row.alert_level === 'danger') return 'danger-row'
  if (row.alert_level === 'warning') return 'warning-row'
  return 'safe-row'
}

const loadData = async () => {
  const custRes = await axios.get('/api/customers/with-alerts')
  customers.value = custRes.data
  const prodRes = await axios.get('/api/products')
  products.value = prodRes.data
}

const addCustomer = async () => {
  try {
    await axios.post('/api/customers', { name: newCustomer.value })
    ElMessage.success('添加成功')
    showAddCustomer.value = false
    newCustomer.value = ''
    loadData()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '添加失败')
  }
}

const addProduct = async () => {
  try {
    await axios.post('/api/products', newProduct.value)
    ElMessage.success('添加成功')
    showAddProduct.value = false
    newProduct.value = { customer_id: null, product_name: '' }
    loadData()
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const openAlertSettings = async (customer) => {
  try {
    const res = await axios.get(`/api/customer-alert-settings/${customer.id}`)
    alertSettings.value = res.data
    alertSettings.value.customer_id = customer.id
    showAlertSettings.value = true
  } catch (error) {
    ElMessage.error('加载设置失败')
  }
}

const saveAlertSettings = async () => {
  try {
    await axios.post('/api/customer-alert-settings', alertSettings.value)
    ElMessage.success('保存成功')
    showAlertSettings.value = false
    loadData()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
:deep(.danger-row) {
  background-color: #fef0f0 !important;
}

:deep(.warning-row) {
  background-color: #fdf6ec !important;
}

:deep(.safe-row) {
  background-color: #f0f9ff !important;
}
</style>
