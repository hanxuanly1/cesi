<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background: #545c64">
      <el-menu
        :default-active="$route.path"
        router
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
      >
        <el-menu-item index="/">
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/inbound">
          <span>入库管理</span>
        </el-menu-item>
        <el-menu-item index="/outbound">
          <span>出库管理</span>
        </el-menu-item>
        <el-menu-item index="/inventory">
          <span>库存查询</span>
        </el-menu-item>
        <el-menu-item index="/defects">
          <span>残次品登记</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <span>财务报表</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <span>基础设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #409eff; color: #fff; line-height: 60px; font-size: 20px">
        产品加工统计管理系统
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>
