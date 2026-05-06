<template>
  <div>
    <h2>今日概览</h2>
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 14px; color: #999">今日入库</div>
            <div style="font-size: 32px; font-weight: bold; margin-top: 10px">{{ stats.inbound }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 14px; color: #999">今日出库</div>
            <div style="font-size: 32px; font-weight: bold; margin-top: 10px">{{ stats.outbound }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 14px; color: #999">今日残次品</div>
            <div style="font-size: 32px; font-weight: bold; margin-top: 10px; color: #f56c6c">{{ stats.defects }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 14px; color: #999">当前库存</div>
            <div style="font-size: 32px; font-weight: bold; margin-top: 10px; color: #67c23a">{{ stats.inventory }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 财务状况 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>今日入库成本</span>
              <el-icon color="#f56c6c" :size="24"><Remove /></el-icon>
            </div>
          </template>
          <div style="text-align: center">
            <div style="font-size: 36px; font-weight: bold; color: #f56c6c">
              -¥{{ finance.inbound_cost.toFixed(2) }}
            </div>
            <div style="margin-top: 10px; color: #999">入库支出</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>今日出库收入</span>
              <el-icon color="#67c23a" :size="24"><CirclePlus /></el-icon>
            </div>
          </template>
          <div style="text-align: center">
            <div style="font-size: 36px; font-weight: bold; color: #67c23a">
              +¥{{ finance.outbound_income.toFixed(2) }}
            </div>
            <div style="margin-top: 10px; color: #999">出库收入</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>今日净利润</span>
              <el-icon :color="finance.profit >= 0 ? '#67c23a' : '#f56c6c'" :size="24">
                <TrendCharts v-if="finance.profit >= 0" />
                <Bottom v-else />
              </el-icon>
            </div>
          </template>
          <div style="text-align: center">
            <div style="font-size: 36px; font-weight: bold" :style="{ color: finance.profit >= 0 ? '#67c23a' : '#f56c6c' }">
              {{ finance.profit >= 0 ? '+' : '' }}¥{{ finance.profit.toFixed(2) }}
            </div>
            <div style="margin-top: 10px; color: #999">出库收入 - 入库成本</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 月度财务汇总 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>本月财务汇总</span>
          <el-date-picker 
            v-model="selectedMonth" 
            type="month" 
            placeholder="选择月份"
            value-format="YYYY-MM"
            @change="loadMonthlyFinance"
          />
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :span="6">
          <div style="text-align: center; padding: 20px">
            <div style="font-size: 14px; color: #999">月度入库成本</div>
            <div style="font-size: 28px; font-weight: bold; color: #f56c6c; margin-top: 10px">
              ¥{{ monthlyFinance.inbound_cost.toFixed(2) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div style="text-align: center; padding: 20px">
            <div style="font-size: 14px; color: #999">月度出库收入</div>
            <div style="font-size: 28px; font-weight: bold; color: #67c23a; margin-top: 10px">
              ¥{{ monthlyFinance.outbound_income.toFixed(2) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div style="text-align: center; padding: 20px">
            <div style="font-size: 14px; color: #999">月度净利润</div>
            <div style="font-size: 28px; font-weight: bold; margin-top: 10px" :style="{ color: monthlyFinance.profit >= 0 ? '#67c23a' : '#f56c6c' }">
              ¥{{ monthlyFinance.profit.toFixed(2) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div style="text-align: center; padding: 20px">
            <div style="font-size: 14px; color: #999">利润率</div>
            <div style="font-size: 28px; font-weight: bold; margin-top: 10px" :style="{ color: monthlyFinance.profit_rate >= 0 ? '#67c23a' : '#f56c6c' }">
              {{ monthlyFinance.profit_rate.toFixed(2) }}%
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { CirclePlus, Remove, TrendCharts, Bottom } from '@element-plus/icons-vue'

const stats = ref({
  inbound: 0,
  outbound: 0,
  defects: 0,
  inventory: 0
})

const finance = ref({
  inbound_cost: 0,
  outbound_income: 0,
  profit: 0
})

const monthlyFinance = ref({
  inbound_cost: 0,
  outbound_income: 0,
  profit: 0,
  profit_rate: 0
})

const selectedMonth = ref(new Date().toISOString().slice(0, 7))

const loadDailyData = async () => {
  const today = new Date().toISOString().split('T')[0]
  const daily = await axios.get(`/api/reports/daily?date=${today}`)
  
  stats.value.inbound = daily.data.inbound.reduce((sum, item) => sum + item.quantity, 0)
  stats.value.outbound = daily.data.outbound.reduce((sum, item) => sum + item.quantity, 0)
  stats.value.defects = daily.data.defects.reduce((sum, item) => sum + item.quantity, 0)
  
  const inventory = await axios.get('/api/inventory')
  stats.value.inventory = inventory.data.reduce((sum, item) => sum + item.remaining_quantity, 0)
  
  // 获取今日财务数据
  const financeRes = await axios.get(`/api/reports/daily-finance?date=${today}`)
  finance.value = financeRes.data
}

const loadMonthlyFinance = async () => {
  const [year, month] = selectedMonth.value.split('-')
  const res = await axios.get(`/api/reports/monthly-finance?year=${year}&month=${month}`)
  monthlyFinance.value = res.data
}

onMounted(async () => {
  await loadDailyData()
  await loadMonthlyFinance()
})
</script>
