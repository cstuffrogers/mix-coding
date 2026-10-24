import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:uuid/uuid.dart';

import '../models/department.dart';
import '../models/person.dart';
import '../services/database_service.dart';
import '../services/person_import_service.dart';
import '../services/person_template_service.dart';

class PersonManagePage extends StatefulWidget {
  const PersonManagePage({super.key});

  @override
  State<PersonManagePage> createState() => _PersonManagePageState();
}

class _PersonManagePageState extends State<PersonManagePage>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  List<Department> _departments = [];
  List<Person> _persons = [];
  String _departmentQuery = '';
  String _personQuery = '';

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _tab.addListener(_syncFab);
    _reload();
  }

  @override
  void dispose() {
    _tab
      ..removeListener(_syncFab)
      ..dispose();
    super.dispose();
  }

  void _syncFab() => setState(() {});

  Future<void> _reload() async {
    final db = DatabaseService();
    final results = await Future.wait([db.getDepartments(), db.getPersons()]);
    if (!mounted) return;
    setState(() {
      _departments = results[0] as List<Department>;
      _persons = results[1] as List<Person>;
    });
  }

  bool get _onPersonTab => _tab.index == 1;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('人员与部门'),
        actions: [
          if (_onPersonTab)
            TextButton.icon(
              onPressed: PersonTemplateService.download,
              icon: const Icon(Icons.download),
              label: const Text('下载样本'),
            ),
          if (_onPersonTab)
            TextButton.icon(
              onPressed: _importPersons,
              icon: const Icon(Icons.upload_file),
              label: const Text('导入 Excel'),
            ),
        ],
        bottom: TabBar(
          controller: _tab,
          tabs: const [
            Tab(text: '部门'),
            Tab(text: '人员'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [_departmentTab(), _personTab()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _onPersonTab ? _addPerson() : _addDepartment(),
        icon: const Icon(Icons.add),
        label: Text(_onPersonTab ? '新增人员' : '新增部门'),
      ),
    );
  }

  // ---- 部门 tab ----

  Widget _departmentTab() {
    final query = _departmentQuery.trim().toLowerCase();
    final departments = _departments
        .where((d) => query.isEmpty || d.name.toLowerCase().contains(query))
        .toList();
    if (_departments.isEmpty) {
      return const Center(child: Text('暂无部门，点右下角新增'));
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(
              labelText: '筛选部门',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (value) => setState(() => _departmentQuery = value),
          ),
        ),
        Expanded(
          child: departments.isEmpty
              ? const Center(child: Text('没有匹配的部门'))
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: departments.length,
                  itemBuilder: (_, i) {
                    final d = departments[i];
                    return ListTile(
                      title: Text(d.name),
                      subtitle: d.remark == null ? null : Text(d.remark!),
                      onTap: () => _editDepartment(d),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Future<void> _addDepartment() => _editDepartment(null);

  Future<void> _editDepartment(Department? existing) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final remarkCtrl = TextEditingController(text: existing?.remark ?? '');
    final saved = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(existing == null ? '新增部门' : '编辑部门'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              decoration: const InputDecoration(labelText: '部门名称'),
            ),
            TextField(
              controller: remarkCtrl,
              decoration: const InputDecoration(labelText: '备注（可选）'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (saved == true && nameCtrl.text.trim().isNotEmpty) {
      await DatabaseService().saveDepartment(
        Department(
          id: existing?.id ?? const Uuid().v4(),
          name: nameCtrl.text.trim(),
          remark: remarkCtrl.text.trim().isEmpty
              ? null
              : remarkCtrl.text.trim(),
        ),
      );
      await _reload();
    }
    nameCtrl.dispose();
    remarkCtrl.dispose();
  }

  // ---- 人员 tab ----

  Widget _personTab() {
    final query = _personQuery.trim().toLowerCase();
    final persons = _persons.where((p) {
      final department = _deptName(p.departmentId).toLowerCase();
      return query.isEmpty ||
          p.name.toLowerCase().contains(query) ||
          department.contains(query);
    }).toList();
    if (_persons.isEmpty) {
      return const Center(child: Text('暂无人员，先建部门再新增人员'));
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(
              labelText: '筛选姓名或部门',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (value) => setState(() => _personQuery = value),
          ),
        ),
        Expanded(
          child: persons.isEmpty
              ? const Center(child: Text('没有匹配的人员'))
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: persons.length,
                  itemBuilder: (_, i) {
                    final p = persons[i];
                    return ListTile(
                      title: Text(p.name),
                      subtitle: Text(
                        _deptName(p.departmentId) +
                            (p.remark == null ? '' : ' | ${p.remark}'),
                      ),
                      onTap: () => _editPerson(p),
                    );
                  },
                ),
        ),
      ],
    );
  }

  String _deptName(String id) => _departments
      .firstWhere(
        (d) => d.id == id,
        orElse: () => Department(id: '', name: '未分类'),
      )
      .name;

  Future<void> _addPerson() => _editPerson(null);

  Future<void> _importPersons() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
      withData: true,
    );
    final bytes = result?.files.single.bytes;
    if (bytes == null) return;

    try {
      final importResult = await PersonImportService().importXlsx(bytes);
      await _reload();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '已导入 ${importResult.imported} 人，跳过 ${importResult.skipped} 行',
            ),
          ),
        );
      }
    } on FormatException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Excel 导入失败：$error')));
      }
    }
  }

  Future<void> _editPerson(Person? existing) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final remarkCtrl = TextEditingController(text: existing?.remark ?? '');
    String? deptId = existing?.departmentId ?? _departments.firstOrNull?.id;
    final saved = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setInner) => AlertDialog(
          title: Text(existing == null ? '新增人员' : '编辑人员'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                autofocus: true,
                decoration: const InputDecoration(labelText: '姓名'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String?>(
                initialValue: deptId,
                decoration: const InputDecoration(labelText: '部门'),
                items: _departments
                    .map(
                      (d) => DropdownMenuItem(value: d.id, child: Text(d.name)),
                    )
                    .toList(),
                onChanged: (v) => setInner(() => deptId = v),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: remarkCtrl,
                decoration: const InputDecoration(labelText: '备注（可选）'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );
    if (saved == true && nameCtrl.text.trim().isNotEmpty && deptId != null) {
      await DatabaseService().savePerson(
        Person(
          id: existing?.id ?? const Uuid().v4(),
          name: nameCtrl.text.trim(),
          departmentId: deptId!,
          remark: remarkCtrl.text.trim().isEmpty
              ? null
              : remarkCtrl.text.trim(),
        ),
      );
      await _reload();
    }
    nameCtrl.dispose();
    remarkCtrl.dispose();
  }
}
