import 'package:flutter/material.dart';

import '../models/person.dart';

class SearchablePersonDialog extends StatefulWidget {
  final List<Person> persons;
  final Map<String, String> departmentNames;

  const SearchablePersonDialog({
    super.key,
    required this.persons,
    required this.departmentNames,
  });

  @override
  State<SearchablePersonDialog> createState() => _SearchablePersonDialogState();
}

class _SearchablePersonDialogState extends State<SearchablePersonDialog> {
  final _filterCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final persons = widget.persons.where((person) {
      final department = widget.departmentNames[person.departmentId] ?? '未分类';
      return query.isEmpty ||
          person.name.toLowerCase().contains(query) ||
          department.toLowerCase().contains(query);
    }).toList();
    return AlertDialog(
      title: const Text('选择交办人员'),
      content: SizedBox(
        width: 420,
        height: 360,
        child: Column(
          children: [
            TextField(
              controller: _filterCtrl,
              decoration: const InputDecoration(
                labelText: '筛选姓名或部门',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: persons.isEmpty
                  ? const Center(child: Text('没有匹配的人员'))
                  : ListView.builder(
                      itemCount: persons.length,
                      itemBuilder: (_, index) {
                        final person = persons[index];
                        final department =
                            widget.departmentNames[person.departmentId] ??
                            '未分类';
                        return ListTile(
                          title: Text(person.name),
                          subtitle: Text(department),
                          onTap: () => Navigator.pop(context, person),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
      ],
    );
  }
}
