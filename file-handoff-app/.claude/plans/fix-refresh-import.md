# 修复规划：首页刷新 + Excel 导入人员

## 问题分析

### 问题 1：首页返回后看不到新增人员
- 根因：`home_page.dart:156-159` 使用 `Navigator.push` 但不等待返回值
- 影响：`_personById` 缓存过期，交办弹窗的人员列表不包含新人员
- 修复：`await Navigator.push` 后调用 `_loadAll()`

### 问题 2：无法批量导入 Excel 中的人员
- 当前无文件选择/XLSX 解析能力
- 需要添加依赖并实现导入流程

## 修改清单

### 1. 依赖变更 (`pubspec.yaml`)
```yaml
dependencies:
  file_picker: ^8.0.0      # 跨平台文件选择
  excel: ^2.1.0            # XLSX 解析（Pure Dart）
```

### 2. 路由刷新 (`lib/pages/home_page.dart`)
```dart
// 156-159 行
onPressed: () async {
  await Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => const PersonManagePage()),
  );
  if (mounted) await _loadAll();  // 关键：等待返回后刷新
},
```

### 3. 新增导入服务 (`lib/services/person_import_service.dart`)
- 解析 XLSX/CSV
- 按部门名称匹配
- 批量 upsert Person

### 4. 导入入口 (`lib/pages/person_manage_page.dart`)
- 添加顶部TabBar或编辑页导入按钮
- 触发文件选择 → 解析 → 预览 → 导入

### 5. 测试 (`test/`)
- `services/person_import_service_test.dart`：解析、部门映射、批量保存
- `pages/home_page_test.dart`：导航返回后刷新

## 验证步骤
1. `flutter analyze` 通过
2. `flutter test` 所有测试通过
3. 手动：新增人员 → 返回首页 → 交办选择框能看到
4. 手动：Excel 导入 → 人员列表出现

## 边界条件
- 部门不存在：显示错误行，不中断
- 重复姓名：跳过（防冗余）
- 空文件/格式错误：弹框提示
- Web 端：需 CORS 同源，文件大小 < 5MB