import 'package:flutter/material.dart';

import '../models/person.dart';
import '../models/tracked_file.dart';
import '../services/database_service.dart';

class HandoffDialog extends StatefulWidget {
  final TrackedFile file;
  final Person? currentHolder;
  final bool isRetry;

  const HandoffDialog({
    super.key,
    required this.file,
    this.currentHolder,
    this.isRetry = false,
  });

  @override
  State<HandoffDialog> createState() => _HandoffDialogState();
}

class _HandoffDialogState extends State<HandoffDialog> {
  List<Person> _persons = [];
  Map<String, String> _departmentNames = {};
  String? _selectedId;
  final _remarkCtrl = TextEditingController(text: '');
  final _filterCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadPersons();
  }

  Future<void> _loadPersons() async {
    final db = DatabaseService();
    _persons = await db.getPersons();
    final departments = await db.getDepartments();
    _departmentNames = {for (final d in departments) d.id: d.name};
    if (mounted) {
      setState(() {
        if (_persons.isNotEmpty) _selectedId = _persons.first.id;
        _loading = false;
      });
    }
  }

  List<Person> get _filtered {
    final q = _filterCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _persons;
    return _persons.where((p) {
      final dept = (_departmentNames[p.departmentId] ?? '未分类').toLowerCase();
      return p.name.toLowerCase().contains(q) || dept.contains(q);
    }).toList();
  }

  Future<void> _confirmAndSave() async {
    if (_selectedId == null) return;
    final target = _persons.firstWhere((p) => p.id == _selectedId);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('确认交办给${target.name}？'),
        content: Text('确定要将"${widget.file.name}"交办给 ${target.name} 吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('确认交办'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _save();
  }

  Future<void> _save() async {
    if (_selectedId == null) return;
    setState(() => _saving = true);
    final handoff = Handoff(
      id: DateTime.now().toIso8601String(),
      fromPersonId: widget.currentHolder?.id ?? '文件管理员',
      toPersonId: _selectedId!,
      assignedAt: DateTime.now(),
      remark: _remarkCtrl.text.trim().isEmpty ? null : _remarkCtrl.text.trim(),
    );
    widget.file.handoffs.add(handoff);
    await DatabaseService().saveFile(widget.file);
    if (mounted) Navigator.pop(context, true);
  }

  Future<void> _complete() async {
    final open = widget.file.openHandoff;
    if (open == null) return;
    open.completedAt = DateTime.now();
    await DatabaseService().saveFile(widget.file);
    if (mounted) Navigator.pop(context, true);
  }

  @override
  void dispose() {
    _remarkCtrl.dispose();
    _filterCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isCompleted = widget.file.status == FileStatus.completed;
    return AlertDialog(
      title: Text(widget.isRetry ? '重新交办' : '交办给'),
      content: _loading
          ? const SizedBox(
              height: 100,
              child: Center(child: CircularProgressIndicator()),
            )
          : SizedBox(
              width: 400,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('交办给:', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _filterCtrl,
                    decoration: const InputDecoration(
                      hintText: '搜索姓名或部门',
                      prefixIcon: Icon(Icons.search),
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: _selectedId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
                    items: _filtered.map((p) {
                      final dept = _departmentNames[p.departmentId] ?? '未分类';
                      return DropdownMenuItem(
                        value: p.id,
                        child: Text('${p.name}（$dept）'),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _selectedId = v),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _remarkCtrl,
                    decoration: const InputDecoration(
                      labelText: '备注（可选）',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
      actions: [
        TextButton(
          onPressed: _saving ? null : _complete,
          child: const Text('登记办结'),
        ),
        ElevatedButton(
          onPressed: _saving ? null : _confirmAndSave,
          child: Text(isCompleted ? '重新交办' : '确认交办'),
        ),
      ],
    );
  }
}
