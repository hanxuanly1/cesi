<template>
  <div>
    <h2>财务报表</h2>
    <el-form inline style="margin-top: 20px">
      <el-form-item label="年份">
        <el-input-number v-model="year" :min="2020" :max="2030" />
      </el-form-item>
      <el-form-item label="月份">
        <el-input-number v-model="month" :min="1" :max="12" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadReport">查询</el-button>
        <el-button @click="exportReport">导出Excel</el-button>
      </el-form-item>
    </el-form>
    
    <el-table :data="report" style="margin-top: 20px" border show-summary>
      <el-table-column prop="customer_name" label="客户" width="150" />
      <el-table-column prop="product_name" label="产品" width="150" />
      <el-table-column prop="total_in" label="入库总量" width="120" />
      <el-table-column prop="total_out" label="出库总量" width="120" />
      <el-table-column prop="total_defect" label="残次品总量" width="120" />
      <el-table-column prop="remaining" label="剩余库存" width="120" />
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
const report = ref([])

const loadReport = async () => {
  try {
    const res = await axios.get(`/api/reports/monthly?year=${year.value}&month=${month.value}`)
    report.value = res.data
  } catch (error) {
    ElMessage.error('查询失败')
  }
}

const exportReport = () => {
  let csv = '客户,产品,入库总量,出库总量,残次品总量,剩余库存\n'
  report.value.forEach(row => {
    csv += `${row.customer_name},${row.product_name},${row.total_in},${row.total_out},${row.total_defect},${row.remaining}\n`
  })
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `财务报表_${year.value}年${month.value}月.csv`
  link.click()
}

loadReport()
</script>
