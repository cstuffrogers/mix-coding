import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../models/tracked_file.dart';
import '../models/person.dart';
import '../models/department.dart';
import '../pages/register_file_page.dart';
import '../pages/file_detail_sheet.dart';
import '../services/database_service.dart';
import '../services/handoff_export_service.dart';
import '../widgets/file_list_item.dart';
import '../widgets/searchable_person_dialog.dart';
import 'person_manage_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<TrackedFile> _files = [];
  final Map<String, Person> _personById = {};
  final Map<String, Department> _deptById = {};
  FileStatus? _statusFilter;
  String _query = '';
  bool _loading = true;
  final Set<String> _selectedFileIds = {};

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    final db = DatabaseService();
    final results = await Future.wait([
      db.getTrackedFiles(),
      db.getPersons(),
      db.getDepartments(),
    ]);
    _personById
      ..clear()
      ..addEntries((results[1] as List<Person>).map((p) => MapEntry(p.id, p)));
    _deptById
      ..clear()
      ..addEntries(
        (results[2] as List<Department>).map((d) => MapEntry(d.id, d)),
      );
    if (mounted) {
      setState(() {
        _files = results[0] as List<TrackedFile>;
        _loading = false;
      });
    }
  }

  String personLabel(String id) {
    final p = _personById[id];
    if (p == null) return id; // 历史占位（如"文件管理员"）直接原样显示
    final dept = _deptById[p.departmentId]?.name;
    return dept == null ? p.name : '${p.name}（$dept）';
  }

  /// 获取文件所有涉及的人员姓名（去重）
  String _allPersonLabels(TrackedFile file) {
    final ids = <String>{};
    for (final h in file.handoffs) {
      ids.add(h.fromPersonId);
      ids.add(h.toPersonId);
    }
    // 待办文件（无 handoffs）也计入当前持有人
    if (file.handoffs.isEmpty && file.currentHolderId != null) {
      ids.add(file.currentHolderId!);
    }
    return ids.map((id) => personLabel(id)).join(' ');
  }

  List<TrackedFile> get _visibleFiles => _files.where((file) {
    final query = _query.trim().toLowerCase();
    final matchesName = file.name.toLowerCase().contains(query);
    final matchesNumber = file.number.toLowerCase().contains(query);
    final allLabels = _allPersonLabels(file).toLowerCase();
    final matchesHolder = file.currentHolderId != null
        ? personLabel(file.currentHolderId!).toLowerCase().contains(query)
        : false;
    final matchesPerson = allLabels.contains(query);
    final isProcessingFilter = _statusFilter == FileStatus.processing;
    final matchesSearch = query.isEmpty
        ? true
        : matchesName || matchesNumber || (isProcessingFilter ? matchesHolder : matchesPerson);
    return matchesSearch &&
        (_statusFilter == null || file.status == _statusFilter);
  }).toList();

  Future<void> _registerFile() async {
    final file = await showModalBottomSheet<TrackedFile>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const RegisterFilePage(),
    );
    if (file != null) {
      await DatabaseService().saveFile(file);
      await _loadAll();
    }
  }

  Future<void> _showFileDetail(TrackedFile file) async {
    final action = await showModalBottomSheet<String?>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => FileDetailSheet(
        file: file,
        personLabel: personLabel,
        onAction: (action) => Navigator.of(sheetContext).pop<String>(action),
      ),
    );
    if (action == 'handoff') {
      await _openHandoff(file);
    } else if (action == 'complete') {
      await _complete(file);
    } else if (action == 'edit') {
      await _editFile(file);
    } else if (action == 'delete') {
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('确认删除'),
          content: Text('确定删除文件"${file.name}"吗？此操作不可撤销。'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('删除'),
            ),
          ],
        ),
      );
      if (confirmed == true) {
        await DatabaseService().deleteFile(file.id);
        await _loadAll();
      }
    }
  }

  Future<Person?> _selectPerson() => showDialog<Person>(
    context: context,
    builder: (_) => SearchablePersonDialog(
      persons: _personById.values.toList(),
      departmentNames: {
        for (final entry in _deptById.entries) entry.key: entry.value.name,
      },
    ),
  );

  Future<bool> _confirmHandoff(Person person, int count) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('确认交办'),
            content: Text('确定将 $count 个文件交办给 ${person.name} 吗？'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('确认交办'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _openHandoff(TrackedFile file) async {
    if (_personById.isEmpty) {
      _showMessage('请先在"人员"中添加办理人员');
      return;
    }
    final selected = await _selectPerson();
    if (selected == null || !await _confirmHandoff(selected, 1)) return;
    final handoff = Handoff(
      id: const Uuid().v4(),
      fromPersonId: file.currentHolderId ?? '文件管理员',
      toPersonId: selected.id,
      assignedAt: DateTime.now(),
    );
    file.completed = false;
    file.handoffs.add(handoff);
    await DatabaseService().saveFile(file);
    await _loadAll();
  }

  Future<void> _complete(TrackedFile file) async {
    final open = file.openHandoff;
    if (open != null) {
      open.completedAt = DateTime.now();
    }
    file.completed = true;
    await DatabaseService().saveFile(file);
    await _loadAll();
  }

  Future<void> _editFile(TrackedFile file) async {
    final edited = await showModalBottomSheet<TrackedFile>(
      context: context,
      isScrollControlled: true,
      builder: (_) => RegisterFilePage(initial: file),
    );
    if (edited != null) {
      await DatabaseService().saveFile(edited);
      await _loadAll();
    }
  }

  Future<void> _batchHandoff() async {
    if (_personById.isEmpty) {
      _showMessage('请先在"人员"中添加办理人员');
      return;
    }
    final files = _files
        .where((file) => _selectedFileIds.contains(file.id))
        .toList();
    final selectedPerson = await _selectPerson();
    if (selectedPerson == null ||
        !await _confirmHandoff(selectedPerson, files.length)) {
      return;
    }
    final now = DateTime.now();
    for (final file in files) {
      file.completed = false;
      file.handoffs.add(
        Handoff(
          id: const Uuid().v4(),
          fromPersonId: file.currentHolderId ?? '文件管理员',
          toPersonId: selectedPerson.id,
          assignedAt: now,
        ),
      );
    }
    await DatabaseService().saveFiles(files);
    if (!mounted) return;
    setState(_selectedFileIds.clear);
    await _loadAll();
  }

  Future<void> _batchComplete() async {
    final files = _files
        .where((file) => _selectedFileIds.contains(file.id))
        .toList();
    final now = DateTime.now();
    for (final file in files) {
      file.openHandoff?.completedAt = now;
      file.completed = true;
    }
    await DatabaseService().saveFiles(files);
    if (!mounted) return;
    setState(_selectedFileIds.clear);
    await _loadAll();
  }

  void _toggleSelected(String id, bool? selected) {
    setState(() {
      if (selected == true) {
        _selectedFileIds.add(id);
      } else {
        _selectedFileIds.remove(id);
      }
    });
  }

  void _clearSelection() => setState(_selectedFileIds.clear);

  Future<void> _exportExcel() async {
    await HandoffExportService.download(
      files: _files,
      personLabel: personLabel,
      context: context,
    );
  }

  Future<void> _importExcel() async {
    if (_personById.isEmpty) {
      _showMessage('请先在"人员"中添加办理人员');
      return;
    }
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
      withData: true,
    );
    final bytes = result?.files.single.bytes;
    if (bytes == null) return;

    final importResult = await HandoffExportService.import(
      bytes: bytes,
      currentFiles: _files,
      persons: _personById.values.toList(),
    );
    await _loadAll();
    _showMessage(
      '已导入 ${importResult.imported} 条记录，跳过 ${importResult.skipped} 条',
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _selectedFileIds.isEmpty
              ? '文件交接登记'
              : '已选择 ${_selectedFileIds.length} 个文件',
        ),
        actions: [
          if (_selectedFileIds.isNotEmpty) ...[
            IconButton(
              tooltip: '批量交办',
              icon: const Icon(Icons.assignment_ind_outlined),
              onPressed: _batchHandoff,
            ),
            IconButton(
              tooltip: '批量办结',
              icon: const Icon(Icons.task_alt),
              onPressed: _batchComplete,
            ),
            IconButton(
              tooltip: '取消选择',
              icon: const Icon(Icons.close),
              onPressed: _clearSelection,
            ),
          ] else ...[
            IconButton(
              tooltip: '导入Excel',
              icon: const Icon(Icons.file_upload_outlined),
              onPressed: _importExcel,
            ),
            IconButton(
              tooltip: '导出Excel',
              icon: const Icon(Icons.file_download_outlined),
              onPressed: _exportExcel,
            ),
          ],
          IconButton(
            tooltip: '人员与部门',
            icon: const Icon(Icons.people_outline),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PersonManagePage()),
              );
              if (mounted) await _loadAll();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SearchBar(
              leading: const Icon(Icons.search),
              hintText: '搜索文件名、编号或交办人',
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          _FilterBar(
            selected: _statusFilter,
            files: _files,
            onSelected: (value) => setState(() => _statusFilter = value),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _visibleFiles.isEmpty
                ? const Center(child: Text('暂无符合条件的文件'))
                : RefreshIndicator(
                    onRefresh: _loadAll,
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 88),
                      itemCount: _visibleFiles.length,
                      itemBuilder: (_, index) => FileListItem(
                        file: _visibleFiles[index],
                        personLabel: (id) => personLabel(id),
                        selected: _selectedFileIds.contains(
                          _visibleFiles[index].id,
                        ),
                        onSelected: (selected) =>
                            _toggleSelected(_visibleFiles[index].id, selected),
                        onTap: () => _showFileDetail(_visibleFiles[index]),
                      ),
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _registerFile,
        icon: const Icon(Icons.add),
        label: const Text('登记文件'),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final FileStatus? selected;
  final List<TrackedFile> files;
  final ValueChanged<FileStatus?> onSelected;

  const _FilterBar({
    required this.selected,
    required this.files,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final items = <({FileStatus? value, String label, int count})>[
      (value: null, label: '全部', count: files.length),
      ...FileStatus.values.map(
        (status) => (
          value: status,
          label: status.label,
          count: files.where((f) => f.status == status).length,
        ),
      ),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: items
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text('${item.label} ${item.count}'),
                  selected: selected == item.value,
                  onSelected: (_) => onSelected(item.value),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
